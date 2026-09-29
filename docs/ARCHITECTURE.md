# BuildCraft Home Designer — Architecture

Interactive 3D construction / home-design configurator for a construction and real-estate platform.
This document covers the target (production) architecture and how the first working version (v0.1,
in this folder) maps onto it.

---

## 1. Recommended technology stack

| Layer | Production recommendation | v0.1 (this folder) |
|---|---|---|
| Language | TypeScript (strict) | Modern JavaScript (ES2021), JSDoc-style types in the model |
| UI framework | React 18 + a component kit (Radix/shadcn or MUI) | Vanilla JS view modules with a small render helper |
| State | Zustand (or Redux Toolkit) + Immer, command pattern for undo | `HD.store` — same API shape: `update(fn)`, `begin/end` transactions, undo/redo |
| 3D | three.js (optionally via react-three-fiber) | three.js r147 (CDN) + OrbitControls |
| 2D plan | SVG (React components) — Konva/Pixi only if plans get huge | SVG rendered from the design model |
| PDF | Server-side (Puppeteer/Playwright) for branded PDFs; client print as fallback | Printable HTML report → browser “Save as PDF” |
| Backend | Node.js (NestJS) REST/GraphQL API, or the platform’s existing backend | `DesignRepository` interface with a localStorage implementation |
| Database | PostgreSQL — design documents in `JSONB` + relational tables for projects, customers, approvals, quotations | localStorage |
| Files | S3-compatible object storage (thumbnails, renders, exports) | Data URLs |
| Auth / sharing | Platform SSO (JWT/OAuth2), signed share tokens with roles | Share link that embeds a compressed snapshot |
| Build/CI | Vite, Vitest (core logic), Playwright (E2E), ESLint/Prettier | None needed — open `index.html` |

The key decision: **the core (model, geometry, generator, Vastu, cost) has no dependency on the UI or
three.js**, so it can be moved to TypeScript packages and reused server-side (e.g. to price a quotation or
validate a design in the backend) without changes to its logic.

## 2. 3D engine / library recommendation

**three.js** is the recommendation:

- Mature, huge ecosystem, runs everywhere WebGL runs (desktop, tablets, most phones).
- Full control over procedural architecture (walls with openings, slabs, stairs, roofs) which is what a
  configurator needs — the model is generated from data, not loaded from static files.
- Raycasting for precise object picking, OrbitControls, shadows, PBR materials, and exporters
  (GLTFExporter for AR/VR or hand-off to visualisers) are built in.
- Path to production: react-three-fiber for declarative scene composition, `three-mesh-bvh` for fast
  picking on large scenes, GLTF furniture models from a catalog CDN, and optional path-traced stills.

Alternatives considered: **Babylon.js** (also excellent, heavier, stronger built-in GUI/inspector) and
**Unity/Unreal pixel streaming** (photoreal, but server GPUs per user and poor for web forms). For a
data-driven configurator embedded in a web platform, three.js is the best cost/flexibility balance.

## 3. Overall system architecture

```
┌──────────────────────────── Client (browser) ────────────────────────────┐
│  UI shell (steps, panels, inspector, dashboard, dialogs)                 │
│        │ dispatches commands              ▲ subscribes                   │
│        ▼                                  │                              │
│  Store: design document + selection + UI state + undo/redo (commands)    │
│        │                                                                 │
│   ┌────┴─────────────┬──────────────────┬───────────────┬─────────────┐  │
│   ▼                  ▼                  ▼               ▼             ▼  │
│ 2D Plan (SVG)   3D Engine (three.js)  Vastu engine   Cost engine   Exporters
│   │  pick/drag        │ pick/drag          (rules JSON)  (pricing JSON)  │
│   └────── both emit the same commands ──────┘                            │
│                                                                          │
│  Core (pure): model/schema · catalogs · geometry (walls from rooms) ·    │
│               layout generator · orientation · metrics · validation      │
│  Persistence: DesignRepository (local ↔ REST) · ShareService             │
└──────────────────────────────────────────────────────────────────────────┘
                 │ REST/GraphQL (production)
┌────────────────┴───────── Backend ───────────────────────────────────────┐
│ Designs API · Versions · Share tokens · Pricing rules · Vastu rules ·    │
│ Catalog (materials, furniture) · Render/PDF workers · Integration events │
│ → Projects, Customer requirements, Quotations, Approvals, Material est.  │
└──────────────────────────────────────────────────────────────────────────┘
```

Principles:

1. **Single source of truth** — one serialisable `Design` document. 2D and 3D are *projections* of it.
2. **Commands, not direct mutation** — every edit is a named command on the document (move room,
   move wall, add opening…). That gives undo/redo, audit trails and a future collaboration log.
