/* 2D floor plan (SVG). planSVG() is a pure renderer (also used for export/reports);
   PlanView adds pan/zoom and direct manipulation that issues the same commands as 3D. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, O = HD.orient, Mo = HD.model, S = HD.store, Cmd = HD.cmd;
  const esc = U.esc;
  const f2 = (v) => Math.round(v * 1000) / 1000;

  /* ================= pure renderer ================= */
  function planSVG(design, floorId, opts = {}) {
    const f = design.floors.find((x) => x.id === floorId) || design.floors[0];
    const P = design.plot, W = P.width, D = P.depth;
    const sel = opts.selection, R = opts.northUp ? O.northUpRotation(P.facing) : 0;
    const cx = W / 2, cy = D / 2;
    const out = [];
    const text = (x, y, s, size, cls = "", extra = "") =>
      `<text x="${f2(x)}" y="${f2(y)}" font-size="${size}" class="${cls}" ${R ? `transform="rotate(${-R} ${f2(x)} ${f2(y)})"` : ""} ${extra}>${esc(s)}</text>`;
    const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id && (kind === "furniture" ? true : sel.floorId === f.id || kind === "plot");
    const walls = G.floorWalls(design, f);
    const env = Mo.envelope(P);
    const ground = f.level === 0;

    out.push(`<g id="plan-root" ${R ? `transform="rotate(${R} ${cx} ${cy})"` : ""}>`);
    // road
    const road = Math.min(P.roadWidth || 30, 14);
    out.push(`<rect x="-6" y="${D + 1.2}" width="${W + 12}" height="${road}" class="road"/>`);
    out.push(`<line x1="-6" y1="${D + 1.2 + road / 2}" x2="${W + 6}" y2="${D + 1.2 + road / 2}" class="road-line"/>`);
    out.push(text(W / 2, D + 1.2 + road / 2 - 0.9, `ROAD · ${U.fmtFt(P.roadWidth || 30)} wide`, 1.1, "road-label", `text-anchor="middle"`));
    // plot, compound & setbacks
    out.push(`<rect x="0" y="0" width="${W}" height="${D}" class="plot" data-kind="plot"/>`);
    if (design.exterior.compound.on) {
      const g = design.exterior.compound.gate, gc = g.center ?? W / 2, ga = U.clamp(gc - g.width / 2, 0.8, W - g.width - 0.8), gb = ga + g.width;
      const hasGate = g.style !== "none";
      out.push(`<path d="M${ga} ${D} L0 ${D} L0 0 L${W} 0 L${W} ${D} L${hasGate ? gb : ga} ${D}" class="compound" data-kind="compound"/>`);
      if (hasGate) {
        out.push(`<line x1="${ga}" y1="${D}" x2="${gb}" y2="${D}" class="gate" data-kind="gate"/>`);
        if (ground) out.push(text((ga + gb) / 2, D - 0.8, "GATE", 0.8, "tiny", `text-anchor="middle"`));
      }
    } else out.push(`<rect x="0" y="0" width="${W}" height="${D}" class="plot-line"/>`);
    out.push(`<rect x="${env.x}" y="${env.y}" width="${env.w}" height="${env.d}" class="setback"/>`);

    // site items (ground only)
    if (ground && opts.furniture !== false) design.site.items.forEach((it) => out.push(itemSVG(it, "site", isSel("furniture", it.id))));

    // floor below (ghost)
    if (f.level > 0) design.floors[f.level - 1].rooms.forEach((r) => out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.d}" class="ghost"/>`));

    // rooms
    const vastu = opts.vastu;
    f.rooms.forEach((r) => {
      const t = C.ROOM_TYPES[r.type] || C.ROOM_TYPES.custom;
      out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.d}" fill="${t.color}" class="room ${t.enclosed ? "" : "open"} ${r.type}" data-kind="room" data-id="${r.id}"/>`);
      if (r.type === "staircase") out.push(stairsSVG(r, f, design));
    });

    // vastu grid
    if (opts.vastuGrid && vastu && vastu.box) {
      const b = vastu.box, grid = O.zoneGrid(P.facing);
      const ZC = { NE: "#cfe6ff", N: "#dff0e3", E: "#e3f1d8", SE: "#ffd9c2", S: "#ffe9c7", SW: "#e8d8c8", W: "#e2e2f3", NW: "#e7ecef", C: "#fff5c7" };
      for (let rI = 0; rI < 3; rI++) for (let cI = 0; cI < 3; cI++) {
        const z = grid[rI][cI], x = b.x + (b.w * cI) / 3, y = b.y + (b.d * rI) / 3;
        out.push(`<rect x="${x}" y="${y}" width="${b.w / 3}" height="${b.d / 3}" fill="${ZC[z]}" class="vgrid"/>`);
        out.push(text(x + 0.6, y + 1.4, z, 1.2, "vzone"));
      }
    }

    // walls
    walls.forEach((w) => out.push(wallSVG(w, f, isSel("wall", w.id))));
    // openings
    f.openings.forEach((o) => {
      const w = G.wallOfOpening(walls, o);
      out.push(openingSVG(o, w, isSel("opening", o.id)));
    });
    // furniture
    if (opts.furniture !== false) f.furniture.forEach((it) => out.push(itemSVG(it, f.id, isSel("furniture", it.id))));

    // room labels
    f.rooms.forEach((r) => {
      const small = Math.min(r.w, r.d);
      const fs = U.clamp(small / 7, 0.55, 1.05);
      const lx = r.x + r.w / 2, ly = r.y + r.d / 2;
      let badge = "";
      if (opts.vastuGrid && vastu) {
        const v = vastu.items.find((i) => i.roomId === r.id);
        if (v) badge = ` <tspan class="vb ${v.status}">●</tspan>`;
      }
      out.push(`<g class="label" ${R ? `transform="rotate(${-R} ${f2(lx)} ${f2(ly)})"` : ""}>
        <text x="${f2(lx)}" y="${f2(ly - fs * 0.15)}" font-size="${fs}" class="rname" text-anchor="middle">${esc(r.name)}${badge}</text>
        <text x="${f2(lx)}" y="${f2(ly + fs * 1.05)}" font-size="${fs * 0.78}" class="rdim" text-anchor="middle">${U.fmtDims(r.w, r.d)}</text></g>`);
    });

    // dimensions
    if (opts.dims !== false) {
      out.push(dim(0, 0, W, 0, -2.4, U.fmtFt(W), R));
      out.push(dim(0, 0, 0, D, -2.4, U.fmtFt(D), R, true));
      const bb = U.bbox(f.rooms.filter((r) => r.type !== "parking"));
      if (bb) {
        out.push(dim(bb.x, bb.y, bb.x + bb.w, bb.y, -1.1, U.fmtFt(bb.w), R, false, "bdim"));
        out.push(dim(bb.x + bb.w, bb.y, bb.x + bb.w, bb.y + bb.d, 1.1, U.fmtFt(bb.d), R, true, "bdim", true));
      }
    }
    // direction labels on each side of the plot
    const sides = O.sideLabels(P.facing);
    out.push(text(W / 2, -4.2, O.DIR_NAMES[sides.top].toUpperCase(), 1, "side-dir", `text-anchor="middle"`));
    out.push(text(W / 2, D + road + 3.2, O.DIR_NAMES[sides.bottom].toUpperCase() + " (FRONT)", 1, "side-dir", `text-anchor="middle"`));
    out.push(text(-3.4, D / 2, O.DIR_NAMES[sides.left].toUpperCase(), 1, "side-dir", `text-anchor="end"`));
    out.push(text(W + 3.4, D / 2, O.DIR_NAMES[sides.right].toUpperCase(), 1, "side-dir", `text-anchor="start"`));

    // selection overlays
    if (sel && opts.interactive) {
      if (sel.kind === "room" && sel.floorId === f.id) {
        const r = f.rooms.find((x) => x.id === sel.id);
        if (r) {
          out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.d}" class="sel-room"/>`);
          out.push(dim(r.x, r.y, r.x + r.w, r.y, -0.9 - 0.2, U.fmtFt(r.w), R, false, "sdim"));
          out.push(dim(r.x, r.y, r.x, r.y + r.d, -0.9 - 0.2, U.fmtFt(r.d), R, true, "sdim"));
          const hs = opts.handle || 0.6;
          [["nw", r.x, r.y], ["n", r.x + r.w / 2, r.y], ["ne", r.x + r.w, r.y], ["e", r.x + r.w, r.y + r.d / 2], ["se", r.x + r.w, r.y + r.d], ["s", r.x + r.w / 2, r.y + r.d], ["sw", r.x, r.y + r.d], ["w", r.x, r.y + r.d / 2]].forEach(([h, x, y]) =>
            out.push(`<rect x="${f2(x - hs / 2)}" y="${f2(y - hs / 2)}" width="${hs}" height="${hs}" class="handle h-${h}" data-handle="${h}"/>`)
          );
        }
      }
      if (sel.kind === "wall" && sel.floorId === f.id) {
        const w = walls.find((x) => x.id === sel.id);
        if (w) {
          const [a, b] = G.wallEnds(w);
          out.push(dim(a.x, a.y, b.x, b.y, w.axis === "h" ? -1.4 : -1.4, U.fmtFt(w.len), R, w.axis === "v", "sdim"));
        }
      }
      if (sel.kind === "furniture") {
        const it = Cmd.itemsOf(design, sel.floorId).find((x) => x.id === sel.id);
        if (it && (sel.floorId === f.id || (sel.floorId === "site" && ground))) {
          const s = G.itemSize(it);
          out.push(`<g transform="translate(${it.x} ${it.y}) rotate(${it.rot || 0})"><line x1="0" y1="${-s.d / 2}" x2="0" y2="${-s.d / 2 - 1.4}" class="rot-stem"/><circle cx="0" cy="${-s.d / 2 - 1.6}" r="${(opts.handle || 0.6) * 0.6}" class="handle rot" data-handle="rot"/></g>`);
        }
      }
    }
    out.push(`</g>`);
    return out.join("");
  }

  function dim(x1, y1, x2, y2, off, label, R, vertical, cls = "dim", flip) {
    const nx = vertical ? off : 0, ny = vertical ? 0 : off;
    const a = { x: x1 + nx, y: y1 + ny }, b = { x: x2 + nx, y: y2 + ny };
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const t = 0.35;
    const tick = (p) => `<line x1="${f2(p.x - t)}" y1="${f2(p.y + t)}" x2="${f2(p.x + t)}" y2="${f2(p.y - t)}" class="${cls}-tick"/>`;
    const ext = (px, py, q) => `<line x1="${f2(px)}" y1="${f2(py)}" x2="${f2(q.x)}" y2="${f2(q.y)}" class="${cls}-ext"/>`;
    const tx = vertical ? mx + (flip ? 0.5 : -0.5) : mx, ty = vertical ? my : my - 0.35;
    const rot = vertical ? (R ? "" : `rotate(-90 ${f2(tx)} ${f2(ty)})`) : "";
    const counter = R ? `rotate(${-R} ${f2(tx)} ${f2(ty)})` : "";
    return `<g class="${cls}">${ext(x1, y1, a)}${ext(x2, y2, b)}<line x1="${f2(a.x)}" y1="${f2(a.y)}" x2="${f2(b.x)}" y2="${f2(b.y)}" class="${cls}-line"/>${tick(a)}${tick(b)}
      <text x="${f2(tx)}" y="${f2(ty)}" font-size="0.85" text-anchor="middle" class="${cls}-text" transform="${counter} ${rot}">${esc(label)}</text></g>`;
  }

  // along/normal helpers for walls
  const AX = (w) => (s, n) => (w.axis === "h" ? { x: s, y: w.line + n } : { x: w.line + n, y: s });

  function wallSVG(w, f, selected) {
    if (w.kind === "none") return "";
    const P = AX(w), t = w.thickness;
    const cls = `wall ${w.kind}${selected ? " selected" : ""}`;
    if (w.kind === "railing") {
      const a = P(w.a, -0.12), b = P(w.b, 0.12);
      return `<rect x="${f2(Math.min(a.x, b.x))}" y="${f2(Math.min(a.y, b.y))}" width="${f2(Math.abs(b.x - a.x))}" height="${f2(Math.abs(b.y - a.y))}" class="${cls}" data-kind="wall" data-id="${esc(w.id)}"/>`;
    }
    const ops = f.openings.filter((o) => G.onWall(o, w)).map((o) => [Math.max(w.a, o.center - o.width / 2), Math.min(w.b, o.center + o.width / 2)]).sort((p, q) => p[0] - q[0]);
    const ext = 0.375;
    const s0 = w.a - (w.contA ? 0 : ext), s1 = w.b + (w.contB ? 0 : ext);
    const segs = [];
    let s = s0;
    ops.forEach(([a, b]) => { if (a > s) segs.push([s, a]); s = Math.max(s, b); });
    if (s1 > s) segs.push([s, s1]);
    const hit = (() => { const a = P(w.a, -Math.max(t, 0.8) / 2), b = P(w.b, Math.max(t, 0.8) / 2); return `<rect x="${f2(Math.min(a.x, b.x))}" y="${f2(Math.min(a.y, b.y))}" width="${f2(Math.abs(b.x - a.x))}" height="${f2(Math.abs(b.y - a.y))}" class="wall-hit" data-kind="wall" data-id="${esc(w.id)}"/>`; })();
    return hit + segs.map(([a, b]) => {
      const p = P(a, -t / 2), q = P(b, t / 2);
      return `<rect x="${f2(Math.min(p.x, q.x))}" y="${f2(Math.min(p.y, q.y))}" width="${f2(Math.abs(q.x - p.x))}" height="${f2(Math.abs(q.y - p.y))}" class="${cls}" data-kind="wall" data-id="${esc(w.id)}"/>`;
    }).join("");
  }

  function openingSVG(o, w, selected) {
    if (!w) {
      const p = o.axis === "h" ? { x: o.center, y: o.line } : { x: o.line, y: o.center };
      return `<circle cx="${p.x}" cy="${p.y}" r="0.6" class="orphan" data-kind="opening" data-id="${o.id}"/>`;
    }
    const P = AX(w), t = w.thickness, s0 = o.center - o.width / 2, s1 = o.center + o.width / 2;
    const cls = `opening ${o.kind} ${o.style}${selected ? " selected" : ""}${o.main ? " main" : ""}`;
    const parts = [];
    const bb = (() => { const a = P(s0, -t / 2 - 0.1), b = P(s1, t / 2 + 0.1); return `<rect x="${f2(Math.min(a.x, b.x))}" y="${f2(Math.min(a.y, b.y))}" width="${f2(Math.abs(b.x - a.x))}" height="${f2(Math.abs(b.y - a.y))}" class="op-hit"/>`; })();
    parts.push(bb);
    const line = (p, q, c = "") => `<line x1="${f2(p.x)}" y1="${f2(p.y)}" x2="${f2(q.x)}" y2="${f2(q.y)}" class="${c}"/>`;
    const arc = (hs, dir, len, sgn) => {
      // quarter arc from the open leaf tip back to the closed position
      const pts = [];
      for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); pts.push(P(hs + dir * len * Math.sin(a), sgn * (t / 2 + len * Math.cos(a)))); }
      return `<polyline points="${pts.map((p) => f2(p.x) + "," + f2(p.y)).join(" ")}" class="swing"/>`;
    };
    if (o.kind === "window") {
      const a = P(s0, -t / 2), b = P(s1, t / 2);
      parts.push(`<rect x="${f2(Math.min(a.x, b.x))}" y="${f2(Math.min(a.y, b.y))}" width="${f2(Math.abs(b.x - a.x))}" height="${f2(Math.abs(b.y - a.y))}" class="win-frame"/>`);
      parts.push(line(P(s0, 0), P(s1, 0), "glass"));
      if (o.style === "sliding") { parts.push(line(P(s0, -0.1), P(o.center + 0.2, -0.1), "glass")); parts.push(line(P(o.center - 0.2, 0.1), P(s1, 0.1), "glass")); }
    } else {
      const sgn = o.swing > 0 ? 1 : -1;
      const hingeStart = o.hinge !== "end";
      if (o.style === "arch") {
        parts.push(line(P(s0, -t / 2), P(s0, t / 2), "jamb"), line(P(s1, -t / 2), P(s1, t / 2), "jamb"));
        parts.push(line(P(s0, 0), P(s1, 0), "arch-line"));
      } else if (o.style === "sliding") {
        parts.push(line(P(s0, -0.1), P(o.center + 0.3, -0.1), "leaf"), line(P(o.center - 0.3, 0.1), P(s1, 0.1), "leaf"));
      } else if (o.style === "double" || o.style === "french") {
        const lw = o.width / 2;
        parts.push(line(P(s0, sgn * t / 2), P(s0, sgn * (t / 2 + lw)), "leaf"), arc(s0, 1, lw, sgn));
        parts.push(line(P(s1, sgn * t / 2), P(s1, sgn * (t / 2 + lw)), "leaf"), arc(s1, -1, lw, sgn));
      } else {
        const hs = hingeStart ? s0 : s1, dir = hingeStart ? 1 : -1;
        parts.push(line(P(hs, sgn * t / 2), P(hs, sgn * (t / 2 + o.width)), "leaf"), arc(hs, dir, o.width, sgn));
      }
      if (o.main) {
        const m = P(o.center, (w.outside || 1) * (t / 2 + 1.1));
        parts.push(`<text x="${f2(m.x)}" y="${f2(m.y + 0.3)}" font-size="0.75" text-anchor="middle" class="main-label">MAIN</text>`);
      }
    }
    return `<g class="${cls}" data-kind="opening" data-id="${o.id}">${parts.join("")}</g>`;
  }

  function stairsSVG(r, f, design) {
    const alongY = r.d >= r.w, L = alongY ? r.d : r.w, Sx = alongY ? r.w : r.d;
    const doors = f.openings.filter((o) => o.kind === "door");
    const ax = alongY ? "h" : "v", end0 = alongY ? r.y : r.x;
    const nearEnd = doors.some((o) => o.axis === ax && U.near(o.line, end0, 0.06)) ? 0 : 1;
    const toP = (u, v) => { const uu = nearEnd === 1 ? L - u : u; return alongY ? { x: r.x + v, y: r.y + uu } : { x: r.x + uu, y: r.y + v }; };
    const N = Math.max(4, Math.ceil(f.height / 0.6)), n1 = Math.ceil(N / 2), n2 = N - n1;
    const landing = Math.min(3.5, L * 0.3), tr = (L - landing) / n1, tr2 = (L - landing) / n2;
    const ln = (a, b) => `<line x1="${f2(a.x)}" y1="${f2(a.y)}" x2="${f2(b.x)}" y2="${f2(b.y)}" class="stair"/>`;
    const out = [];
    if (Sx < 5) {
      for (let i = 1; i < N; i++) out.push(ln(toP((i * L) / N, 0), toP((i * L) / N, Sx)));
    } else {
      for (let i = 1; i <= n1; i++) out.push(ln(toP(i * tr, 0), toP(i * tr, Sx / 2)));
      for (let j = 1; j <= n2; j++) out.push(ln(toP(L - landing - j * tr2, Sx / 2), toP(L - landing - j * tr2, Sx)));
      out.push(ln(toP(0, Sx / 2), toP(L - landing, Sx / 2)));
      const a = toP(0.8, Sx / 4), b = toP(L - landing - 0.6, Sx / 4);
      out.push(`<line x1="${f2(a.x)}" y1="${f2(a.y)}" x2="${f2(b.x)}" y2="${f2(b.y)}" class="stair-arrow" marker-end="url(#arrow)"/>`);
      const lp = toP(1.2, Sx / 4 + 0.9);
      out.push(`<text x="${f2(lp.x)}" y="${f2(lp.y)}" font-size="0.7" class="tiny" text-anchor="middle">UP</text>`);
    }
    return out.join("");
  }

  function itemSVG(it, floorId, selected) {
    const def = C.FUR[it.type];
    if (!def) return "";
    const { w, d } = G.itemSize(it);
    const col = it.color || def.color;
    const fill = U.shade(col, 0.32), stroke = U.shade(col, -0.25);
    const x = -w / 2, y = -d / 2;
    const r = (rx, ry, rw, rh, c = "", extra = "") => `<rect x="${f2(rx)}" y="${f2(ry)}" width="${f2(rw)}" height="${f2(rh)}" class="${c}" ${extra}/>`;
    const parts = [];
    const base = `fill="${fill}" stroke="${stroke}"`;
    switch (def.shape) {
      case "bed":
        parts.push(r(x, y, w, d, "fu", base + ` rx="0.2"`));
        parts.push(r(x + 0.25, y + 0.3, w > 4 ? w / 2 - 0.4 : w - 0.5, 1, "fu-d"));
        if (w > 4) parts.push(r(0.15, y + 0.3, w / 2 - 0.4, 1, "fu-d"));
        parts.push(`<line x1="${x}" y1="${f2(y + d * 0.42)}" x2="${x + w}" y2="${f2(y + d * 0.42)}" class="fu-l"/>`);
        break;
      case "sofa": case "armchair": case "sofaL":
        parts.push(r(x, y, w, d, "fu", base + ` rx="0.3"`));
        parts.push(r(x, y, w, 0.7, "fu-d"));
        parts.push(r(x, y, 0.5, d, "fu-d"), r(x + w - 0.5, y, 0.5, d, "fu-d"));
        break;
      case "dining":
        parts.push(r(x, y, w, d, "fu", base + ` rx="0.25"`));
        for (let i = 0; i < 2; i++) { const cx = x + (w / 2) * (i + 0.5) - 0.6; parts.push(r(cx, y - 1.3, 1.2, 1.1, "fu-d"), r(cx, y + d + 0.2, 1.2, 1.1, "fu-d")); }
        if (def.seats === 6) parts.push(r(x - 1.3, -0.6, 1.1, 1.2, "fu-d"), r(x + w + 0.2, -0.6, 1.1, 1.2, "fu-d"));
        break;
      case "wc":
        parts.push(r(x, y, w, 0.6, "fu", base));
        parts.push(`<ellipse cx="0" cy="${f2(y + 0.6 + (d - 0.6) / 2)}" rx="${f2(w * 0.42)}" ry="${f2((d - 0.6) / 2)}" ${base} class="fu"/>`);
        break;
      case "basin":
        parts.push(r(x, y, w, d, "fu", base));
        parts.push(`<ellipse cx="0" cy="0.1" rx="${f2(w * 0.32)}" ry="${f2(d * 0.28)}" class="fu-d"/>`);
        break;
      case "counter":
        parts.push(r(x, y, w, d, "fu", base));
        if (def.hob) [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]].forEach(([a, b]) => parts.push(`<circle cx="${f2(w / 2 - 1.6 + a)}" cy="${f2(b)}" r="0.25" class="fu-l"/>`));
        if (def.sink && w >= 5) parts.push(r(x + 0.6, -0.55, 1.8, 1.1, "fu-d", `rx="0.15"`));
        break;
      case "car":
        parts.push(r(x, y, w, d, "fu", base + ` rx="1"`));
        parts.push(r(x + 0.5, y + d * 0.3, w - 1, d * 0.42, "fu-d", `rx="0.4"`));
        break;
      case "tree": case "palm": case "shrub": case "plant":
        parts.push(`<circle cx="0" cy="0" r="${f2(Math.min(w, d) / 2)}" fill="${U.shade(col, 0.2)}" stroke="${stroke}" class="fu tree" fill-opacity="0.75"/>`);
        if (def.shape !== "shrub") parts.push(`<circle cx="0" cy="0" r="${f2(Math.min(w, d) / 6)}" class="fu-d"/>`);
        break;
      case "wardrobe": case "shelf":
        parts.push(r(x, y, w, d, "fu", base));
        parts.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + d}" class="fu-l"/><line x1="${x + w}" y1="${y}" x2="${x}" y2="${y + d}" class="fu-l"/>`);
        break;
      case "rug":
        parts.push(r(x, y, w, d, "fu rug", `fill="${fill}" fill-opacity="0.5" stroke="${stroke}" stroke-dasharray="0.3 0.2"`));
        break;
      default:
        parts.push(r(x, y, w, d, "fu", base + ` rx="0.15"`));
    }
    return `<g class="item${selected ? " selected" : ""}" data-kind="furniture" data-id="${it.id}" data-floor="${floorId}" transform="translate(${f2(it.x)} ${f2(it.y)}) rotate(${it.rot || 0})">${parts.join("")}${selected ? r(x - 0.15, y - 0.15, w + 0.3, d + 0.3, "sel-item") : ""}</g>`;
  }

  const DEFS = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#5b6770"/></marker></defs>`;

  /** Standalone SVG document for export / reports. */
  function exportSVG(design, floorId, opts = {}) {
    const f = design.floors.find((x) => x.id === floorId) || design.floors[0];
    const P = design.plot;
    const vastu = opts.vastuGrid ? HD.vastu.analyze(design) : null;
    const inner = planSVG(design, f.id, { ...opts, vastu, interactive: false });
    const pad = 8, x0 = -pad, y0 = -pad, w = P.width + pad * 2, h = P.depth + 16 + pad * 2 + 6;
    const pxPerFt = opts.pxPerFt || 18;
    const northAng = ((180 - O.frontBearing(P.facing) + (opts.northUp ? O.northUpRotation(P.facing) : 0)) % 360 + 360) % 360;
    const title = `<g font-family="Inter, Arial, sans-serif"><text x="${x0 + 1}" y="${y0 + h - 2.6}" font-size="1.4" font-weight="700" fill="#17232d">${esc(design.name)} — ${esc(f.name)}</text>
      <text x="${x0 + 1}" y="${y0 + h - 1}" font-size="0.9" fill="#55636e">Plot ${U.fmtFt(P.width)} × ${U.fmtFt(P.depth)} · ${esc(C.FACINGS[P.facing].label)} · all dimensions in feet-inches</text>
      <g transform="translate(${x0 + w - 4} ${y0 + 4}) rotate(${northAng})"><circle r="2.6" fill="#fff" stroke="#17232d" stroke-width="0.12"/><path d="M0 -2.2 L0.8 0.6 L0 0 L-0.8 0.6 Z" fill="#c0392b"/><text y="-2.9" font-size="1.1" text-anchor="middle" font-weight="700" fill="#17232d" transform="rotate(${-northAng} 0 -3.2)">N</text></g></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * pxPerFt)}" height="${Math.round(h * pxPerFt)}"><style>${PLAN_CSS}</style>${DEFS}<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>${inner}${title}</svg>`;
  }

  // Styles used inside exported SVG (the app uses the same classes from app.css)
  const PLAN_CSS = `text{font-family:Inter,Arial,sans-serif}.road{fill:#d9dbdd}.road-line{stroke:#fff;stroke-width:.2;stroke-dasharray:1.5 1}.road-label{fill:#6b747c;font-weight:600;letter-spacing:.05em}
  .plot{fill:#eef3e6}.plot-line{fill:none;stroke:#8f9b84;stroke-width:.12}.compound{fill:none;stroke:#7b746a;stroke-width:.6}.gate{stroke:#2a2d30;stroke-width:.25;stroke-dasharray:.5 .3}.setback{fill:none;stroke:#9aa7b3;stroke-width:.08;stroke-dasharray:.6 .4}
  .ghost{fill:none;stroke:#b6bcc2;stroke-width:.08;stroke-dasharray:.4 .3}.room{stroke:none}.room.open{fill-opacity:.7}.wall{fill:#2f3a42}.wall.interior{fill:#4f5a62}.wall.railing{fill:#7a8a92}.wall.parapet{fill:#5f6a72}.wall-hit{fill:transparent}
  .opening .op-hit{fill:#fff}.win-frame{fill:#fff;stroke:#2f3a42;stroke-width:.06}.glass{stroke:#3d8fc6;stroke-width:.08}.leaf{stroke:#2f3a42;stroke-width:.1}.swing{fill:none;stroke:#7a8790;stroke-width:.05;stroke-dasharray:.25 .15}.jamb{stroke:#2f3a42;stroke-width:.08}.arch-line{stroke:#9aa4ab;stroke-width:.05;stroke-dasharray:.3 .2}.main-label{fill:#b0452f;font-weight:700}
  .stair{stroke:#8b8fa0;stroke-width:.05}.stair-arrow{stroke:#5b6770;stroke-width:.07}.fu{stroke-width:.06}.fu-d{fill:rgba(255,255,255,.55);stroke:rgba(0,0,0,.25);stroke-width:.04}.fu-l{fill:none;stroke:rgba(0,0,0,.3);stroke-width:.04}
  .rname{fill:#1f2b33;font-weight:600}.rdim{fill:#5a6770}.tiny{fill:#5b6770}.vgrid{fill-opacity:.45;stroke:#b9b0a0;stroke-width:.05}.vzone{fill:#8a7e6a;font-weight:700}
  .dim-line,.bdim-line{stroke:#6a7680;stroke-width:.05}.dim-ext,.bdim-ext{stroke:#9aa4ab;stroke-width:.04}.dim-tick,.bdim-tick{stroke:#44505a;stroke-width:.08}.dim-text,.bdim-text{fill:#44505a;font-weight:600}.side-dir{fill:#8a939a;font-weight:700;letter-spacing:.12em}
  .vb.ideal{fill:#2e9e5b}.vb.good{fill:#7fb24a}.vb.neutral{fill:#d8a13a}.vb.avoid{fill:#d24b3a}.orphan{fill:#d24b3a}`;

  /* ================= interactive view ================= */
  class PlanView {
    constructor(container) {
      this.el = container;
      this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.svg.classList.add("plan-svg");
      container.appendChild(this.svg);
      this.compass = document.createElement("div");
      this.compass.className = "compass2d";
      this.compass.innerHTML = `<div class="rose"><span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span><i></i></div>`;
      container.appendChild(this.compass);
      this.view = null; // {cx, cy, scale}
      this.lastSig = "";
      this.bind();
      new ResizeObserver(() => { this.applyViewBox(); }).observe(container);
    }

    fit() {
      const d = S.state.design;
      if (!d) return;
      const W = d.plot.width, D = d.plot.depth + 16;
      const cw = this.el.clientWidth || 600, ch = this.el.clientHeight || 400;
      const rot = S.state.ui.display.northUp ? O.northUpRotation(d.plot.facing) : 0;
      const swap = rot % 180 !== 0;
      const bw = (swap ? D : W) + 14, bh = (swap ? W : D) + 10;
      this.view = { cx: W / 2, cy: d.plot.depth / 2 + (swap ? 0 : 5), scale: Math.min(cw / bw, ch / bh) };
      this.applyViewBox();
    }
    applyViewBox() {
      if (!this.view) return;
      const cw = this.el.clientWidth || 600, ch = this.el.clientHeight || 400;
      const w = cw / this.view.scale, h = ch / this.view.scale;
      this.svg.setAttribute("viewBox", `${this.view.cx - w / 2} ${this.view.cy - h / 2} ${w} ${h}`);
    }

    render(st, force) {
      const d = st.design;
      if (!d) return;
      const f = S.activeFloor();
      const disp = st.ui.display;
      const vastu = disp.vastuGrid ? HD.vastu.analyze(d) : null;
      const handle = U.clamp(9 / (this.view?.scale || 10), 0.35, 1.4);
      const sig = JSON.stringify([f, d.plot, d.exterior.compound, d.site, d.settings, st.selection, disp, handle, f.level > 0 ? d.floors[f.level - 1].rooms : 0]);
      if (!force && sig === this.lastSig) return;
      this.lastSig = sig;
      if (!this.view) this.fit();
      this.svg.innerHTML = DEFS + planSVG(d, f.id, { selection: st.selection, interactive: true, vastuGrid: disp.vastuGrid, vastu, northUp: disp.northUp, dims: disp.dims, furniture: disp.furniture, handle });
      this.svg.classList.toggle("placing", !!st.ui.placeMode);
      const ang = ((180 - O.frontBearing(d.plot.facing) + (disp.northUp ? O.northUpRotation(d.plot.facing) : 0)) % 360 + 360) % 360;
      this.compass.firstElementChild.style.transform = `rotate(${ang}deg)`;
    }

    toPlan(e) {
      const root = this.svg.querySelector("#plan-root") || this.svg;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const m = root.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }

    snapLines(f, excludeId, axis) {
      const d = S.state.design, env = Mo.envelope(d.plot);
      const vals = axis === "x" ? [env.x, env.x + env.w, 0, d.plot.width] : [env.y, env.y + env.d, 0, d.plot.depth];
      f.rooms.forEach((r) => { if (r.id === excludeId) return; if (axis === "x") vals.push(r.x, r.x + r.w); else vals.push(r.y, r.y + r.d); });
      return vals;
    }
    snapVal(v, lines, tol) {
      let best = null;
      lines.forEach((l) => { const dd = Math.abs(l - v); if (dd <= tol && (best === null || dd < Math.abs(best - v))) best = l; });
      return best;
    }

    bind() {
      const svg = this.svg;
      let drag = null;
      svg.addEventListener("contextmenu", (e) => e.preventDefault());
      svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (!this.view) return;
        const before = this.clientToView(e);
        const k = e.deltaY > 0 ? 0.88 : 1.14;
        this.view.scale = U.clamp(this.view.scale * k, 2, 120);
        this.applyViewBox();
        const after = this.clientToView(e);
        this.view.cx += before.x - after.x; this.view.cy += before.y - after.y;
        this.applyViewBox();
        this.lastSig = ""; this.render(S.state);
      }, { passive: false });

      svg.addEventListener("pointerdown", (e) => {
        const st = S.state, d = st.design;
        if (!d) return;
        const f = S.activeFloor();
        const p = this.toPlan(e);
        const hEl = e.target.closest("[data-handle]");
        const kEl = e.target.closest("[data-kind]");
        const kind = kEl?.dataset.kind, id = kEl?.dataset.id;
        const start = { sx: e.clientX, sy: e.clientY, p };
        const ro = st.ui.readOnly;
        // placement mode: click a wall to insert a door/window
        if (st.ui.placeMode) {
          const walls = G.floorWalls(d, f);
          const near = G.nearestWall(walls, p.x, p.y, 1.5, (w) => w.kind === "interior" || w.kind === "exterior");
          if (near) {
            const pm = st.ui.placeMode;
            const nid = S.update((dd) => Cmd.addOpening(dd, f.id, near.wall, pm.kind, pm.style, near.pos));
            S.setUI({ placeMode: e.shiftKey ? pm : null });
            if (nid) S.select({ kind: "opening", id: nid, floorId: f.id });
          }
          return;
        }
        if (e.button === 2 || e.button === 1 || (!kEl && !hEl) || kind === "plot" || kind === "compound" || kind === "gate") {
          if (e.button === 0) {
            if (kind === "compound" || kind === "gate") S.select({ kind });
            else if (kind === "plot") S.select({ kind: "plot" });
            else S.select(null);
          }
          drag = { type: "pan", ...start, view: { ...this.view } };
          try { svg.setPointerCapture(e.pointerId); } catch (_) {}
          return;
        }
        if (hEl && !ro) {
          const h = hEl.dataset.handle, sel = st.selection;
          if (h === "rot") { drag = { type: "rot", ...start, sel }; }
          else { const r = Cmd.roomOf(f, sel.id); drag = { type: "resize", h, ...start, sel, r0: { ...r } }; }
          S.begin();
          try { svg.setPointerCapture(e.pointerId); } catch (_) {}
          return;
        }
        if (kind === "room") {
          const r = Cmd.roomOf(f, id);
          S.select({ kind: "room", id, floorId: f.id, facet: "floor" });
          if (!ro) drag = { type: "room", ...start, id, r0: { x: r.x, y: r.y, w: r.w, d: r.d } };
        } else if (kind === "wall") {
          S.select({ kind: "wall", id, floorId: f.id });
          const w = G.wallById(G.floorWalls(d, f), id);
          if (!ro && w && (w.kind === "interior" || w.kind === "exterior" || w.kind === "railing" || w.kind === "parapet")) drag = { type: "wall", ...start, wall: w, cur: w.line };
        } else if (kind === "opening") {
          S.select({ kind: "opening", id, floorId: f.id });
          const o = f.openings.find((x) => x.id === id);
          if (!ro && o) drag = { type: "opening", ...start, id };
        } else if (kind === "furniture") {
          const fid = kEl.dataset.floor;
          S.select({ kind: "furniture", id, floorId: fid });
          const it = Cmd.itemsOf(d, fid).find((x) => x.id === id);
          if (!ro && it) drag = { type: "item", ...start, id, fid, o: { x: it.x, y: it.y } };
        }
        if (drag) try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      });

      svg.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const st = S.state, d = st.design, f = S.activeFloor();
        if (drag.type === "pan") {
          // viewBox is unrotated (rotation lives inside #plan-root), so screen deltas map directly
          const k = this.view.scale;
          this.view.cx = drag.view.cx - (e.clientX - drag.sx) / k;
          this.view.cy = drag.view.cy - (e.clientY - drag.sy) / k;
          this.applyViewBox();
          return;
        }
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
        if (!drag.moved) { drag.moved = true; if (drag.type !== "resize" && drag.type !== "rot") S.begin(); }
        const p = this.toPlan(e);
        const dx = p.x - drag.p.x, dy = p.y - drag.p.y;
        const tol = 8 / this.view.scale;
        if (drag.type === "room") {
          let nx = U.snap(drag.r0.x + dx, 0.25), ny = U.snap(drag.r0.y + dy, 0.25);
          const lx = this.snapLines(f, drag.id, "x"), ly = this.snapLines(f, drag.id, "y");
          const sx = this.snapVal(nx, lx, tol) ?? (this.snapVal(nx + drag.r0.w, lx, tol) != null ? this.snapVal(nx + drag.r0.w, lx, tol) - drag.r0.w : null);
          const sy = this.snapVal(ny, ly, tol) ?? (this.snapVal(ny + drag.r0.d, ly, tol) != null ? this.snapVal(ny + drag.r0.d, ly, tol) - drag.r0.d : null);
          if (sx != null) nx = sx; if (sy != null) ny = sy;
          S.update((dd) => Cmd.moveRoom(dd, f.id, drag.id, nx, ny), { transient: true });
        } else if (drag.type === "resize") {
          const r0 = drag.r0, h = drag.h;
          let x0 = r0.x, y0 = r0.y, x1 = r0.x + r0.w, y1 = r0.y + r0.d;
          const lx = this.snapLines(f, r0.id, "x"), ly = this.snapLines(f, r0.id, "y");
          const sn = (v, lines) => this.snapVal(v, lines, tol) ?? U.snap(v, 0.25);
          if (h.includes("w")) x0 = Math.min(sn(r0.x + dx, lx), x1 - 2);
          if (h.includes("e")) x1 = Math.max(sn(r0.x + r0.w + dx, lx), x0 + 2);
          if (h.includes("n")) y0 = Math.min(sn(r0.y + dy, ly), y1 - 2);
          if (h.includes("s")) y1 = Math.max(sn(r0.y + r0.d + dy, ly), y0 + 2);
          S.update((dd) => Cmd.resizeRoom(dd, f.id, r0.id, { x: x0, y: y0, w: x1 - x0, d: y1 - y0 }), { transient: true });
        } else if (drag.type === "wall") {
          const w = drag.wall;
          const target = U.snap(w.line + (w.axis === "h" ? dy : dx), 0.25);
          S.update((dd) => {
            const ww = { ...w, line: drag.cur };
            const nl = Cmd.moveWall(dd, f.id, ww, target);
            if (nl != null) drag.cur = nl;
          }, { transient: true });
          const nw = G.floorWalls(S.state.design, S.activeFloor()).find((x) => x.axis === w.axis && U.near(x.line, drag.cur) && x.a < (w.a + w.b) / 2 && x.b > (w.a + w.b) / 2);
          if (nw) S.select({ kind: "wall", id: nw.id, floorId: f.id });
        } else if (drag.type === "opening") {
          const walls = G.floorWalls(d, f);
          const near = G.nearestWall(walls, p.x, p.y, 2.5, (w) => w.kind === "interior" || w.kind === "exterior");
          if (near) S.update((dd) => Cmd.moveOpening(dd, f.id, drag.id, near.wall, near.pos), { transient: true });
        } else if (drag.type === "item") {
          S.update((dd) => Cmd.moveItem(dd, drag.fid, drag.id, U.snap(drag.o.x + dx, 0.25), U.snap(drag.o.y + dy, 0.25)), { transient: true });
        } else if (drag.type === "rot") {
          const sel = drag.sel, it = Cmd.itemsOf(d, sel.floorId).find((x) => x.id === sel.id);
          if (it) {
            let a = (Math.atan2(p.x - it.x, -(p.y - it.y)) * 180) / Math.PI;
            a = e.shiftKey ? Math.round(a) : Math.round(a / 15) * 15;
            S.update((dd) => Cmd.updateItem(dd, sel.floorId, sel.id, { rot: ((a % 360) + 360) % 360 }), { transient: true });
          }
        }
      });
      const up = (e) => {
        if (!drag) return;
        if (drag.type !== "pan" && (drag.moved || drag.type === "resize" || drag.type === "rot")) S.end();
        try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
        drag = null;
      };
      svg.addEventListener("pointerup", up);
      svg.addEventListener("pointercancel", up);
    }
    clientToView(e) {
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(this.svg.getScreenCTM().inverse());
    }
    zoom(k) { if (this.view) { this.view.scale = U.clamp(this.view.scale * k, 2, 120); this.applyViewBox(); this.lastSig = ""; this.render(S.state); } }
  }

  HD.plan = { planSVG, exportSVG, PlanView, PLAN_CSS, DEFS };
})(window.HD);
