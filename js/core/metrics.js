/* Metrics (areas, coverage, FAR) and design validation checks. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, Mo = HD.model;
  const T = (r) => C.ROOM_TYPES[r.type] || C.ROOM_TYPES.custom;

  function floorStats(design, floor) {
    const t = design.settings.intWall;
    let enclosed = 0, carpet = 0, balcony = 0, open = 0;
    floor.rooms.forEach((r) => {
      const a = r.w * r.d;
      if (T(r).enclosed) { enclosed += a; carpet += Math.max(0, r.w - t) * Math.max(0, r.d - t); }
      else if (r.type === "balcony" || r.type === "sitout") balcony += a;
      else open += a;
    });
    return { enclosed, carpet, balcony, open, builtUp: enclosed + balcony };
  }

  function designStats(design) {
    const plotArea = design.plot.width * design.plot.depth;
    const floors = design.floors.map((f) => ({ id: f.id, name: f.name, ...floorStats(design, f) }));
    const builtUp = U.sum(floors, (f) => f.builtUp);
    const carpet = U.sum(floors, (f) => f.carpet);
    const ground = design.floors[0];
    const footprint = ground ? U.sum(ground.rooms.filter((r) => T(r).enclosed || r.type === "sitout"), (r) => r.w * r.d) : 0;
    const all = design.floors.flatMap((f) => f.rooms);
    const count = (...types) => all.filter((r) => types.includes(r.type)).length;
    return {
      plotArea, floors, builtUp, carpet, footprint,
      coverage: plotArea ? footprint / plotArea : 0,
      far: plotArea ? builtUp / plotArea : 0,
      bedrooms: count("master", "bedroom"),
      bathrooms: count("bathroom"),
      rooms: all.length,
      doors: U.sum(design.floors, (f) => f.openings.filter((o) => o.kind === "door").length),
      windows: U.sum(design.floors, (f) => f.openings.filter((o) => o.kind === "window").length),
      furniture: U.sum(design.floors, (f) => f.furniture.length)
    };
  }

  function validate(design) {
    const out = [];
    const env = Mo.envelope(design.plot);
    const P = design.plot;
    const add = (level, msg, ref) => out.push({ level, msg, ref });
    const hasStairs = design.floors.some((f) => f.rooms.some((r) => r.type === "staircase"));
    if (design.floors.length > 1 && !hasStairs) add("warn", "Multi-floor design has no staircase.", null);

    design.floors.forEach((f, fi) => {
      const walls = G.floorWalls(design, f);
      const ref = (r) => ({ kind: "room", id: r.id, floorId: f.id });
      f.rooms.forEach((r, i) => {
        const t = T(r);
        if (r.x < -0.01 || r.y < -0.01 || r.x + r.w > P.width + 0.01 || r.y + r.d > P.depth + 0.01)
          add("error", `${r.name} (${f.name}) extends outside the plot.`, ref(r));
        else if (t.enclosed && (r.x < env.x - 0.05 || r.y < env.y - 0.05 || r.x + r.w > env.x + env.w + 0.05 || r.y + r.d > env.y + env.d + 0.05))
          add("warn", `${r.name} (${f.name}) crosses the setback line.`, ref(r));
        if (r.w < t.min[0] - 0.01 || r.d < t.min[1] - 0.01) {
          const mn = Math.min(t.min[0], t.min[1]), mx = Math.max(t.min[0], t.min[1]);
          if (Math.min(r.w, r.d) < mn - 0.01 || Math.max(r.w, r.d) < mx - 0.01) add("info", `${r.name} is smaller than the usual minimum (${U.fmtDims(t.min[0], t.min[1])}).`, ref(r));
        }
        for (let j = i + 1; j < f.rooms.length; j++) {
          if (U.rectOverlap(r, f.rooms[j], 0.05)) add("warn", `${r.name} overlaps ${f.rooms[j].name} (${f.name}).`, ref(r));
        }
        if (t.enclosed && r.type !== "passage") {
          const rw = G.roomWalls(walls, r.id);
          const hasDoor = f.openings.some((o) => o.kind === "door" && rw.some((w) => G.onWall(o, w)));
          if (!hasDoor) add("warn", `${r.name} (${f.name}) has no door.`, ref(r));
          if (["master", "bedroom", "living", "kitchen"].includes(r.type)) {
            const hasWin = f.openings.some((o) => (o.kind === "window" || o.style === "french" || o.style === "sliding") && rw.some((w) => w.kind === "exterior" && G.onWall(o, w)));
            if (!hasWin) add("info", `${r.name} (${f.name}) has no window for light and ventilation.`, ref(r));
          }
        }
        if (fi > 0 && t.enclosed) {
          const below = design.floors[fi - 1].rooms;
          const cx = r.x + r.w / 2, cy = r.y + r.d / 2;
          if (!below.some((b) => U.rectOverlap(b, r))) add("info", `${r.name} (${f.name}) has no structure below it.`, ref(r));
          else if (!below.some((b) => U.rectContainsPt(b, cx, cy))) add("info", `${r.name} (${f.name}) is partly cantilevered.`, ref(r));
        }
      });
      f.openings.forEach((o) => {
        if (!G.wallOfOpening(walls, o)) add("warn", `A ${o.kind} on ${f.name} is not attached to any wall.`, { kind: "opening", id: o.id, floorId: f.id });
      });
    });
    const g = design.floors[0];
    if (g && !g.openings.some((o) => o.main)) add("warn", "No main entrance door is marked on the ground floor.", null);
    return out;
  }

  HD.metrics = { floorStats, designStats, validate };
})(window.HD);