3. **Derived data is never stored** — walls, areas, Vastu zones and costs are computed from rooms,
   openings and settings, so they can never go out of sync.
4. **Rules as data** — Vastu rules, pricing and catalogs are JSON configs that can come from the backend.

## 4. UI/UX structure

```
Dashboard ── New design wizard (Plot → Building type → Facing → Options → Generate)
   │         Continue last design · Duplicate · Variant · Compare · Import
   ▼
Editor
 ├─ Top bar: design name, save status, undo/redo, Designs, Variants/Compare, Export, Share
 ├─ Workflow steps: Plot · Layout · Rooms · Doors & Windows · Furniture · Materials ·
 │                   Exterior · Vastu · Cost · Review
 ├─ Left panel: tools for the current step
 ├─ Centre: floor tabs · 2D | Split | 3D · camera presets (Orbit/Top/Front/Side/Interior) ·
 │          display (floors, cut-away walls, labels, sun position) · compass
 ├─ Right panel: Inspector for the selected object (room, wall, door, window, furniture,
 │               flooring, ceiling, roof, compound wall/gate, plot) + design checks
 └─ Status bar: plot area, built-up, carpet, coverage, FAR, Vastu score, estimate
```

The steps follow the requested workflow (Plot → BHK → generated plan → facing → rooms → doors/windows →
furniture → materials → 3D → click object → edit → save/export/share), but every tool stays available
at any time — steps guide, they don’t lock.

## 5. Database / data model

### Design document (stored as JSONB, versioned by `schemaVersion`)

```
Design {
  id, schemaVersion, name, createdAt, updatedAt,
  meta:     { bhk, variantGroupId, variantLabel, status, projectId, customerId, notes, ui{...} }
  plot:     { width, depth, setbacks{front,rear,left,right}, facing: N|E|S|W, roadWidth }
  settings: { extWall, intWall, plinth, grade, doorHeight }
  materials:{ floor, bathFloor, wall, bathWall, kitchenWall, ceiling, door, window }   // defaults
  exterior: { wall, accent, accentOn, roofType, roofMaterial, parapet, sunshades, railing,
              compound{on,height,material, gate{style,width,center,material}}, paving, lawn }
  floors: [ Floor { id, name, level, height,
             rooms:     [ Room { id, type, name, x, y, w, d, floorMat?, wallMat?, ceilingMat? } ],
             openings:  [ Opening { id, kind: door|window, style, axis: h|v, line, center,
                                    width, height, sill, hinge, swing, main, material? } ],
             furniture: [ Item { id, type, x, y, rot, w?, d?, h?, color? } ] } ]
  site:     { items: [ Item ] }             // trees, cars, outdoor objects
}
```

Coordinates: feet, plan origin at the plot’s back-left corner, +x to the right, +y towards the road
(front). 3D maps x→X, y→Z, height→Y.

### Relational tables (production)

```
customers(id, name, contact, …)            projects(id, customer_id, site_address, status, …)
designs(id, project_id, customer_id, owner_id, name, status, variant_group_id,
        current_version_id, thumbnail_url, bhk, plot_w, plot_d, facing, floors, builtup_sqft,
        estimate_amount, vastu_score, created_at, updated_at)          -- denormalised for listing
design_versions(id, design_id, schema_version, document JSONB, created_by, created_at, note)
design_shares(id, design_id, token_hash, role: viewer|commenter|editor, expires_at, created_by)
design_comments(id, design_id, version_id, object_ref, body, author_id, resolved)
approvals(id, design_id, version_id, approver_id, status, comment, decided_at)
quotations(id, design_id, version_id, pricing_rule_set_id, lines JSONB, total, status)
pricing_rule_sets(id, region, currency, rules JSONB, valid_from)       vastu_rule_sets(id, rules JSONB)
catalog_materials(id, category, name, pbr JSONB, price, unit, vendor_id)
catalog_furniture(id, category, name, model_url, size, price, vendor_id)
```

Versions are immutable snapshots; approvals and quotations reference a specific `version_id`, so what
the client approved is always reproducible.

## 6. 2D ↔ 3D synchronisation

- Both views render from the same `Design` in the store; neither owns any state.
- Every interaction in either view calls the same command (`moveRoom`, `resizeRoom`, `moveWall`,
  `moveOpening`, `moveFurniture`, …). The store notifies subscribers; each view re-renders.
