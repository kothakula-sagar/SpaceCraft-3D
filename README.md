# BuildCraft Home Designer (v0.1)

Interactive 3D home and building configurator for a construction and real-estate platform.
Plain HTML, CSS and JavaScript. There is no build step and nothing to install; three.js loads from a CDN.

## Run

Open `index.html` in Chrome, Edge or Firefox. The first load needs internet access for three.js and the font.
You can also serve the folder with any static server (for example `npx http-server home-designer`).
A server is required for share links to open on other computers.

## Workflow

Dashboard → **New design** wizard (plot → BHK and floors → facing → options) → the editor opens with a generated plan.

Editor steps: Plot · Layout · Rooms · Doors & Windows · Furniture · Materials · Exterior · Vastu · Cost · Review & Share.
The steps are a guide, not a lock: every tool is available at any time.

- **2D / Split / 3D** views stay in sync. Anything edited in one view updates the other immediately.
- **Click anything** in the plan or the 3D view to edit it in the Inspector on the right:
  - room or flooring
  - wall
  - door or window
  - furniture
  - ceiling
  - roof, compound wall, gate or plot
- **Direct editing:**
  - drag rooms (they snap to neighbours)
  - resize rooms with their handles
  - drag a wall to resize the rooms on both sides
  - slide doors and windows along a wall
  - move and rotate furniture
  - in 3D, drag furniture; for rooms and openings, click once to select, then drag
- **Place doors and windows:** choose a style, then click a wall (Shift-click to place several).
- **Keyboard:**
  - <kbd>Del</kbd> delete
  - <kbd>R</kbd> rotate
  - <kbd>Ctrl D</kbd> duplicate
  - arrow keys nudge
  - <kbd>Ctrl Z</kbd> / <kbd>Ctrl Y</kbd> undo / redo
  - <kbd>Esc</kbd> deselect
- **Floors:** tabs above the view. Show "Up to this floor" (cut-away) or "All floors".
- **Cameras:** 3D orbit, Top, Front, Side, Rear, Interior. The sun slider moves the sun according to the plot's facing.
- **Autosave:** changes save to this browser, and reopening a design continues where you stopped.
  Designs can be duplicated, turned into variants (Design A/B/C) and compared.
- **Export:** 2D plan (SVG/PNG), 3D image (PNG), JSON, and a printable design summary (print it to PDF).
- **Share:** a view-only link with the design embedded; the receiver can make their own copy.

## Code map

See `docs/ARCHITECTURE.md`. It covers the stack, data model, 2D↔3D sync, selection, orientation, multi-floor, cost, persistence, export and the roadmap.

```
js/core/        pure logic: model, catalog, geometry (walls from rooms), orientation, commands,
                generator, vastu (rules as data), cost (pricing as data), metrics & checks
js/state/       store: design + selection + undo/redo transactions
js/persistence/ DesignRepository (localStorage) · autosave · share links
js/engine3d/    three.js builders, materials, viewer (picking, highlight, drag, cameras)
js/plan2d/      SVG plan renderer + interactions + vector export
js/export/      PNG/SVG/JSON exports and printable report
js/ui/          panels, inspector, editor shell, dashboard & wizard, dialogs
```

Vastu rules and pricing are editable JSON in the app (Vastu → "Configure Vastu rules", Cost → "Configure pricing rules").
Prices and Vastu guidance are illustrative defaults.
