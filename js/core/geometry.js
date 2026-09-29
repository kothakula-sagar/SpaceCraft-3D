/* Geometry: walls are DERIVED from room rectangles, never stored.
   A wall is a maximal segment on one grid line with the same rooms on both sides.
   axis 'h' = runs along x at y = line; axis 'v' = runs along y at x = line.
   "pos" side = +y (for h) or +x (for v); "neg" side = the opposite. */
(function (HD) {
  const U = HD.util, C = HD.catalog;
  const K = (v) => Math.round(v * 100) / 100;
  const cache = new Map();

  function roomType(r) { return C.ROOM_TYPES[r.type] || C.ROOM_TYPES.custom; }

  function classify(pos, neg) {
    const pe = !!(pos && roomType(pos).enclosed), ne = !!(neg && roomType(neg).enclosed);
    if (pe || ne) return pe && ne ? "interior" : "exterior";
    if (pos && neg) return "none";
    return roomType(pos || neg).edge || "none";
  }

  function deriveWalls(rooms, settings) {
    const key = JSON.stringify(rooms.map((r) => [r.id, r.type, r.x, r.y, r.w, r.d])) + (settings ? settings.extWall + "," + settings.intWall : "");
    if (cache.has(key)) return cache.get(key);
    const lines = { h: new Map(), v: new Map() };
    const add = (axis, line, a, b, room, side) => {
      const k = K(line);
      if (!lines[axis].has(k)) lines[axis].set(k, []);
      lines[axis].get(k).push({ a: K(a), b: K(b), room, side });
    };
    rooms.forEach((r) => {
      if (r.w <= 0 || r.d <= 0) return;
      add("h", r.y, r.x, r.x + r.w, r, +1);
      add("h", r.y + r.d, r.x, r.x + r.w, r, -1);
      add("v", r.x, r.y, r.y + r.d, r, +1);
      add("v", r.x + r.w, r.y, r.y + r.d, r, -1);
    });
    const walls = [];
    const ext = settings?.extWall ?? 0.75, int = settings?.intWall ?? 0.375;
    for (const axis of ["h", "v"]) {
      for (const [line, entries] of lines[axis]) {
        const pts = [...new Set(entries.flatMap((e) => [e.a, e.b]))].sort((p, q) => p - q);
        let cur = null;
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1], m = (a + b) / 2;
          if (b - a < 0.01) continue;
          const pos = entries.find((e) => e.side > 0 && e.a <= m && e.b >= m)?.room || null;
          const neg = entries.find((e) => e.side < 0 && e.a <= m && e.b >= m)?.room || null;
          if (!pos && !neg) { cur = null; continue; }
          if (cur && U.near(cur.b, a, 0.001) && cur.pos === pos && cur.neg === neg) { cur.b = b; continue; }
          cur = { a, b, pos, neg };
          segs.push(cur);
        }
        segs.forEach((s, i) => {
          const kind = classify(s.pos, s.neg);
          const prev = segs[i - 1], next = segs[i + 1];
          walls.push({
            id: `${axis}${line}:${s.a}-${s.b}`,
            axis, line, a: s.a, b: s.b, len: U.r2(s.b - s.a),
            pos: s.pos ? s.pos.id : null, neg: s.neg ? s.neg.id : null,
            kind,
            thickness: kind === "interior" ? int : kind === "exterior" ? ext : kind === "parapet" ? 0.5 : 0.15,
            // outside: +1 if the outside/open side is the pos side, -1 if neg, 0 if interior
            outside: kind === "interior" ? 0 : (s.pos && roomType(s.pos).enclosed ? -1 : +1),
            contA: !!(prev && U.near(prev.b, s.a, 0.001)),
            contB: !!(next && U.near(next.a, s.b, 0.001))
          });
        });
      }
    }
    if (cache.size > 60) cache.clear();
    cache.set(key, walls);
    return walls;
  }

  const floorWalls = (design, floor) => deriveWalls(floor.rooms, design.settings);

  function onWall(o, w, eps = 0.06) {
    return o.axis === w.axis && Math.abs(o.line - w.line) <= eps && o.center >= w.a - 0.01 && o.center <= w.b + 0.01;
  }
  function openingsOnWall(floor, w) { return floor.openings.filter((o) => onWall(o, w)); }
  function wallOfOpening(walls, o) {
    return walls.find((w) => w.kind !== "none" && onWall(o, w)) || null;
  }
  function wallById(walls, id) { return walls.find((w) => w.id === id) || null; }
  function roomWalls(walls, roomId) { return walls.filter((w) => w.pos === roomId || w.neg === roomId); }

  /** Nearest wall to a plan point, returning the projected position along the wall. */
  function nearestWall(walls, x, y, maxDist = 2, filter) {
    let best = null;
    walls.forEach((w) => {
      if (w.kind === "none" || (filter && !filter(w))) return;
      const along = w.axis === "h" ? x : y, across = w.axis === "h" ? y : x;
      const p = U.clamp(along, w.a, w.b);
      const dist = Math.hypot(along - p, across - w.line);
      if (dist <= maxDist && (!best || dist < best.dist)) best = { wall: w, pos: p, dist };
    });
    return best;
  }

  /** Free intervals along a wall not covered by openings (with margin). */
  function freeIntervals(floor, w, excludeId, margin = 0.6) {
    const occ = openingsOnWall(floor, w)
      .filter((o) => o.id !== excludeId)
      .map((o) => [o.center - o.width / 2 - margin, o.center + o.width / 2 + margin])
      .sort((p, q) => p[0] - q[0]);
    const out = [];
    let s = w.a + 0.4;
    occ.forEach(([a, b]) => { if (a > s) out.push([s, a]); s = Math.max(s, b); });
    if (w.b - 0.4 > s) out.push([s, w.b - 0.4]);
    return out;
  }

  /** Other room across a wall from the given room. */
  function otherSide(w, roomId) { return w.pos === roomId ? w.neg : w.pos; }

  /** Plan-space endpoints of a wall. */
  function wallEnds(w) {
    return w.axis === "h" ? [{ x: w.a, y: w.line }, { x: w.b, y: w.line }] : [{ x: w.line, y: w.a }, { x: w.line, y: w.b }];
  }

  /** Room edges as {edge, axis, line, a, b} — top/bottom/left/right in plan. */
  function roomEdges(r) {
    return [
      { edge: "top", axis: "h", line: r.y, a: r.x, b: r.x + r.w, inward: +1 },
      { edge: "bottom", axis: "h", line: r.y + r.d, a: r.x, b: r.x + r.w, inward: -1 },
      { edge: "left", axis: "v", line: r.x, a: r.y, b: r.y + r.d, inward: +1 },
      { edge: "right", axis: "v", line: r.x + r.w, a: r.y, b: r.y + r.d, inward: -1 }
    ];
  }

  /** Axis-aligned footprint of a (possibly rotated by 90° steps) furniture item. */
  function itemRect(it) {
    const def = C.FUR[it.type] || { size: [2, 2, 2] };
    const w = it.w ?? def.size[0], d = it.d ?? def.size[1];
    const rot = (((it.rot || 0) % 360) + 360) % 360;
    const rad = (rot * Math.PI) / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    const W = c * w + s * d, D = s * w + c * d;
    return { x: it.x - W / 2, y: it.y - D / 2, w: W, d: D };
  }
  function itemSize(it) {
    const def = C.FUR[it.type] || { size: [2, 2, 2] };
    return { w: it.w ?? def.size[0], d: it.d ?? def.size[1], h: it.h ?? def.size[2] };
  }

  function roomAt(floor, x, y) {
    // smallest room containing the point (so nested/overlapping picks the specific one)
    return floor.rooms.filter((r) => U.rectContainsPt(r, x, y)).sort((a, b) => a.w * a.d - b.w * b.d)[0] || null;
  }

  HD.geo = { deriveWalls, floorWalls, openingsOnWall, wallOfOpening, wallById, roomWalls, nearestWall, freeIntervals, otherSide, wallEnds, roomEdges, itemRect, itemSize, roomAt, onWall, roomType };
})(window.HD);