- **Walls are derived** from room rectangles (`geometry.deriveWalls`): shared edges become one interior
  wall, unshared edges become exterior walls, and edges of balconies/terraces become railings/parapets.
  So resizing a room in 2D instantly changes walls in 3D, and vice versa.
- Openings are anchored to a wall line (`axis`, `line`, `center`). Commands that move a room edge or
  a shared wall carry the openings and furniture on it along.
- The 3D engine rebuilds only changed sections (per-floor signature diffing), so dragging in 2D updates
  3D in real time. Drags are *transactions*: many transient updates, one undo step.

## 7. Object selection & editing

- Every 3D mesh carries `userData.pick = { kind, id, floorId, facet }` (kind ∈ room, wall, opening,
  furniture, ceiling, roof, compound, gate, site, plot; facet e.g. `floor` for flooring).
  Picking uses a raycaster against pickable meshes only, returning the nearest hit — the exact element
  clicked, not its parent group.
- 2D SVG elements carry the same references as `data-kind`/`data-id` attributes.
- Selection lives in the store `{kind, id, floorId, facet}`; both views highlight it (3D: emissive tint +
  outline edges; 2D: accent stroke, handles, dimension lines).
- The Inspector is a registry `kind → property editor`, each editor issues commands. Adding a new
  selectable type = add a pick kind + an inspector section.
- Direct manipulation: drag rooms, walls, openings and furniture in 2D; drag furniture, rooms and
  openings in 3D; keyboard: Delete, R (rotate), arrows (nudge), Ctrl+D, Ctrl+Z / Ctrl+Y, Esc.

## 8. Orientation / facing

- The plan is always stored road-side down (+y = front). `plot.facing` states which compass direction
  the front faces. Bearing of any plan direction: `bearing = frontBearing + atan2(-dx, dy)`.
- Everything direction-related is derived from this one function: compass rose (2D and 3D, rotating
  with the camera), “North-up” plan rotation, sun position (time-of-day slider moves the sun from E to W
  through S), Vastu zones, and entrance direction.
- Changing facing therefore never moves geometry; it re-labels directions — exactly what happens when
  the same plan is built on a differently facing plot. The layout generator can mirror a plan to suit
  the new facing (Vastu optimisation).

## 9. Multi-floor architecture

- `floors[]` ordered by `level`; each floor has its own rooms, openings, furniture and height.
- Elevation of floor *k* = plinth + Σ heights below. Slabs, balconies (cantilevered) and terraces are
  derived per floor; the roof is generated over the top floor (flat with parapet, gable or hip), with a
  staircase headroom (“mumty”) over the top staircase.
- Staircases are rooms of type `staircase`, generated at the same position on every floor; the slab
  above a staircase is left open.
- The generator distributes bedrooms across floors (e.g. 3 BHK G+1 → 1 down, 2 up) and places a
  family lounge / terrace upstairs. New floors can be added empty (with staircase) or as a copy.
- 3D display: all floors, or “up to active floor” (cut-away above) so any floor can be edited in 3D.

## 10. Cost estimation architecture

```
estimate(design, pricingRules) → { lines[], groups{}, total, perSqft, quantities[] }
```

- Pure function. Quantity take-off comes from derived geometry (built-up area per floor, wall areas
  per finish, opening areas, roof area, compound wall length, paved area, furniture list).
- Pricing is a JSON rule set: grade rates (basic/standard/premium) per sq ft, floor multipliers,
  per-material rates (from the material catalog), door/window/gate prices, landscaping, contingency.
- Line items are grouped (Structure, Flooring, Walls & finishes, Doors & windows, Roof, Exterior & site,
  Interiors) and itemised with qty × rate, so they can be turned into a **quotation** directly.
- Material quantities (cement, steel, sand, aggregate, bricks, tiles, paint) use configurable thumb
  rules — the hook for the future material-estimation module.
- In production: rule sets are versioned per region/date on the server, and the backend re-runs the
  same function to produce authoritative quotations.

## 11. Save / load architecture

- `DesignRepository` interface: `list()`, `get(id)`, `save(design, thumbnail)`, `remove(id)`,
  `duplicate(id)`. v0.1 ships `LocalRepository` (localStorage); production swaps in `ApiRepository`.
- Autosave (debounced) after every committed change; the header shows *Saving… / Saved*.
- UI context (current step, active floor, view mode) is saved with the design, and the URL
  (`#/design/<id>`) re-opens it — users continue exactly where they stopped.
- `schemaVersion` + `migrate()` keep older documents loadable as the model evolves.
- Variants share a `variantGroupId`; “Create variant” duplicates the document and labels it
  (Design A, B, C…). Compare shows metrics side by side (area, rooms, Vastu score, cost, materials).
