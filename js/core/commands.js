/* Command layer: every edit to a design goes through these functions.
   Each command mutates a draft copy of the document (the store clones before calling),
   so 2D, 3D and panels all share exactly the same editing behaviour. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, Mo = HD.model;
  const T = (r) => C.ROOM_TYPES[r.type] || C.ROOM_TYPES.custom;
  const MIN = 2; // absolute minimum room dimension while dragging (ft)

  const floorOf = (d, fid) => d.floors.find((f) => f.id === fid) || null;
  const roomOf = (f, id) => f?.rooms.find((r) => r.id === id) || null;
  const itemsOf = (d, fid) => (fid === "site" ? d.site.items : floorOf(d, fid)?.furniture || []);

  /* ---------------- Rooms ---------------- */

  function openingsOnEdges(f, r) {
    return f.openings.filter((o) =>
      o.axis === "h"
        ? (U.near(o.line, r.y, 0.06) || U.near(o.line, r.y + r.d, 0.06)) && o.center >= r.x - 0.01 && o.center <= r.x + r.w + 0.01
        : (U.near(o.line, r.x, 0.06) || U.near(o.line, r.x + r.w, 0.06)) && o.center >= r.y - 0.01 && o.center <= r.y + r.d + 0.01
    );
  }

  function moveRoom(d, fid, id, nx, ny) {
    const f = floorOf(d, fid), r = roomOf(f, id);
    if (!r) return;
    const dx = nx - r.x, dy = ny - r.y;
    if (!dx && !dy) return;
    openingsOnEdges(f, r).forEach((o) => {
      if (o.axis === "h") { o.line = U.r2(o.line + dy); o.center = U.r2(o.center + dx); }
      else { o.line = U.r2(o.line + dx); o.center = U.r2(o.center + dy); }
    });
    f.furniture.forEach((it) => { if (U.rectContainsPt(r, it.x, it.y)) { it.x = U.r2(it.x + dx); it.y = U.r2(it.y + dy); } });
    r.x = U.r2(nx); r.y = U.r2(ny);
  }

  function resizeRoom(d, fid, id, rect) {
    const f = floorOf(d, fid), r = roomOf(f, id);
    if (!r) return;
    const n = { x: U.r2(rect.x), y: U.r2(rect.y), w: U.r2(Math.max(MIN, rect.w)), d: U.r2(Math.max(MIN, rect.d)) };
    openingsOnEdges(f, r).forEach((o) => {
      if (o.axis === "h") {
        o.line = U.near(o.line, r.y, 0.06) ? n.y : n.y + n.d;
        o.center = U.clamp(o.center, n.x + o.width / 2, Math.max(n.x + o.width / 2, n.x + n.w - o.width / 2));
      } else {
        o.line = U.near(o.line, r.x, 0.06) ? n.x : n.x + n.w;
        o.center = U.clamp(o.center, n.y + o.width / 2, Math.max(n.y + o.width / 2, n.y + n.d - o.width / 2));
      }
    });
    f.furniture.forEach((it) => {
      if (U.rectContainsPt(r, it.x, it.y)) { it.x = U.clamp(it.x, n.x + 0.5, n.x + n.w - 0.5); it.y = U.clamp(it.y, n.y + 0.5, n.y + n.d - 0.5); }
    });
    Object.assign(r, n);
  }

  /** Move a wall line: resizes every room whose edge lies on that wall segment. */
  function moveWall(d, fid, wall, newLine) {
    const f = floorOf(d, fid);
    if (!f) return;
    const overl = (a, b) => Math.min(b, wall.b) - Math.max(a, wall.a) > 0.05;
    const posRooms = [], negRooms = [];
    f.rooms.forEach((r) => {
      if (wall.axis === "h") {
        if (U.near(r.y, wall.line) && overl(r.x, r.x + r.w)) posRooms.push(r);
        if (U.near(r.y + r.d, wall.line) && overl(r.x, r.x + r.w)) negRooms.push(r);
      } else {
        if (U.near(r.x, wall.line) && overl(r.y, r.y + r.d)) posRooms.push(r);
        if (U.near(r.x + r.w, wall.line) && overl(r.y, r.y + r.d)) negRooms.push(r);
      }
    });
    let lo = -Infinity, hi = Infinity;
    posRooms.forEach((r) => (hi = Math.min(hi, (wall.axis === "h" ? r.y + r.d : r.x + r.w) - MIN)));
    negRooms.forEach((r) => (lo = Math.max(lo, (wall.axis === "h" ? r.y : r.x) + MIN)));
    const nl = U.r2(U.clamp(newLine, lo, hi));
    const delta = nl - wall.line;
    if (!delta) return wall.line;
    f.openings.forEach((o) => { if (G.onWall(o, wall)) o.line = nl; });
    posRooms.forEach((r) => { if (wall.axis === "h") { r.y = nl; r.d = U.r2(r.d - delta); } else { r.x = nl; r.w = U.r2(r.w - delta); } });
    negRooms.forEach((r) => { if (wall.axis === "h") r.d = U.r2(nl - r.y); else r.w = U.r2(nl - r.x); });
    return nl;
  }

  /** Find a free spot for a w×d rect, preferring spots that touch existing rooms. */
  function findFreeSpot(d, f, w, dd, area) {
    const box = area || Mo.envelope(d.plot);
    let best = null;
    for (let y = box.y; y + dd <= box.y + box.d + 0.001; y += 0.5) {
      for (let x = box.x; x + w <= box.x + box.w + 0.001; x += 0.5) {
        const r = { x, y, w, d: dd };
        if (f.rooms.some((o) => U.rectOverlap(o, r, 0.01))) continue;
        let contact = 0;
        f.rooms.forEach((o) => {
          const ox = Math.min(o.x + o.w, x + w) - Math.max(o.x, x), oy = Math.min(o.y + o.d, y + dd) - Math.max(o.y, y);
          if ((U.near(o.x + o.w, x) || U.near(o.x, x + w)) && oy > 0) contact += oy;
          if ((U.near(o.y + o.d, y) || U.near(o.y, y + dd)) && ox > 0) contact += ox;
        });
        if (!best || contact > best.contact) best = { x, y, contact };
      }
    }
    return best;
  }

  function addRoom(d, fid, type, at) {
    const f = floorOf(d, fid);
    const t = C.ROOM_TYPES[type];
    if (!f || !t) return null;
    let [w, dd] = t.size;
    let spot = null;
    const area = type === "parking" ? { x: 0, y: 0, w: d.plot.width, d: d.plot.depth } : null;
    if (at) spot = { x: U.snap(at.x - w / 2), y: U.snap(at.y - dd / 2) };
    else {
      for (const k of [1, 0.8, 0.65]) {
        spot = findFreeSpot(d, f, U.snap(Math.max(t.min[0], w * k)), U.snap(Math.max(t.min[1], dd * k)), area);
        if (spot) { w = U.snap(Math.max(t.min[0], w * k)); dd = U.snap(Math.max(t.min[1], dd * k)); break; }
      }
      if (!spot) { const e = Mo.envelope(d.plot); spot = { x: U.snap(e.x + e.w / 2 - w / 2), y: U.snap(e.y + e.d / 2 - dd / 2) }; }
    }
    const n = f.rooms.filter((r) => r.type === type).length;
    const name = t.label + (n && !["living", "kitchen", "dining", "parking"].includes(type) ? " " + (n + 1) : "");
    const r = Mo.createRoom(type, spot.x, spot.y, w, dd, name);
    f.rooms.push(r);
    return r.id;
  }

  function duplicateRoom(d, fid, id) {
    const f = floorOf(d, fid), r = roomOf(f, id);
    if (!r) return null;
    const spot = findFreeSpot(d, f, r.w, r.d) || { x: r.x + 2, y: r.y + 2 };
    const n = Object.assign(U.clone(r), { id: U.uid("rm"), x: spot.x, y: spot.y, name: r.name + " copy" });
    f.rooms.push(n);
    return n.id;
  }

  function deleteRoom(d, fid, id) {
    const f = floorOf(d, fid), r = roomOf(f, id);
    if (!r) return;
    const edgeOps = openingsOnEdges(f, r);
    f.rooms = f.rooms.filter((x) => x.id !== id);
    f.furniture = f.furniture.filter((it) => !U.rectContainsPt(r, it.x, it.y));
    const walls = G.deriveWalls(f.rooms, d.settings);
    f.openings = f.openings.filter((o) => !edgeOps.includes(o) || G.wallOfOpening(walls, o));
  }

  function updateRoom(d, fid, id, patch) {
    const r = roomOf(floorOf(d, fid), id);
    if (!r) return;
    if (patch.type && patch.type !== r.type && (!patch.name && r.name === C.ROOM_TYPES[r.type].label)) patch.name = C.ROOM_TYPES[patch.type].label;
    Object.assign(r, patch);
  }

  /* ---------------- Openings ---------------- */

  function addOpening(d, fid, wall, kind, style, pos) {
    const f = floorOf(d, fid);
    if (!f || !wall) return null;
    const s = kind === "door" ? C.DOOR_STYLES[style || "single"] : C.WINDOW_STYLES[style || "casement"];
    const width = Math.min(s.width, Math.max(1.5, wall.len - 0.8));
    let center = pos;
    if (center == null) {
      const free = G.freeIntervals(f, wall).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
      center = free ? (free[0] + free[1]) / 2 : (wall.a + wall.b) / 2;
    }
    center = U.clamp(U.snap(center, 0.25), wall.a + width / 2 + 0.2, Math.max(wall.a + width / 2 + 0.2, wall.b - width / 2 - 0.2));
    const o = {
      id: U.uid(kind === "door" ? "dr" : "wn"),
      kind, style: style || (kind === "door" ? "single" : "casement"),
      axis: wall.axis, line: wall.line, center: U.r2(center),
      width: U.r2(width),
      height: kind === "door" ? (style === "arch" ? 7.5 : d.settings.doorHeight) : s.height,
      sill: kind === "door" ? 0 : s.sill,
      hinge: "start",
      swing: wall.outside ? -wall.outside : 1,
      main: false,
      material: null
    };
    f.openings.push(o);
    return o.id;
  }

  function updateOpening(d, fid, id, patch) {
    const f = floorOf(d, fid), o = f?.openings.find((x) => x.id === id);
    if (!o) return;
    if (patch.style && patch.style !== o.style) {
      const s = o.kind === "door" ? C.DOOR_STYLES[patch.style] : C.WINDOW_STYLES[patch.style];
      if (s) {
        if (patch.width == null) patch.width = s.width;
        if (o.kind === "window") { if (patch.height == null) patch.height = s.height; if (patch.sill == null) patch.sill = s.sill; }
        else if (patch.height == null) patch.height = patch.style === "arch" ? 7.5 : d.settings.doorHeight;
      }
    }
    if (patch.main) f.openings.forEach((x) => (x.main = false));
    Object.assign(o, patch);
    const walls = G.floorWalls(d, f), w = G.wallOfOpening(walls, o);
    if (w) {
      o.width = U.r2(U.clamp(o.width, 1, Math.max(1, w.len - 0.4)));
      o.center = U.r2(U.clamp(o.center, w.a + o.width / 2, Math.max(w.a + o.width / 2, w.b - o.width / 2)));
    }
  }

  function moveOpening(d, fid, id, wall, center) {
    const f = floorOf(d, fid), o = f?.openings.find((x) => x.id === id);
    if (!o || !wall) return;
    o.axis = wall.axis; o.line = wall.line;
    const half = Math.min(o.width / 2, wall.len / 2 - 0.1);
    o.center = U.r2(U.clamp(U.snap(center, 0.25), wall.a + half + 0.1, wall.b - half - 0.1));
  }

  function deleteOpening(d, fid, id) {
    const f = floorOf(d, fid);
    if (f) f.openings = f.openings.filter((o) => o.id !== id);
  }

  /* ---------------- Furniture & site items ---------------- */

  function addItem(d, fid, type, x, y, rot = 0) {
    const list = itemsOf(d, fid);
    const it = { id: U.uid("it"), type, x: U.r2(x), y: U.r2(y), rot, color: null };
    list.push(it);
    return it.id;
  }
  function updateItem(d, fid, id, patch) {
    const it = itemsOf(d, fid).find((x) => x.id === id);
    if (it) Object.assign(it, patch);
  }
  function moveItem(d, fid, id, x, y) { updateItem(d, fid, id, { x: U.r2(x), y: U.r2(y) }); }
  function rotateItem(d, fid, id, delta) {
    const it = itemsOf(d, fid).find((x) => x.id === id);
    if (it) it.rot = (((it.rot || 0) + delta) % 360 + 360) % 360;
  }
  function deleteItem(d, fid, id) {
    if (fid === "site") d.site.items = d.site.items.filter((x) => x.id !== id);
    else { const f = floorOf(d, fid); if (f) f.furniture = f.furniture.filter((x) => x.id !== id); }
  }
  function duplicateItem(d, fid, id) {
    const it = itemsOf(d, fid).find((x) => x.id === id);
    if (!it) return null;
    const n = Object.assign(U.clone(it), { id: U.uid("it"), x: it.x + 1.5, y: it.y + 1.5 });
    itemsOf(d, fid).push(n);
    return n.id;
  }

  /* ---------------- Floors ---------------- */

  function addFloor(d, mode = "copy") {
    const top = d.floors[d.floors.length - 1];
    const nf = Mo.createFloor(d.floors.length);
    nf.height = top.height;
    const idMap = {};
    const src = mode === "copy" ? top.rooms.filter((r) => r.type !== "parking" && r.type !== "sitout") : top.rooms.filter((r) => r.type === "staircase");
    src.forEach((r) => {
      const n = Object.assign(U.clone(r), { id: U.uid("rm") });
      idMap[r.id] = n.id;
      nf.rooms.push(n);
    });
    if (mode === "copy") {
      const walls = G.deriveWalls(nf.rooms, d.settings);
      top.openings.forEach((o) => { if (!o.main && G.wallOfOpening(walls, o)) nf.openings.push(Object.assign(U.clone(o), { id: U.uid(o.kind === "door" ? "dr" : "wn") })); });
    }
    d.floors.push(nf);
    return nf.id;
  }

  function deleteFloor(d, fid) {
    const i = d.floors.findIndex((f) => f.id === fid);
    if (i <= 0) return;
    d.floors.splice(i, 1);
    d.floors.forEach((f, k) => {
      if (f.name === Mo.floorName(f.level)) f.name = Mo.floorName(k);
      f.level = k;
    });
  }

  function updateFloor(d, fid, patch) {
    const f = floorOf(d, fid);
    if (f) Object.assign(f, patch);
  }

  /* ---------------- Whole-design ---------------- */

  /** Mirror left↔right about the buildable envelope's centre line (setbacks are regulatory, so they stay). */
  function mirrorLayout(d) {
    const env = Mo.envelope(d.plot);
    const W = 2 * env.x + env.w; // x' = W - x mirrors about env centre
    const P = d.plot.width;
    const mx = (x) => U.r2(U.clamp(W - x, 0, P));
    d.floors.forEach((f) => {
      f.rooms.forEach((r) => (r.x = U.r2(U.clamp(W - r.x - r.w, 0, P - r.w))));
      f.openings.forEach((o) => {
        if (o.axis === "h") { o.center = mx(o.center); o.hinge = o.hinge === "start" ? "end" : "start"; }
        else { o.line = mx(o.line); o.swing = -o.swing; }
      });
      f.furniture.forEach((it) => { it.x = mx(it.x); it.rot = (360 - (it.rot || 0)) % 360; });
    });
    d.site.items.forEach((it) => { it.x = mx(it.x); it.rot = (360 - (it.rot || 0)) % 360; });
    const g = d.exterior.compound.gate;
    if (g.center != null) g.center = mx(g.center);
  }

  function setPlot(d, patch) {
    Object.assign(d.plot, patch);
    if (patch.setbacks) d.plot.setbacks = Object.assign({}, d.plot.setbacks, patch.setbacks);
  }

  HD.cmd = {
    floorOf, roomOf, itemsOf,
    moveRoom, resizeRoom, moveWall, addRoom, duplicateRoom, deleteRoom, updateRoom, findFreeSpot,
    addOpening, updateOpening, moveOpening, deleteOpening,
    addItem, updateItem, moveItem, rotateItem, deleteItem, duplicateItem,
    addFloor, deleteFloor, updateFloor, mirrorLayout, setPlot
  };
})(window.HD);
