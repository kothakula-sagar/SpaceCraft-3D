/* Layout generator: plot + BHK + floors → rooms, doors, windows, furniture, site.
   Band-based planning (road at the bottom):
     back band   : bedrooms + bathrooms (private)
     passage     : circulation spine (2+ BHK)
     middle band : dining, kitchen+utility, pooja (+ staircase at the same spot on every floor)
     front band  : living + sit-out (ground) / terrace or bedroom + balcony (upper floors)
   Every room touches the passage or a common room, so doors can always be placed.
   Finally the plan is mirrored if that improves the Vastu score for the chosen facing. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, Mo = HD.model, Cmd = HD.cmd;
  const snap = (v) => U.snap(v, 0.5);

  const TARGET_AREA = { 1: 650, 2: 1050, 3: 1500, 4: 2000 };

  /* ---------- band layout ---------- */
  function layoutBand(items, x0, x1, y0, y1) {
    const W = x1 - x0;
    const fixed = U.sum(items.filter((i) => i.fixed), (i) => i.fixed);
    const wsum = U.sum(items.filter((i) => !i.fixed), (i) => i.w || 1);
    const rest = Math.max(0, W - fixed);
    let x = x0;
    const out = [];
    items.forEach((it, i) => {
      const w = i === items.length - 1 ? x1 - x : snap(it.fixed ?? (rest * (it.w || 1)) / wsum);
      const xa = x, xb = x + w;
      x = xb;
      if (it.stack) {
        const hs = U.sum(it.stack, (s) => s.h || 1);
        let y = y0;
        it.stack.forEach((s, j) => {
          const h = j === it.stack.length - 1 ? y1 - y : snap(((y1 - y0) * (s.h || 1)) / hs);
          out.push({ ...s, x: xa, y, w: xb - xa, d: h });
          y += h;
        });
      } else out.push({ ...it, x: xa, y: y0, w: xb - xa, d: y1 - y0 });
    });
    return out;
  }

  /* ---------- templates ---------- */
  function groundBands(b, B, multi, corridor, midDepth) {
    // kitchen + utility stack; utility is dropped when the band is too shallow for both
    const kit = (w) => (midDepth >= 10 ? { w, stack: [{ t: "utility", h: 0.35, access: ["kitchen"] }, { t: "kitchen", h: 0.65 }] } : { t: "kitchen", w });
    const back =
      b <= 1
        ? [{ t: "master", w: 0.6, name: B === 1 ? "Bedroom" : "Master Bedroom" }, { w: 0.4, stack: [{ t: "bathroom", name: "Bathroom", h: 0.55, access: ["master"] }, { t: "store", h: 0.45 }] }]
        : b === 2 || b === 3
        ? [{ t: "master", w: 0.41 }, { w: 0.18, stack: [{ t: "bathroom", name: "Attached Bath", access: ["master"] }, { t: "bathroom", name: "Common Bath", access: ["passage", "dining"] }] }, { t: "bedroom", w: 0.41 }]
        : [{ t: "master", w: 0.3 }, { w: 0.15, stack: [{ t: "bathroom", name: "Attached Bath", access: ["master"] }, { t: "bathroom", name: "Common Bath", access: ["passage", "dining"] }] }, { t: "bedroom", w: 0.27 }, { t: "bedroom", w: 0.28 }];
    let middle;
    if (!corridor) middle = [{ t: "kitchen", w: 0.42 }, { t: "dining", w: 0.58 }];
    else if (b >= 3) middle = [{ t: "bedroom", w: 0.32 }, { t: "bathroom", w: 0.14, access: ["bedroom"] }, { t: "dining", w: 0.28 }, kit(0.26)];
    else if (multi) middle = [{ t: "dining", w: 0.55 }, kit(0.45)];
    else middle = [{ t: "pooja", w: 0.15 }, { t: "dining", w: 0.5 }, kit(0.35)];
    if (multi) middle.push({ t: "staircase", fixed: 8 });
    const front =
      !corridor || b >= 3 || multi
        ? [{ t: "pooja", w: 0.15 }, { t: "living", w: 0.53 }, { t: "sitout", w: 0.32 }]
        : [{ t: "living", w: 0.64 }, { t: "sitout", w: 0.36 }];
    return { back, middle, front };
  }

  function upperBands(b) {
    const back =
      b === 0
        ? [{ t: "lounge", w: 0.6, name: "Family Lounge" }, { w: 0.4, stack: [{ t: "bathroom", name: "Common Bath", access: ["passage", "lounge"] }, { t: "store" }] }]
        : b === 1
        ? [{ t: "bedroom", w: 0.6 }, { w: 0.4, stack: [{ t: "bathroom", name: "Attached Bath", access: ["bedroom"] }, { t: "store", name: "Dress / Store", access: ["passage", "bedroom"] }] }]
        : [{ t: "bedroom", w: 0.41 }, { w: 0.18, stack: [{ t: "bathroom", name: "Attached Bath", access: ["bedroom"] }, { t: "bathroom", name: "Common Bath", access: ["passage", "lounge"] }] }, { t: "bedroom", w: 0.41 }];
    const middle =
      b >= 3 ? [{ t: "bedroom", w: 0.5 }, { t: "bathroom", w: 0.18, access: ["bedroom"] }, { t: "utility", w: 0.32 }]
      : b === 0 ? [{ t: "study", w: 0.55 }, { t: "utility", w: 0.45 }]
      : [{ t: "lounge", w: 0.72, name: "Family Lounge" }, { t: "utility", w: 0.28 }];
    middle.push({ t: "staircase", fixed: 8 });
    const front = b >= 4 ? [{ t: "bedroom", w: 0.6 }, { t: "balcony", w: 0.4 }] : [{ t: "lounge", w: 0.55, name: "Home Theatre / Lounge" }, { t: "balcony", w: 0.45 }];
    return { back, middle, front };
  }

  /* ---------- doors ---------- */
  // For each room: groups of neighbour types; one door per group (first match wins).
  const ACCESS = {
    master: [["passage", "lounge", "dining", "living"]],
    bedroom: [["passage", "lounge", "dining", "living"]],
    bathroom: [["master", "bedroom", "passage", "dining", "lounge"]],
    kitchen: [["dining", "living", "passage"]],
    utility: [["kitchen", "passage", "dining"]],
    pooja: [["dining", "living", "passage", "lounge"]],
    store: [["passage", "dining", "kitchen", "lounge", "living"]],
    dining: [["passage", "living"]],
    living: [["sitout"], ["dining", "passage", "staircase"]],
    staircase: [["passage", "dining", "lounge", "living"]],
    lounge: [["passage", "staircase", "lounge", "study", "utility"], ["balcony", "terrace"]],
    study: [["passage", "lounge"]],
    balcony: [["master", "bedroom", "lounge", "living"]],
    terrace: [["lounge", "passage", "staircase", "study", "bedroom"]],
    passage: [["staircase", "lounge"]],
    custom: [["passage", "dining", "living", "lounge"]]
  };
  const OPEN = new Set(["dining", "passage", "staircase", "lounge", "living"]);

  function doorStyleFor(a, b) {
    const types = [a.type, b.type];
    const has = (t) => types.includes(t);
    if (has("living") && has("sitout")) return { style: "main", width: 3.5, main: true };
    if (has("balcony") || has("terrace")) return { style: "sliding", width: 5 };
    if (has("bathroom")) return { style: "single", width: 2.5 };
    if (has("pooja")) return { style: "double", width: 3.5 };
    if (has("utility") || has("store")) return { style: "single", width: 2.5 };
    if (has("kitchen") && (has("dining") || has("living"))) return { style: "arch", width: 3.5 };
    if (OPEN.has(a.type) && OPEN.has(b.type)) return { style: "arch", width: a.type === "living" || b.type === "living" ? 5 : 4 };
    return { style: "single", width: 3 };
  }

  function autoOpenings(d, f, hints = {}) {
    const walls = G.floorWalls(d, f);
    const byId = Object.fromEntries(f.rooms.map((r) => [r.id, r]));
    const done = new Set();
    const hasDoorBetween = (a, b) => done.has([a, b].sort().join("|"));
    f.rooms.forEach((r) => {
      const groups = hints[r.id] ? [hints[r.id]] : ACCESS[r.type] || [];
      groups.forEach((prefs) => {
        const cands = G.roomWalls(walls, r.id)
          .filter((w) => w.kind !== "none" && w.kind !== "railing" && w.kind !== "parapet")
          .map((w) => ({ w, other: byId[G.otherSide(w, r.id)] }))
          .filter((c) => c.other && prefs.includes(c.other.type) && !hasDoorBetween(r.id, c.other.id))
          .map((c) => ({ ...c, st: doorStyleFor(r, c.other) }))
          .filter((c) => c.w.len >= c.st.width + 0.8)
          .sort((p, q) => prefs.indexOf(p.other.type) - prefs.indexOf(q.other.type) || q.w.len - p.w.len);
        const c = cands[0];
        if (!c) return;
        const { w, other, st } = c;
        let center = (w.a + w.b) / 2;
        if (st.style !== "arch" && w.len > st.width + 4) {
          // hinge-side corner placement, towards the other room's centre
          const oc = w.axis === "h" ? other.x + other.w / 2 : other.y + other.d / 2;
          center = oc < (w.a + w.b) / 2 ? w.a + 0.6 + st.width / 2 : w.b - 0.6 - st.width / 2;
        }
        const id = Cmd.addOpening(d, f.id, w, "door", st.style, center);
        const o = f.openings.find((x) => x.id === id);
        o.width = Math.min(st.width, w.len - 0.6);
        o.swing = w.pos === r.id ? 1 : -1;
        if (st.main) { o.main = true; o.width = st.width; }
        done.add([r.id, other.id].sort().join("|"));
      });
    });
    // Ground floor must have a main entrance
    if (f.level === 0 && !f.openings.some((o) => o.main)) {
      const lr = f.rooms.find((r) => r.type === "living") || f.rooms.find((r) => C.ROOM_TYPES[r.type].enclosed);
      if (lr) {
        const w = G.roomWalls(walls, lr.id).filter((w) => w.kind === "exterior").sort((p, q) => (q.axis === "h" && q.outside === 1) - (p.axis === "h" && p.outside === 1) || q.len - p.len)[0];
        if (w) { const id = Cmd.addOpening(d, f.id, w, "door", "main"); const o = f.openings.find((x) => x.id === id); o.main = true; o.swing = w.pos === lr.id ? 1 : -1; }
      }
    }
    // Windows on exterior walls
    const walls2 = G.floorWalls(d, f);
    f.rooms.forEach((r) => {
      const t = C.ROOM_TYPES[r.type];
      if (!t.enclosed || ["passage", "pooja"].includes(r.type)) return;
      const ext = G.roomWalls(walls2, r.id)
        .filter((w) => w.kind === "exterior" && !G.otherSide(w, r.id))
        .sort((p, q) => q.len - p.len);
      const max = ["living", "master", "lounge"].includes(r.type) ? 2 : 1;
      let placed = 0;
      for (const w of ext) {
        if (placed >= max) break;
        let style = "casement", width = Math.min(5, w.len - 2);
        if (["bathroom", "utility", "store"].includes(r.type)) { style = "ventilator"; width = 2; }
        else if (r.type === "kitchen") { style = "sliding"; width = Math.min(4, w.len - 2); }
        else if (r.type === "living" || r.type === "lounge") { style = "sliding"; width = Math.min(6, w.len - 2); }
        else if (r.type === "staircase") { style = "fixed"; width = Math.min(3, w.len - 2); }
        if (width < 1.5) continue;
        const free = G.freeIntervals(f, w).filter(([a, b]) => b - a >= width).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
        if (!free) continue;
        const id = Cmd.addOpening(d, f.id, w, "window", style, (free[0] + free[1]) / 2);
        const o = f.openings.find((x) => x.id === id);
        o.width = U.r2(width);
        if (r.type === "kitchen") { o.sill = 3.5; o.height = 3.5; }
        if (r.type === "staircase") { o.sill = 4; o.height = 4; }
        placed++;
      }
    });
  }

  /* ---------- furniture ---------- */
  function furnishRoom(d, f, r, walls) {
    const placed = f.furniture.filter((it) => U.rectContainsPt(r, it.x, it.y)).map((it) => G.itemRect(it));
    const edges = G.roomEdges(r);
    const doors = f.openings.filter((o) => o.kind === "door");
    const ops = f.openings;
    // door swing clearance zones
    doors.forEach((o) => {
      edges.forEach((e) => {
        if (e.axis !== o.axis || !U.near(e.line, o.line, 0.06) || o.center < e.a || o.center > e.b) return;
        const depth = o.style === "arch" ? 2.5 : Math.min(o.width + 0.3, 3.5);
        if (e.axis === "h") placed.push({ x: o.center - o.width / 2, y: e.inward > 0 ? e.line : e.line - depth, w: o.width, d: depth });
        else placed.push({ x: e.inward > 0 ? e.line : e.line - depth, y: o.center - o.width / 2, w: depth, d: o.width });
      });
    });
    const inset = 0.3;
    const edgeInfo = edges.map((e) => {
      const onEdge = ops.filter((o) => o.axis === e.axis && U.near(o.line, e.line, 0.06) && o.center >= e.a && o.center <= e.b);
      return { ...e, doors: onEdge.filter((o) => o.kind === "door"), wins: onEdge.filter((o) => o.kind === "window"), len: e.b - e.a };
    });
    const ROT = { top: 0, right: 90, bottom: 180, left: 270 };

    function fits(rect) {
      if (rect.x < r.x + 0.1 || rect.y < r.y + 0.1 || rect.x + rect.w > r.x + r.w - 0.1 || rect.y + rect.d > r.y + r.d - 0.1) return false;
      return !placed.some((p) => U.rectOverlap(p, rect, 0.02));
    }
    function rectAt(e, along, w, dd) {
      if (e.edge === "top") return { x: along - w / 2, y: r.y + inset, w, d: dd };
      if (e.edge === "bottom") return { x: along - w / 2, y: r.y + r.d - inset - dd, w, d: dd };
      if (e.edge === "left") return { x: r.x + inset, y: along - w / 2, w: dd, d: w };
      return { x: r.x + r.w - inset - dd, y: along - w / 2, w: dd, d: w };
    }
    function put(type, rect, rot, extra) {
      const it = { id: U.uid("it"), type, x: U.r2(rect.x + rect.w / 2), y: U.r2(rect.y + rect.d / 2), rot, color: null, ...extra };
      f.furniture.push(it);
      placed.push(rect);
      return { it, rect };
    }
    /** place against the best wall; prefer = "center" | "start" | "end" */
    function againstWall(type, opts = {}) {
      const def = C.FUR[type];
      const w = opts.w ?? def.size[0], dd = def.size[1], tall = (opts.h ?? def.size[2]) > 3.2;
      const order = edgeInfo
        .filter((e) => !opts.edges || opts.edges.includes(e.edge))
        .map((e) => ({ e, score: e.len - e.doors.length * 60 - (tall ? e.wins.length * 40 : 0) + (opts.avoidEdge === e.edge ? -200 : 0) }))
        .sort((p, q) => q.score - p.score);
      for (const { e } of order) {
        const lo = e.a + w / 2 + inset, hi = e.b - w / 2 - inset;
        if (hi < lo) continue;
        const mid = (e.a + e.b) / 2;
        const tries = opts.prefer === "start" ? [lo, mid, hi] : opts.prefer === "end" ? [hi, mid, lo] : [mid, lo, hi, (lo + mid) / 2, (mid + hi) / 2];
        for (const along of tries) {
          const rect = rectAt(e, along, w, dd);
          if (fits(rect)) return { ...put(type, rect, ROT[e.edge], opts.w ? { w: opts.w } : {}), edge: e, along };
        }
      }
      return null;
    }
    function atCenter(type, rot = 0) {
      const def = C.FUR[type];
      const W = rot % 180 ? def.size[1] : def.size[0], D = rot % 180 ? def.size[0] : def.size[1];
      const rect = { x: r.x + r.w / 2 - W / 2, y: r.y + r.d / 2 - D / 2, w: W, d: D };
      return fits(rect) ? put(type, rect, rot) : null;
    }
    const minDim = Math.min(r.w, r.d), area = r.w * r.d;
    const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };

    switch (r.type) {
      case "master":
      case "bedroom": {
        const bedType = r.type === "master" ? (minDim >= 11.5 ? "bedKing" : "bedQueen") : minDim >= 10 ? "bedQueen" : "bedSingle";
        const bed = againstWall(bedType);
        if (bed && bedType !== "bedSingle") {
          const bw = C.FUR[bedType].size[0];
          [-1, 1].forEach((s) => {
            const along = bed.along + s * (bw / 2 + 0.85);
            const rect = rectAt(bed.edge, along, 1.5, 1.5);
            if (fits(rect)) put("sideTable", rect, ROT[bed.edge.edge]);
          });
        }
        againstWall("wardrobe", { w: Math.min(6, Math.max(4, minDim - 5)), prefer: "start", avoidEdge: bed?.edge.edge });
        if (area >= 150) againstWall("studyDesk", { avoidEdge: bed?.edge.edge });
        break;
      }
      case "living":
      case "lounge": {
        const sofa = againstWall(area >= 230 && r.type === "living" ? "sofaL" : "sofa3");
        if (sofa) {
          const e = sofa.edge;
          const sd = C.FUR[sofa.it.type].size[1];
          const rect =
            e.edge === "top" ? { x: sofa.it.x - 2, y: sofa.rect.y + sd + 1.3, w: 4, d: 2 }
            : e.edge === "bottom" ? { x: sofa.it.x - 2, y: sofa.rect.y - 1.3 - 2, w: 4, d: 2 }
            : e.edge === "left" ? { x: sofa.rect.x + sd + 1.3, y: sofa.it.y - 2, w: 2, d: 4 }
            : { x: sofa.rect.x - 1.3 - 2, y: sofa.it.y - 2, w: 2, d: 4 };
          if (fits(rect)) put("coffeeTable", rect, e.edge === "left" || e.edge === "right" ? 90 : 0);
          againstWall("tvUnit", { edges: [opposite[e.edge]] }) || againstWall("tvUnit", {});
        }
        againstWall("plant", { prefer: "end" });
        break;
      }
      case "dining": {
        const rot = r.d > r.w ? 90 : 0;
        (area >= 90 && minDim >= 8.5 ? atCenter("dining6", rot) : null) || atCenter("dining4", rot);
        break;
      }
      case "kitchen": {
        const e = edgeInfo.filter((x) => x.doors.length === 0).sort((p, q) => q.len - p.len)[0];
        const len = e ? Math.min(10, U.snap(e.len - 0.8, 0.5)) : 6;
        againstWall("counter", { w: Math.max(4, len), edges: e ? [e.edge] : undefined }) || againstWall("counter", { w: 5 });
        againstWall("fridge", { prefer: "end" });
        break;
      }
      case "bathroom":
        againstWall("wc", { prefer: "end" });
        againstWall("basin", { prefer: "start" });
        if (area >= 40) againstWall("shower", { prefer: "end" });
        break;
      case "pooja": againstWall("poojaUnit"); break;
      case "utility": againstWall("washer", { prefer: "start" }); break;
      case "study": againstWall("studyDesk"); againstWall("bookshelf", { prefer: "start" }); break;
      case "store": againstWall("bookshelf", { prefer: "start" }); break;
      case "sitout": (area >= 55 ? againstWall("swing") : null) || againstWall("outChair"); againstWall("plant", { prefer: "end" }); break;
      case "balcony": case "terrace": againstWall("plant", { prefer: "start" }); againstWall("plant", { prefer: "end" }); againstWall("outChair"); break;
      case "parking": atCenter("car", r.d >= r.w ? 0 : 90); break;
    }
  }

  function autoFurnish(d, f) {
    const walls = G.floorWalls(d, f);
    f.rooms.forEach((r) => furnishRoom(d, f, r, walls));
  }

  /* ---------- site ---------- */
  function autoSite(d) {
    const P = d.plot, g = d.floors[0];
    const bb = U.bbox(g.rooms.filter((r) => r.type !== "parking")) || Mo.envelope(P);
    const parking = g.rooms.find((r) => r.type === "parking");
    const main = g.openings.find((o) => o.main);
    const gate = d.exterior.compound.gate;
    if (parking) { gate.center = U.r2(parking.x + parking.w / 2); gate.width = Math.min(12, Math.max(9, parking.w)); gate.style = "sliding"; }
    else { gate.center = U.r2(main && main.axis === "h" ? main.center : bb.x + bb.w / 2); gate.width = 6; gate.style = "swing"; }
    d.site.items = [];
    const add = (type, x, y) => { if (x > 1 && x < P.width - 1 && y > 1 && y < P.depth - 1) Cmd.addItem(d, "site", type, x, y); };
    const rear = bb.y, front = P.depth - (bb.y + bb.d);
    if (rear >= 5) { add("tree", 3.2, rear / 2); add("tree", P.width - 3.2, rear / 2); }
    if (front >= 6) {
      const farSide = gate.center > P.width / 2 ? 3 : P.width - 3;
      add(front >= 10 ? "palm" : "shrub", farSide, P.depth - 2.5);
      for (let x = 2; x < P.width - 2; x += 3.5) if (Math.abs(x - gate.center) > gate.width / 2 + 2 && Math.abs(x - farSide) > 3) add("shrub", x, P.depth - 1.6);
    }
    const sides = [bb.x, P.width - (bb.x + bb.w)];
    if (sides[0] >= 4) add("shrub", sides[0] / 2, bb.y + bb.d / 2);
    if (sides[1] >= 4) add("shrub", P.width - sides[1] / 2, bb.y + bb.d / 2);
  }

  /* ---------- main entry ---------- */
  /** Regenerates floors of `d` in place. opts: { bhk: 1..4|'custom', floors, vastu, furnish, parking } */
  function generate(d, opts) {
    const bhk = opts.bhk, n = Math.max(1, Math.min(4, opts.floors || 1));
    const env = Mo.envelope(d.plot);
    d.floors = [];
    for (let i = 0; i < n; i++) d.floors.push(Mo.createFloor(i));
    d.site.items = [];
    d.meta.bhk = bhk;
    if (bhk === "custom") {
      d.floors[0].rooms.push(Mo.createRoom("living", env.x, U.snap(env.y + env.d - 14), Math.min(16, env.w), Math.min(14, env.d), "Living Room"));
      autoOpenings(d, d.floors[0]);
      autoSite(d);
      return d;
    }
    const B = Math.max(1, Math.min(4, +bhk));

    // Footprint sized to the programme, not always the whole envelope
    const perFloor = Math.max((TARGET_AREA[B] / n) * 1.2, B >= 2 ? 720 : 520);
    const corridor = B >= 2 || n > 1;
    const multi = n > 1;
    // minimum depth that keeps rooms usable: back 10 + passage + middle (staircase 11) + front 11
    const minDepth = 10 + (corridor ? 3.5 : 0) + (multi ? 11 : 8) + 11;
    let fw = env.w, fd = env.d;
    if (env.w * env.d > perFloor * 1.2) {
      fd = Math.min(env.d, Math.max(minDepth, perFloor / fw));
      if (fd * fw > perFloor * 1.25) fw = Math.min(env.w, Math.max(24, perFloor / fd));
    }
    fw = snap(fw); fd = snap(fd);
    const fx = snap(env.x + (env.w - fw) / 2), fy = snap(env.y);

    // Bedrooms per floor
    const beds = [];
    if (n === 1) beds.push(B);
    else {
      const g = B >= 4 ? 2 : 1;
      beds.push(g);
      const R = B - g, k = n - 1;
      for (let i = 0; i < k; i++) beds.push(Math.floor(R / k) + (i < R % k ? 1 : 0));
    }
    // Band depths (identical on all floors so the staircase aligns)
    const pass = corridor ? 3.5 : 0;
    const D = fd - pass;
    const mid = multi ? 11 : Math.max(8, snap(D * 0.27));
    const rest = D - mid;
    const back = snap(rest * 0.48);
    const front = rest - back;
    const yB0 = fy, yB1 = fy + back, yP1 = yB1 + pass, yM1 = yP1 + mid, yF1 = fy + fd;

    const counters = { bedroom: 1, bathroom: 0 };
    d.floors.forEach((f, i) => {
      const b = beds[i];
      const bands = i === 0 ? groundBands(b, B, multi, corridor, mid) : upperBands(b);
      const hints = {};
      const specs = [
        ...layoutBand(bands.back, fx, fx + fw, yB0, yB1),
        ...(corridor ? layoutBand([{ t: "passage", w: 1, name: "Passage" }], fx, fx + fw, yB1, yP1) : []),
        ...layoutBand(bands.middle, fx, fx + fw, yP1, yM1),
        ...layoutBand(bands.front, fx, fx + fw, yM1, yF1)
      ];
      specs.forEach((s) => {
        let name = s.name;
        if (!name) {
          if (s.t === "bedroom") name = `Bedroom ${++counters.bedroom}`;
          else if (s.t === "bathroom") name = `Bath ${++counters.bathroom}`;
          else if (s.t === "master") name = "Master Bedroom";
        }
        const r = Mo.createRoom(s.t, U.r2(s.x), U.r2(s.y), U.r2(s.w), U.r2(s.d), name);
        f.rooms.push(r);
        if (s.access) hints[r.id] = s.access;
      });
      // ground: car parking in the front yard when there is room
      if (i === 0 && opts.parking !== false) {
        const frontSpace = d.plot.depth - yF1;
        if (frontSpace >= 16) {
          const pw = snap(Math.min(11, fw * 0.45)), pd = Math.min(18, frontSpace - 1.5);
          f.rooms.push(Mo.createRoom("parking", U.r2(fx + fw - pw), U.r2(yF1), U.r2(pw), U.r2(snap(pd)), "Car Parking"));
        }
      }
      autoOpenings(d, f, hints);
      if (opts.furnish !== false) autoFurnish(d, f);
    });
    autoSite(d);

    if (opts.vastu !== false) {
      const s0 = HD.vastu.analyze(d).score;
      const m = U.clone(d);
      Cmd.mirrorLayout(m);
      if (HD.vastu.analyze(m).score > s0) Cmd.mirrorLayout(d);
    }
    d.name = d.name || `${B} BHK`;
    return d;
  }

  HD.gen = { generate, autoOpenings, autoFurnish, autoSite, furnishRoom, layoutBand, doorStyleFor };
})(window.HD);