- JSON export/import for backups and hand-off.

## 12. Export / share architecture

| Output | v0.1 | Production |
|---|---|---|
| 2D floor plan | SVG and PNG per floor (vector, dimensioned, north arrow) | + DXF for CAD |
| 3D views | PNG of current camera, any preset view | Server-side high-res / path-traced renders, GLTF |
| Design summary | Printable report: metrics, plans, 3D image, room & door/window schedules, materials, Vastu, cost | Branded PDF from a render worker |
| PDF | Browser “Save as PDF” from the report | Puppeteer PDF service, stored in S3 |
| Sharing | View-only link containing a compressed snapshot; “Make a copy” for the receiver | Share tokens with roles, expiry, comments and approval workflow |
| Data | JSON export/import | API + webhooks to CRM / project management |

## 13. Folder / project structure

```
home-designer/
├─ index.html                 app shell, loads libraries and modules in order
├─ css/app.css                design tokens + layout + components
├─ docs/ARCHITECTURE.md       this document
├─ README.md
└─ js/
   ├─ core/                   pure logic — no DOM, no three.js
   │  ├─ util.js              ids, cloning, formatting (ft-in, ₹), helpers
   │  ├─ catalog.js           room types, furniture, materials, door/window styles, plot presets
   │  ├─ model.js             Design schema, factories, migration
   │  ├─ orientation.js       facing, bearings, compass zones
   │  ├─ geometry.js          walls from rooms, openings on walls, rect helpers
   │  ├─ metrics.js           areas, coverage, FAR, validation checks
   │  ├─ commands.js          all document mutations (the command layer)
   │  ├─ generator.js         BHK × floors × plot → floor plans, doors, windows, furniture
   │  ├─ vastu.js             rule config + analysis + suggestions
   │  └─ cost.js              pricing config + estimate + material quantities
   ├─ state/store.js          document store, selection, undo/redo, transactions, events
   ├─ persistence/repo.js     DesignRepository (local), autosave, share links
   ├─ engine3d/
   │  ├─ materials3d.js       PBR materials + procedural textures (tiles, wood, marble, brick…)
   │  ├─ builders.js          site, slabs, walls with openings, doors, windows, stairs, roof, furniture
   │  └─ viewer.js            renderer, cameras & presets, picking, highlight, 3D dragging, compass
   ├─ plan2d/plan.js          SVG plan renderer + editing interactions + static export
   ├─ export/export.js        PNG/SVG/JSON export, printable report
   ├─ ui/                     dashboard, wizard, panels, inspector, dialogs
   └─ app.js                  bootstrap and routing
```

In the production TypeScript version each `js/<area>` becomes a package/folder with the same boundary
(`@buildcraft/core`, `@buildcraft/engine3d`, …).

## 14. Step-by-step implementation plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Core model, catalogs, orientation, wall derivation, metrics | v0.1 ✅ |
| 2 | Layout generator (1–4 BHK, custom, G to G+3, plot-adaptive), auto doors/windows/furniture | v0.1 ✅ |
| 3 | Store with commands, transactions, undo/redo; autosave; dashboard; wizard | v0.1 ✅ |
| 4 | 2D plan: rooms, walls, openings, furniture, dimensions, drag/resize/move-wall, compass, Vastu grid | v0.1 ✅ |
| 5 | 3D engine: site, slabs, walls with openings, doors, windows, stairs, roof, furniture, materials, picking, highlight, camera presets, 3D dragging | v0.1 ✅ |
| 6 | Inspector for every object type, materials & exterior configuration | v0.1 ✅ |
| 7 | Vastu engine + suggestions; cost engine + quantities; variants & compare; export & share | v0.1 ✅ |
| 8 | Port to TypeScript + React packages, unit tests for core (walls, generator, cost), E2E tests | next |
| 9 | Backend: designs/versions API, auth, share tokens, pricing & Vastu rule sets, thumbnails in S3 | next |
| 10 | Non-rectangular rooms (polygons), wall-first drawing tool, columns/beams, electrical & plumbing layers | later |
| 11 | GLTF furniture catalog, higher-fidelity materials, server renders, PDF service, DXF export | later |
| 12 | Platform integration: projects, requirements, quotation & approval workflows, BOQ export | later |

### Known v0.1 limitations

- Rooms are rectangles (L-shapes are made from two rooms). Walls follow room edges.
- Staircases are straight dog-leg flights inside a staircase room.
- Persistence is per browser (localStorage); share links carry a snapshot, not a live document.
- Prices and Vastu rules are illustrative defaults and must be configured for the business.
