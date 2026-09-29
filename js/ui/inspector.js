/* Right panel: property inspector for the selected object (registry: kind → editor) + design checks. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, O = HD.orient, Mo = HD.model, S = HD.store, Cmd = HD.cmd, UI = HD.ui;
  const esc = U.esc, A = UI.A;
  const upd = (fn) => S.update(fn);

  const EDGE_NORMAL = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

  UI.inspectors = {};

  UI.renderRight = (st) => {
    const d = st.design, sel = st.selection, ro = st.ui.readOnly;
    const fn = sel && UI.inspectors[sel.kind];
    const body = fn ? fn(st, d, sel, ro) : UI.inspectors.none(st, d, ro);
    const checks = HD.metrics.validate(d);
    const n = checks.filter((c) => c.level !== "info").length;
    return `<div class="insp">${body}</div>
      <details class="checks" ${n ? "open" : ""}><summary>Design checks <span class="badge ${n ? "warn" : "ok"}">${n ? n + " to review" : "OK"}</span></summary>
      ${checks.length ? checks.slice(0, 40).map((c) => `<div class="check ${c.level}" ${c.ref ? `data-act="select"${A({ sel: c.ref })}` : ""}><i>${c.level === "error" ? "⛔" : c.level === "warn" ? "⚠️" : "ℹ️"}</i><span>${esc(c.msg)}</span></div>`).join("") : `<p class="hint ok">✓ No issues found.</p>`}</details>`;
  };

  const head = (icon, title, sub, color) => `<div class="insp-head"><i style="${color ? `background:${color}` : ""}">${icon}</i><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>`;
  const matPicker = (label, cats, current, isDefault, act, args, ro, resetAct) =>
    UI.section(label, UI.swatches(C.matsOf(...cats).map((m) => m.id), current, act, args, { disabled: ro }) + (resetAct && !isDefault ? UI.btn("Use design default", resetAct, args, { cls: "small ghost", disabled: ro }) : ""), { right: `${esc(C.MAT[current]?.name || "")}${isDefault ? " <small>(default)</small>" : ""}` });

  /* ---------- nothing selected ---------- */
  UI.inspectors.none = (st, d) => {
    const f = S.activeFloor(), fs = HD.metrics.floorStats(d, f);
    return head("ⓘ", "Properties", "Click anything in the plan or the 3D view") +
      UI.section(esc(f.name), `<div class="stats">${UI.stat("Built-up", U.fmtArea(fs.builtUp))}${UI.stat("Carpet", U.fmtArea(fs.carpet))}${UI.stat("Rooms", f.rooms.length)}${UI.stat("Height", U.fmtFt(f.height))}</div>`) +
      UI.section("What you can click", `<ul class="howto"><li><b>Room / floor</b> – size, position, flooring, wall paint, ceiling</li><li><b>Wall</b> – length, position, finishes, add doors & windows</li><li><b>Door / window</b> – type, size, position, opening direction</li><li><b>Furniture</b> – position, rotation, size, colour</li><li><b>Roof, compound wall, gate, plot</b> – exterior options</li></ul>
      <p class="hint">Shortcuts: <kbd>Del</kbd> delete · <kbd>R</kbd> rotate · <kbd>Ctrl D</kbd> duplicate · arrows nudge · <kbd>Ctrl Z</kbd>/<kbd>Ctrl Y</kbd> undo/redo · <kbd>Esc</kbd> deselect</p>`);
  };

  /* ---------- room ---------- */
  UI.inspectors.room = (st, d, sel, ro) => {
    const f = Cmd.floorOf(d, sel.floorId), r = Cmd.roomOf(f, sel.id);
    if (!r) return UI.inspectors.none(st, d, ro);
    const t = C.ROOM_TYPES[r.type];
    const walls = G.floorWalls(d, f);
    const v = HD.vastu.analyze(d).items.find((i) => i.roomId === r.id);
    const P = d.plot;
    const fm = Mo.roomFloorMat(d, r), wm = Mo.roomWallMat(d, r), cm = Mo.roomCeilMat(d, r);
    const edges = G.roomEdges(r).map((e) => {
      const n = EDGE_NORMAL[e.edge];
      const dir = O.dirOf(O.bearingOf(P.facing, n[0], n[1]));
      const ws = G.roomWalls(walls, r.id).filter((w) => w.axis === e.axis && U.near(w.line, e.line));
      return { e, dir, ws };
    });
    const furn = f.furniture.filter((it) => U.rectContainsPt(r, it.x, it.y));
    const floorFirst = sel.facet === "floor" || sel.facet === "stairs";
    const sections = [
      UI.section("Room", `${UI.text("Name", r.name, "roomSet", { id: r.id, k: "name" }, { disabled: ro })}
        ${UI.select("Type", r.type, Object.fromEntries(Object.entries(C.ROOM_TYPES).map(([k, x]) => [k, x.label])), "roomSet", { id: r.id, k: "type" }, { disabled: ro })}`),
      UI.section("Size & position", `<div class="grid2">${UI.num("Width", r.w, "roomSet", { id: r.id, k: "w" }, { min: 2, disabled: ro })}${UI.num("Depth", r.d, "roomSet", { id: r.id, k: "d" }, { min: 2, disabled: ro })}
        ${UI.num("From left boundary", r.x, "roomSet", { id: r.id, k: "x" }, { disabled: ro })}${UI.num("From rear boundary", r.y, "roomSet", { id: r.id, k: "y" }, { disabled: ro })}</div>
        <div class="stats">${UI.stat("Area", U.fmtArea(r.w * r.d))}${UI.stat("Carpet (approx.)", U.fmtArea(Math.max(0, r.w - d.settings.intWall) * Math.max(0, r.d - d.settings.intWall)))}</div>
        ${v ? `<div class="vrow ${v.status}"><span class="pill ${v.status}">${O.DIR_NAMES[v.zone]}</span><p>${esc(v.message)}</p></div>` : ""}`),
      matPicker("Flooring", t.floorSlot === "outdoor" || t.floorSlot === "paving" ? ["outdoor", "paving", "floor"] : ["floor"], fm, !r.floorMat, "roomMat", { id: r.id, k: "floorMat" }, ro, "roomMatReset"),
      t.enclosed ? matPicker("Wall finish (inside)", ["wall"], wm, !r.wallMat, "roomMat", { id: r.id, k: "wallMat" }, ro, "roomMatReset") : "",
      t.enclosed ? matPicker("Ceiling", ["ceiling"], cm, !r.ceilingMat, "roomMat", { id: r.id, k: "ceilingMat" }, ro, "roomMatReset") : "",
      UI.section("Walls", `<div class="list">${edges.map(({ e, dir, ws }) => ws.map((w) => `<div class="li" data-act="select"${A({ sel: { kind: "wall", id: w.id, floorId: f.id } })}><i class="dir">${dir}</i><span class="grow">${e.edge[0].toUpperCase() + e.edge.slice(1)} · ${w.kind}<small>${esc(f.rooms.find((x) => x.id === G.otherSide(w, r.id))?.name || "Outside")}</small></span><em>${U.fmtFt(w.len)}</em></div>`).join("")).join("")}</div><p class="hint">Select a wall to add a door or window to it.</p>`),
      furn.length ? UI.section("Furniture in this room", `<div class="list">${furn.map((it) => `<div class="li" data-act="select"${A({ sel: { kind: "furniture", id: it.id, floorId: f.id } })}><span class="grow">${esc(C.FUR[it.type]?.label)}</span></div>`).join("")}</div>`) : ""
    ];
    if (floorFirst) { const fl = sections.splice(2, 1)[0]; sections.splice(1, 0, fl); }
    return head(t.icon, esc(r.name), `${esc(t.label)} · ${esc(f.name)} · ${U.fmtDims(r.w, r.d)}`, t.color) + sections.join("") +
      `<div class="btn-row">${UI.btn("Furnish", "roomFurnish", { id: r.id }, { disabled: ro })}${UI.btn("Duplicate", "roomDup", { id: r.id }, { disabled: ro })}${UI.btn("Delete", "roomDel", { id: r.id }, { cls: "danger", disabled: ro })}</div>`;
  };
  UI.inspectors.ceiling = (st, d, sel, ro) => UI.inspectors.room(st, d, { ...sel, kind: "room", facet: "ceiling" }, ro);

  /* ---------- wall ---------- */
  UI.inspectors.wall = (st, d, sel, ro) => {
    const f = Cmd.floorOf(d, sel.floorId), w = G.wallById(G.floorWalls(d, f), sel.id);
    if (!w) return UI.inspectors.none(st, d, ro);
    const byId = (id) => f.rooms.find((r) => r.id === id);
    const pos = byId(w.pos), neg = byId(w.neg);
    const P = d.plot;
    const facingDir = (sign) => O.dirOf(O.bearingOf(P.facing, w.axis === "v" ? sign : 0, w.axis === "h" ? sign : 0));
    const sideBlock = (room, sign) => {
      const label = `${w.axis === "h" ? (sign > 0 ? "Front" : "Rear") : sign > 0 ? "Right" : "Left"} face (faces ${O.DIR_NAMES[facingDir(sign)]})`;
      if (room && C.ROOM_TYPES[room.type].enclosed)
        return matPicker(`${label} – ${esc(room.name)}`, ["wall"], Mo.roomWallMat(d, room), !room.wallMat, "roomMat", { id: room.id, k: "wallMat", floorId: f.id }, ro);
      if (w.kind === "exterior") {
        const accent = d.exterior.accentOn && w.axis === "h" && w.outside === 1;
        return UI.section(`${label} – exterior`, UI.swatches(C.matsOf("exterior").map((m) => m.id), accent ? d.exterior.accent : d.exterior.wall, "extSet", { k: accent ? "accent" : "wall" }, { disabled: ro }) + `<p class="hint">${accent ? "Front accent cladding – applies to all front-facing walls." : "Applies to all exterior walls (elevation)."}</p>`);
      }
      return "";
    };
    const ops = f.openings.filter((o) => G.onWall(o, w));
    const kindLabel = { exterior: "Exterior wall", interior: "Interior partition", railing: "Balcony railing", parapet: "Parapet" }[w.kind] || w.kind;
    const along = w.axis === "h" ? "left" : "rear";
    return head("▮", kindLabel, `${esc(f.name)} · ${w.axis === "h" ? "horizontal" : "vertical"} on plan`) +
      UI.section("Dimensions", `<div class="stats">${UI.stat("Length", U.fmtFt(w.len))}${UI.stat("Thickness", Math.round(w.thickness * 12) + '"')}${UI.stat("Height", U.fmtFt(f.height - 0.5))}${UI.stat("Openings", ops.length)}</div>
        ${UI.num(`Position (from ${w.axis === "h" ? "rear" : "left"} boundary)`, w.line, "wallMove", { id: w.id }, { disabled: ro || w.kind === "none" })}
        <p class="hint">Runs ${U.fmtFt(w.a)} → ${U.fmtFt(w.b)} from the ${along} boundary. Moving it resizes ${esc([pos, neg].filter(Boolean).map((r) => r.name).join(" and ") || "adjacent rooms")}. Drag it on the plan too.</p>
        ${w.kind === "exterior" || w.kind === "interior" ? `<div class="grid2">${UI.num(w.kind === "exterior" ? "Exterior wall thickness" : "Partition thickness", (w.kind === "exterior" ? d.settings.extWall : d.settings.intWall) * 12, "wallThick", { k: w.kind === "exterior" ? "extWall" : "intWall" }, { step: 0.5, min: 3, max: 18, suffix: "in", ft: false, disabled: ro })}</div>` : ""}`) +
      (w.kind === "interior" || w.kind === "exterior" ? UI.section("Doors & windows", `<div class="btn-row">${UI.btn("+ Door", "wallAdd", { kind: "door" }, { disabled: ro })}${UI.btn("+ Window", "wallAdd", { kind: "window" }, { disabled: ro })}</div>
        <div class="list">${ops.map((o) => `<div class="li" data-act="select"${A({ sel: { kind: "opening", id: o.id, floorId: f.id } })}><i class="kind">${o.kind === "door" ? "🚪" : "🪟"}</i><span class="grow">${esc((o.kind === "door" ? C.DOOR_STYLES : C.WINDOW_STYLES)[o.style]?.label || o.style)}</span><em>${U.fmtFt(o.width)}</em></div>`).join("")}</div>`) : "") +
      (w.kind === "railing" ? UI.section("Railing", UI.swatches(C.matsOf("railing").map((m) => m.id), d.exterior.railing, "extSet", { k: "railing" }, { disabled: ro })) : "") +
      sideBlock(neg, -1) + sideBlock(pos, 1);
  };

  /* ---------- opening ---------- */
  UI.inspectors.opening = (st, d, sel, ro) => {
    const f = Cmd.floorOf(d, sel.floorId), o = f?.openings.find((x) => x.id === sel.id);
    if (!o) return UI.inspectors.none(st, d, ro);
    const w = G.wallOfOpening(G.floorWalls(d, f), o);
    const byId = (id) => f.rooms.find((r) => r.id === id);
    const posName = w ? byId(w.pos)?.name || "Outside" : "+", negName = w ? byId(w.neg)?.name || "Outside" : "−";
    const isDoor = o.kind === "door";
    const styles = isDoor ? C.DOOR_STYLES : C.WINDOW_STYLES;
    const matCur = o.material || (isDoor ? (o.main ? d.materials.mainDoor : d.materials.door) : d.materials.window);
    const off = w ? o.center - o.width / 2 - w.a : 0;
    const P = d.plot;
    const outDir = w && w.outside ? O.DIR_NAMES[O.dirOf(O.bearingOf(P.facing, w.axis === "v" ? w.outside : 0, w.axis === "h" ? w.outside : 0))] : null;
    return head(isDoor ? "🚪" : "🪟", `${o.main ? "Main entrance" : isDoor ? "Door" : "Window"}`, `${esc(styles[o.style]?.label || o.style)} · ${esc(f.name)}${outDir ? ` · faces ${outDir}` : ""}`) +
      (w ? "" : `<div class="notice warn">This ${o.kind} is not attached to a wall. Drag it onto a wall in the plan, or delete it.</div>`) +
      UI.section("Type", UI.select("Style", o.style, Object.fromEntries(Object.entries(styles).map(([k, s]) => [k, s.label])), "openSet", { id: o.id, k: "style" }, { disabled: ro }) +
        (isDoor ? UI.toggle("Main entrance", o.main, "openToggle", { id: o.id, k: "main" }, { disabled: ro }) : "")) +
      UI.section("Size & position", `<div class="grid2">${UI.num("Width", o.width, "openSet", { id: o.id, k: "width" }, { min: 1, disabled: ro })}${UI.num("Height", o.height, "openSet", { id: o.id, k: "height" }, { min: 1, disabled: ro })}
        ${!isDoor ? UI.num("Sill height", o.sill, "openSet", { id: o.id, k: "sill" }, { min: 0, disabled: ro }) : ""}${w ? UI.num(`Offset from wall start`, off, "openOffset", { id: o.id }, { min: 0, disabled: ro }) : ""}</div>
        ${w ? `<p class="hint">On the wall between <b>${esc(negName)}</b> and <b>${esc(posName)}</b> (${U.fmtFt(w.len)} long). Drag it along the wall in the plan or 3D.</p>` : ""}`) +
      (isDoor && o.style !== "arch" && o.style !== "sliding" && w ? UI.section("Opening direction", `<label class="lbl">Opens into</label>${UI.seg({ "-1": esc(negName), "1": esc(posName) }, o.swing > 0 ? 1 : -1, "openSetV", { id: o.id, k: "swing", num: true }, { disabled: ro })}
        ${o.style === "single" || o.style === "main" ? `<label class="lbl">Hinge side</label>${UI.seg({ start: w.axis === "h" ? "Left" : "Rear side", end: w.axis === "h" ? "Right" : "Front side" }, o.hinge, "openSetV", { id: o.id, k: "hinge" }, { disabled: ro })}` : ""}`) : "") +
      matPicker(isDoor ? "Door material" : "Frame material", [isDoor ? "door" : "window"], matCur, !o.material, "openSetV", { id: o.id, k: "material" }, ro, "openMatReset") +
      `<div class="btn-row">${UI.btn("Duplicate", "openDup", { id: o.id }, { disabled: ro || !w })}${UI.btn("Delete", "openDel", { id: o.id }, { cls: "danger", disabled: ro })}</div>`;
  };

  /* ---------- furniture ---------- */
  UI.inspectors.furniture = (st, d, sel, ro) => {
    const it = Cmd.itemsOf(d, sel.floorId).find((x) => x.id === sel.id);
    if (!it) return UI.inspectors.none(st, d, ro);
    const def = C.FUR[it.type], s = G.itemSize(it);
    const f = sel.floorId === "site" ? null : Cmd.floorOf(d, sel.floorId);
    const room = f ? G.roomAt(f, it.x, it.y) : null;
    const a = { id: it.id, fid: sel.floorId };
    return head("🪑", esc(def.label), `${esc(C.FURNITURE_CATS[def.cat])} · ${room ? esc(room.name) : sel.floorId === "site" ? "Site / garden" : esc(f.name)}`) +
      UI.section("Position", `<div class="grid2">${UI.num("X (from left)", it.x, "itemSet", { ...a, k: "x" }, { disabled: ro })}${UI.num("Y (from rear)", it.y, "itemSet", { ...a, k: "y" }, { disabled: ro })}</div>
        <div class="rot-row">${UI.num("Rotation", it.rot || 0, "itemSet", { ...a, k: "rot" }, { step: 15, suffix: "°", ft: false, disabled: ro })}${UI.btn("⟲ 90°", "itemRot", { ...a, delta: -90 }, { disabled: ro })}${UI.btn("⟳ 90°", "itemRot", { ...a, delta: 90 }, { disabled: ro })}</div>`) +
      UI.section("Size", `<div class="grid3">${UI.num("Width", s.w, "itemSet", { ...a, k: "w" }, { min: 0.5, disabled: ro })}${UI.num("Depth", s.d, "itemSet", { ...a, k: "d" }, { min: 0.5, disabled: ro })}${UI.num("Height", s.h, "itemSet", { ...a, k: "h" }, { min: 0.1, disabled: ro })}</div>
        ${it.w != null || it.d != null || it.h != null ? UI.btn("Reset to catalogue size", "itemResetSize", a, { cls: "small ghost", disabled: ro }) : ""}`) +
      UI.section("Finish", `<div class="color-row"><input type="color" value="${it.color || def.color}" data-change="itemColor"${A(a)} ${ro ? "disabled" : ""}><span>${it.color ? "Custom colour" : "Catalogue colour"}</span>${it.color ? UI.btn("Reset", "itemColorReset", a, { cls: "small ghost", disabled: ro }) : ""}</div>
        ${def.price ? `<p class="hint">Catalogue price ${U.fmtINR(def.price)} (included in the cost estimate).</p>` : ""}`) +
      `<div class="btn-row">${UI.btn("Duplicate", "itemDup", a, { disabled: ro })}${UI.btn("Delete", "itemDel", a, { cls: "danger", disabled: ro })}</div>`;
  };

  /* ---------- exterior objects ---------- */
  UI.inspectors.roof = (st, d, sel, ro) => head("⌂", "Roof", C.ROOF_TYPES[d.exterior.roofType]) + UI.panels.exterior(st, d, ro).split("</section>").slice(2, 3).join("") + "</section>" +
    `<p class="hint">Switch to a sloped roof to pick tiles or metal sheets. Flat roofs get a parapet and a staircase headroom with water tank.</p>`;
  UI.inspectors.compound = (st, d, sel, ro) => head("▭", "Compound wall & gate", `${U.fmtFt(d.exterior.compound.height)} high`) + UI.panels.exterior(st, d, ro).split("</section>").slice(4, 5).join("") + "</section>";
  UI.inspectors.gate = UI.inspectors.compound;
  UI.inspectors.plot = (st, d) => head("▢", "Plot", `${U.fmtFt(d.plot.width)} × ${U.fmtFt(d.plot.depth)} · ${C.FACINGS[d.plot.facing].label}`) +
    UI.section("", `<div class="stats">${UI.stat("Plot area", U.fmtArea(d.plot.width * d.plot.depth))}${UI.stat("Coverage", Math.round(HD.metrics.designStats(d).coverage * 100) + "%")}</div>${UI.btn("Edit plot, setbacks & facing", "step", { value: "plot" }, { cls: "wide" })}${UI.btn("Landscaping & gate", "step", { value: "exterior" }, { cls: "wide ghost" })}`);

  /* ================= actions ================= */
  const Aa = UI.actions;
  const sel = () => S.state.selection;
  Aa.roomSet = ({ id, k }, v) => {
    const fid = sel()?.floorId || S.state.ui.activeFloorId;
    upd((d) => {
      const f = Cmd.floorOf(d, fid), r = Cmd.roomOf(f, id);
      if (!r) return;
      if (k === "x" || k === "y") { if (isFinite(v)) Cmd.moveRoom(d, fid, id, k === "x" ? v : r.x, k === "y" ? v : r.y); }
      else if (k === "w" || k === "d") { if (isFinite(v) && v >= 2) Cmd.resizeRoom(d, fid, id, { x: r.x, y: r.y, w: k === "w" ? v : r.w, d: k === "d" ? v : r.d }); }
      else Cmd.updateRoom(d, fid, id, { [k]: v });
    });
  };
  Aa.roomMat = ({ id, k, value, floorId }) => { const fid = floorId || sel()?.floorId; upd((d) => Cmd.updateRoom(d, fid, id, { [k]: value })); };
  Aa.roomMatReset = ({ id, k }) => { const fid = sel()?.floorId; upd((d) => Cmd.updateRoom(d, fid, id, { [k]: null })); };
  Aa.roomDup = ({ id }) => { const fid = sel().floorId; const nid = upd((d) => Cmd.duplicateRoom(d, fid, id)); if (nid) S.select({ kind: "room", id: nid, floorId: fid }); };
  Aa.roomDel = ({ id }) => { const fid = sel().floorId; upd((d) => Cmd.deleteRoom(d, fid, id)); S.select(null); };
  Aa.roomFurnish = ({ id }) => { const fid = sel().floorId; upd((d) => { const f = Cmd.floorOf(d, fid), r = Cmd.roomOf(f, id); f.furniture = f.furniture.filter((it) => !U.rectContainsPt(r, it.x, it.y)); HD.gen.furnishRoom(d, f, r); }); };

  Aa.wallMove = ({ id }, v) => {
    if (!isFinite(v)) return;
    const fid = sel().floorId, d0 = S.state.design, w = G.wallById(G.floorWalls(d0, Cmd.floorOf(d0, fid)), id);
    if (!w) return;
    let nl;
    upd((d) => { nl = Cmd.moveWall(d, fid, w, v); });
    const nw = G.floorWalls(S.state.design, Cmd.floorOf(S.state.design, fid)).find((x) => x.axis === w.axis && U.near(x.line, nl) && x.a < (w.a + w.b) / 2 && x.b > (w.a + w.b) / 2);
    if (nw) S.select({ kind: "wall", id: nw.id, floorId: fid });
  };
  Aa.wallThick = ({ k }, v) => { if (isFinite(v)) upd((d) => (d.settings[k] = U.clamp(v, 3, 18) / 12)); };

  const openUpd = (id, patch) => { const fid = sel().floorId; upd((d) => Cmd.updateOpening(d, fid, id, patch)); };
  Aa.openSet = ({ id, k }, v) => { if (k === "style") openUpd(id, { style: v }); else if (isFinite(v)) openUpd(id, { [k]: v }); };
  Aa.openSetV = ({ id, k, value, num }) => openUpd(id, { [k]: num ? +value : value });
  Aa.openToggle = ({ id, k }, v) => openUpd(id, { [k]: v });
  Aa.openMatReset = ({ id }) => openUpd(id, { material: null });
  Aa.openOffset = ({ id }, v) => {
    if (!isFinite(v)) return;
    const fid = sel().floorId;
    upd((d) => { const f = Cmd.floorOf(d, fid), o = f.openings.find((x) => x.id === id), w = G.wallOfOpening(G.floorWalls(d, f), o); if (w) Cmd.moveOpening(d, fid, id, w, w.a + v + o.width / 2); });
  };
  Aa.openDel = ({ id }) => { const fid = sel().floorId; upd((d) => Cmd.deleteOpening(d, fid, id)); S.select(null); };
  Aa.openDup = ({ id }) => {
    const fid = sel().floorId;
    const nid = upd((d) => {
      const f = Cmd.floorOf(d, fid), o = f.openings.find((x) => x.id === id), w = G.wallOfOpening(G.floorWalls(d, f), o);
      if (!w) return null;
      const free = G.freeIntervals(f, w).filter(([a, b]) => b - a >= o.width).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
      if (!free) return null;
      const n = { ...U.clone(o), id: U.uid(o.kind === "door" ? "dr" : "wn"), main: false, center: U.r2((free[0] + free[1]) / 2) };
      f.openings.push(n);
      return n.id;
    });
    if (nid) S.select({ kind: "opening", id: nid, floorId: fid }); else UI.toast("No free space on this wall");
  };

  Aa.itemSet = ({ id, fid, k }, v) => { if (isFinite(v)) upd((d) => Cmd.updateItem(d, fid, id, { [k]: k === "rot" ? ((v % 360) + 360) % 360 : v })); };
  Aa.itemRot = ({ id, fid, delta }) => upd((d) => Cmd.rotateItem(d, fid, id, delta));
  Aa.itemResetSize = ({ id, fid }) => upd((d) => Cmd.updateItem(d, fid, id, { w: undefined, d: undefined, h: undefined }));
  Aa.itemColor = ({ id, fid }, v) => upd((d) => Cmd.updateItem(d, fid, id, { color: v }));
  Aa.itemColorReset = ({ id, fid }) => upd((d) => Cmd.updateItem(d, fid, id, { color: null }));
  Aa.itemDup = ({ id, fid }) => { const nid = upd((d) => Cmd.duplicateItem(d, fid, id)); if (nid) S.select({ kind: "furniture", id: nid, floorId: fid }); };
  Aa.itemDel = ({ id, fid }) => { upd((d) => Cmd.deleteItem(d, fid, id)); S.select(null); };
})(window.HD);
