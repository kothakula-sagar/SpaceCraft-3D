/* Left panel: tools for each workflow step (Plot → Layout → Rooms → Doors & Windows → Furniture →
   Materials → Exterior → Vastu → Cost → Review). */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, O = HD.orient, Mo = HD.model, S = HD.store, Cmd = HD.cmd, UI = HD.ui;
  const esc = U.esc, A = UI.A;
  const upd = (fn) => S.update(fn);

  UI.STEPS = [
    ["plot", "Plot", "📐"], ["layout", "Layout", "🏠"], ["rooms", "Rooms", "▦"], ["openings", "Doors & Windows", "🚪"],
    ["furniture", "Furniture", "🛋️"], ["materials", "Materials", "🎨"], ["exterior", "Exterior", "🏡"],
    ["vastu", "Vastu", "🧭"], ["cost", "Cost", "₹"], ["review", "Review & Share", "✓"]
  ];

  const genDefaults = (d) => ({ bhk: d.meta.bhk === "custom" ? 2 : +d.meta.bhk || 2, floors: d.floors.length, vastu: true, furnish: true, parking: true });

  UI.renderLeft = (st) => {
    const d = st.design, step = st.ui.step;
    const ro = st.ui.readOnly;
    const body = (UI.panels[step] || UI.panels.rooms)(st, d, ro);
    const i = UI.STEPS.findIndex((s) => s[0] === step);
    const next = UI.STEPS[i + 1];
    return `<div class="panel-head"><span class="step-no">${i + 1}</span><h2>${UI.STEPS[i][1]}</h2></div>${body}
      ${next ? `<div class="next-step">${UI.btn(`Next: ${next[1]} →`, "step", { value: next[0] }, { cls: "ghost wide" })}</div>` : ""}`;
  };

  UI.panels = {};

  /* ---------------- Plot ---------------- */
  UI.panels.plot = (st, d, ro) => {
    const P = d.plot, env = Mo.envelope(P), s = P.setbacks;
    const sides = O.sideLabels(P.facing);
    return [
      UI.section("Plot size", `<div class="chips">${C.PLOT_PRESETS.map((p) => `<button class="chip-btn ${p.w === P.width && p.d === P.depth ? "on" : ""}" data-act="plotPreset"${A({ w: p.w, d: p.d })} ${ro ? "disabled" : ""}>${p.label}</button>`).join("")}</div>
        <div class="grid2">${UI.num("Width (front)", P.width, "plotSet", { k: "width" }, { step: 1, min: 12, disabled: ro })}${UI.num("Depth", P.depth, "plotSet", { k: "depth" }, { step: 1, min: 15, disabled: ro })}</div>
        <div class="grid2">${UI.num("Road width", P.roadWidth, "plotSet", { k: "roadWidth" }, { step: 1, disabled: ro })}${UI.stat("Plot area", U.fmtArea(P.width * P.depth))}</div>`),
      UI.section("Setbacks", `<div class="grid2">${["front", "rear", "left", "right"].map((k) => UI.num(k[0].toUpperCase() + k.slice(1), s[k], "setback", { k }, { step: 0.5, min: 0, disabled: ro })).join("")}</div>
        <p class="hint">Buildable area: <b>${U.fmtDims(env.w, env.d)}</b> (${U.fmtArea(env.w * env.d)}) — shown dashed on the plan.</p>`),
      UI.section("Facing / orientation", `<div class="facing-grid">${Object.entries(C.FACINGS).map(([k, f]) => `<button class="facing ${P.facing === k ? "on" : ""}" data-act="setFacing"${A({ value: k })} ${ro ? "disabled" : ""}><b>${k}</b><span>${f.label}</span></button>`).join("")}</div>
        <p class="hint">The road / entrance side faces <b>${O.DIR_NAMES[P.facing]}</b>. On the plan: top = ${O.DIR_NAMES[sides.top]}, left = ${O.DIR_NAMES[sides.left]}, right = ${O.DIR_NAMES[sides.right]}.</p>
        ${UI.toggle("Show plan with North up", st.ui.display.northUp, "disp", { k: "northUp" })}`),
      UI.section("Floors", `${d.floors.map((f) => `<div class="floor-row"><input type="text" value="${esc(f.name)}" data-change="floorName"${A({ id: f.id })} data-key="fn${f.id}" ${ro ? "disabled" : ""}>
          <div class="inp small"><input type="number" value="${f.height}" step="0.5" min="8" max="16" data-change="floorHeight"${A({ id: f.id })} data-key="fh${f.id}" ${ro ? "disabled" : ""}><em>ht</em></div>
          ${f.level > 0 ? `<button class="icon" title="Delete floor" data-act="delFloor"${A({ id: f.id })} ${ro ? "disabled" : ""}>✕</button>` : `<span class="icon ph"></span>`}</div>`).join("")}
        <div class="btn-row">${UI.btn("+ Copy floor above", "addFloor", { mode: "copy" }, { disabled: ro || d.floors.length >= 5 })}${UI.btn("+ Empty floor", "addFloor", { mode: "stairs" }, { disabled: ro || d.floors.length >= 5 })}</div>`),
      UI.section("Construction grade", UI.seg(C.GRADES, d.settings.grade, "grade", {}, { disabled: ro }) + `<p class="hint">Drives the base construction rate used in the cost estimate.</p>`)
    ].join("");
  };

  /* ---------------- Layout (BHK generator) ---------------- */
  UI.panels.layout = (st, d, ro) => {
    const g = (st.ui.gen = st.ui.gen || genDefaults(d));
    const bhks = { 1: "1 BHK", 2: "2 BHK", 3: "3 BHK", 4: "4 BHK", custom: "Custom" };
    const desc = { 1: "Bedroom, living, kitchen", 2: "2 bedrooms, 2 baths", 3: "3 bedrooms, 3 baths", 4: "4 bedrooms, lounge", custom: "Start from one room" };
    return [
      UI.section("Building type", `<div class="bhk-grid">${Object.entries(bhks).map(([k, l]) => `<button class="bhk ${String(g.bhk) === k ? "on" : ""}" data-act="genSet"${A({ k: "bhk", value: k })} ${ro ? "disabled" : ""}><b>${l}</b><span>${desc[k]}</span></button>`).join("")}</div>`),
      UI.section("Floors", UI.seg({ 1: "G", 2: "G+1", 3: "G+2", 4: "G+3" }, g.floors, "genSet", { k: "floors" }, { disabled: ro })),
      UI.section("Options", [
        UI.toggle("Vastu-optimised placement", g.vastu, "genToggle", { k: "vastu" }, { disabled: ro }),
        UI.toggle("Furnish rooms automatically", g.furnish, "genToggle", { k: "furnish" }, { disabled: ro }),
        UI.toggle("Car parking in front yard (if space)", g.parking, "genToggle", { k: "parking" }, { disabled: ro })
      ].join("") + `<p class="hint">The plan adapts to the plot (${U.fmtFt(d.plot.width)} × ${U.fmtFt(d.plot.depth)}), setbacks and ${O.DIR_NAMES[d.plot.facing]} facing. Doors, windows and staircase are placed automatically.</p>`),
      `<div class="gen-cta">${UI.btn("Generate floor plan", "generate", {}, { cls: "primary wide", disabled: ro })}</div>`,
      UI.section("Layout tools", `<div class="btn-col">
        ${UI.btn("⇋ Mirror layout left ↔ right", "mirror", {}, { disabled: ro })}
        ${UI.btn("🚪 Re-place doors & windows on this floor", "reopenings", {}, { disabled: ro })}
        ${UI.btn("🛋️ Re-furnish this floor", "refurnish", {}, { disabled: ro })}</div>`)
    ].join("");
  };

  /* ---------------- Rooms ---------------- */
  UI.panels.rooms = (st, d, ro) => {
    const f = S.activeFloor();
    const sel = st.selection;
    const list = f.rooms.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    return [
      UI.section("Add a room", `<div class="add-grid">${C.ADDABLE_ROOMS.map((t) => { const rt = C.ROOM_TYPES[t]; return `<button class="add-room" data-act="addRoom"${A({ type: t })} ${ro ? "disabled" : ""}><i style="background:${rt.color}">${rt.icon}</i><span>${esc(rt.label)}</span></button>`; }).join("")}</div>
        <p class="hint">Drag a room in the plan to move it (it snaps to neighbours), drag its handles to resize, or drag a wall to resize the rooms on both sides.</p>`),
      UI.section(`Rooms on ${esc(f.name)}`, `<div class="list">${list.map((r) => `<div class="li ${sel && sel.kind === "room" && sel.id === r.id ? "on" : ""}" data-act="select"${A({ sel: { kind: "room", id: r.id, floorId: f.id } })}>
          <i class="dot" style="background:${C.ROOM_TYPES[r.type].color}"></i><span class="grow">${esc(r.name)}</span><em>${U.fmtDims(r.w, r.d)}</em>
          ${ro ? "" : `<button class="icon" title="Delete" data-act="delRoom"${A({ id: r.id })}>✕</button>`}</div>`).join("") || `<p class="hint">No rooms yet.</p>`}</div>`,
        { right: `${U.fmtArea(U.sum(f.rooms, (r) => r.w * r.d))}` })
    ].join("");
  };

  /* ---------------- Doors & windows ---------------- */
  UI.panels.openings = (st, d, ro) => {
    const f = S.activeFloor(), pm = st.ui.placeMode, sel = st.selection;
    const walls = G.floorWalls(d, f);
    const byId = Object.fromEntries(f.rooms.map((r) => [r.id, r]));
    const wallName = (w) => !w ? "not attached" : [w.pos, w.neg].map((id) => byId[id]?.name || "Outside").join(" ↔ ");
    const styleBtns = (kind, styles) => `<div class="style-grid">${Object.entries(styles).map(([k, s]) => `<button class="style ${pm && pm.kind === kind && pm.style === k ? "on" : ""}" data-act="placeMode"${A({ kind, style: k })} ${ro ? "disabled" : ""}>${esc(s.label)}<em>${U.fmtFt(s.width)}</em></button>`).join("")}</div>`;
    const wallSel = sel && sel.kind === "wall" ? walls.find((w) => w.id === sel.id) : null;
    return [
      pm ? `<div class="notice">Click a wall in the 2D plan or 3D view to place the ${esc(pm.kind)}. Hold Shift to place several. ${UI.btn("Cancel", "cancelPlace", {}, { cls: "small" })}</div>` : "",
      wallSel && (wallSel.kind === "interior" || wallSel.kind === "exterior") ? UI.section("Selected wall", `<p class="hint">${esc(wallName(wallSel))} · ${U.fmtFt(wallSel.len)}</p><div class="btn-row">${UI.btn("+ Door here", "wallAdd", { kind: "door" }, { disabled: ro })}${UI.btn("+ Window here", "wallAdd", { kind: "window" }, { disabled: ro })}</div>`) : "",
      UI.section("Place a door", styleBtns("door", C.DOOR_STYLES)),
      UI.section("Place a window", styleBtns("window", C.WINDOW_STYLES)),
      UI.section(`On ${esc(f.name)}`, `<div class="list">${f.openings.map((o) => {
        const w = G.wallOfOpening(walls, o);
        const s = o.kind === "door" ? C.DOOR_STYLES[o.style] : C.WINDOW_STYLES[o.style];
        return `<div class="li ${sel && sel.kind === "opening" && sel.id === o.id ? "on" : ""}" data-act="select"${A({ sel: { kind: "opening", id: o.id, floorId: f.id } })}>
          <i class="kind">${o.kind === "door" ? "🚪" : "🪟"}</i><span class="grow">${o.main ? "<b>Main</b> · " : ""}${esc(s?.label || o.style)}<small>${esc(wallName(w))}</small></span><em>${U.fmtFt(o.width)}</em></div>`;
      }).join("") || `<p class="hint">No doors or windows yet.</p>`}</div>`, { right: `${f.openings.filter((o) => o.kind === "door").length} doors · ${f.openings.filter((o) => o.kind === "window").length} windows` })
    ].join("");
  };

  /* ---------------- Furniture ---------------- */
  UI.panels.furniture = (st, d, ro) => {
    const f = S.activeFloor(), sel = st.selection;
    const selRoom = sel && sel.kind === "room" ? f.rooms.find((r) => r.id === sel.id) : null;
    const guess = { master: "bedroom", bedroom: "bedroom", living: "living", lounge: "living", dining: "dining", kitchen: "kitchen", bathroom: "bath", utility: "bath", study: "office", pooja: "pooja", sitout: "outdoor", balcony: "outdoor", terrace: "outdoor", parking: "outdoor" };
    const cat = st.ui.furCat || (selRoom && guess[selRoom.type]) || "living";
    const items = C.FURNITURE.filter((x) => x.cat === cat);
    const target = cat === "outdoor" && !selRoom ? "the site (garden)" : selRoom ? selRoom.name : `${f.name} (centre)`;
    const placed = f.furniture;
    return [
      UI.section("Catalogue", `<div class="tabs">${Object.entries(C.FURNITURE_CATS).map(([k, l]) => `<button class="${k === cat ? "on" : ""}" data-act="furCat"${A({ value: k })}>${l}</button>`).join("")}</div>
        <div class="cat-grid">${items.map((it) => `<button class="cat-item" data-act="addItem"${A({ type: it.id })} ${ro ? "disabled" : ""}><b>${esc(it.label)}</b><span>${U.fmtDims(it.size[0], it.size[1])}${it.price ? " · " + U.fmtLakh(it.price) : ""}</span></button>`).join("")}</div>
        <p class="hint">Adds to <b>${esc(target)}</b>. Select a room first to place inside it. Drag items to move; use the round handle or R to rotate.</p>`),
      UI.section(`Placed on ${esc(f.name)}`, `<div class="list">${placed.map((it) => `<div class="li ${sel && sel.kind === "furniture" && sel.id === it.id ? "on" : ""}" data-act="select"${A({ sel: { kind: "furniture", id: it.id, floorId: f.id } })}><span class="grow">${esc(C.FUR[it.type]?.label || it.type)}</span><em>${Math.round(it.rot || 0)}°</em></div>`).join("") || `<p class="hint">Nothing placed yet.</p>`}</div>`, { right: `${placed.length} items` })
    ].join("");
  };

  /* ---------------- Materials ---------------- */
  const SLOTS = [
    ["floor", "Flooring – living & bedrooms", ["floor"]],
    ["bathFloor", "Flooring – bathrooms & utility", ["floor"]],
    ["outdoor", "Flooring – balcony, sit-out, terrace", ["outdoor", "floor"]],
    ["wall", "Interior walls", ["wall"]],
    ["bathWall", "Bathroom walls", ["wall"]],
    ["kitchenWall", "Kitchen walls", ["wall"]],
    ["ceiling", "Ceiling", ["ceiling"]],
    ["door", "Internal doors", ["door"]],
    ["mainDoor", "Main door", ["door"]],
    ["window", "Window frames", ["window"]],
    ["paving", "Parking & driveway", ["paving"]]
  ];
  UI.panels.materials = (st, d, ro) => {
    const overrides = d.floors.flatMap((f) => f.rooms).filter((r) => r.floorMat || r.wallMat || r.ceilingMat).length;
    return SLOTS.map(([slot, label, cats]) => UI.section(label, UI.swatches(C.matsOf(...cats).map((m) => m.id), d.materials[slot], "setMat", { slot }, { disabled: ro }), { right: esc(C.MAT[d.materials[slot]]?.name || "") })).join("") +
      UI.section("Per-room finishes", `<p class="hint">Select a room (or click its floor, walls or ceiling in 3D) to give it its own finish. ${overrides} room${overrides === 1 ? "" : "s"} currently override the defaults.</p>${UI.btn("Reset all rooms to defaults", "resetRoomMats", {}, { disabled: ro || !overrides })}`);
  };

  /* ---------------- Exterior ---------------- */
  UI.panels.exterior = (st, d, ro) => {
    const ex = d.exterior, cw = ex.compound, g = cw.gate;
    return [
      UI.section("Elevation – exterior walls", UI.swatches(C.matsOf("exterior").map((m) => m.id), ex.wall, "extSet", { k: "wall" }, { disabled: ro })),
      UI.section("Front accent", UI.toggle("Clad front-facing walls", ex.accentOn, "extToggle", { k: "accentOn" }, { disabled: ro }) + (ex.accentOn ? UI.swatches(C.matsOf("exterior").map((m) => m.id), ex.accent, "extSet", { k: "accent" }, { disabled: ro }) : "")),
      UI.section("Roof", UI.seg(C.ROOF_TYPES, ex.roofType, "extSet", { k: "roofType" }, { disabled: ro, cls: "wrap" }) +
        (ex.roofType === "flat" ? UI.num("Parapet height", ex.parapet, "extNum", { k: "parapet" }, { step: 0.5, min: 0, max: 6, disabled: ro }) : UI.swatches(C.matsOf("roof").filter((m) => m.id !== "roofRCC").map((m) => m.id), ex.roofMaterial, "extSet", { k: "roofMaterial" }, { disabled: ro }))),
      UI.section("Balconies & sunshades", `${UI.toggle("Sunshades (chajja) over windows", ex.sunshades, "extToggle", { k: "sunshades" }, { disabled: ro })}<label class="lbl">Railing</label>${UI.swatches(C.matsOf("railing").map((m) => m.id), ex.railing, "extSet", { k: "railing" }, { disabled: ro })}`),
      UI.section("Compound wall & gate", `${UI.toggle("Compound wall", cw.on, "cwToggle", { k: "on" }, { disabled: ro })}
        ${cw.on ? `<div class="grid2">${UI.num("Wall height", cw.height, "cwNum", { k: "height" }, { step: 0.5, min: 3, max: 8, disabled: ro })}${UI.num("Gate width", g.width, "gateNum", { k: "width" }, { step: 0.5, min: 3, max: 20, disabled: ro })}</div>
        ${UI.swatches(C.matsOf("compound").map((m) => m.id), cw.material, "cwSet", { k: "material" }, { disabled: ro })}
        <label class="lbl">Gate</label>${UI.seg(Object.fromEntries(Object.entries(C.GATE_STYLES).map(([k, v]) => [k, v.label])), g.style, "gateSet", { k: "style" }, { disabled: ro, cls: "wrap" })}
        <label class="lbl">Gate position along the front: ${U.fmtFt(g.center ?? d.plot.width / 2)}</label><input type="range" min="${g.width / 2 + 1}" max="${d.plot.width - g.width / 2 - 1}" step="0.5" value="${g.center ?? d.plot.width / 2}" data-input="gatePos" data-change="gatePosEnd" data-key="gatePos" ${ro ? "disabled" : ""}>
        ${UI.swatches(C.matsOf("gate").map((m) => m.id), g.material, "gateSet", { k: "material" }, { disabled: ro })}` : ""}`),
      UI.section("Landscaping", `${UI.toggle("Lawn on open areas", ex.lawn, "extToggle", { k: "lawn" }, { disabled: ro })}
        <div class="btn-row wrap">${["tree", "palm", "shrub", "car", "bike", "swing"].map((t) => UI.btn("+ " + C.FUR[t].label, "addSite", { type: t }, { disabled: ro, cls: "small" })).join("")}</div>
        <p class="hint">Drag garden items on the plan (ground floor) or in 3D.</p>`)
    ].join("");
  };

  /* ---------------- Vastu ---------------- */
  UI.panels.vastu = (st, d, ro) => {
    const rules = HD.vastu.getRules();
    const { base, list } = HD.vastu.suggestions(d, rules);
    const cls = base.score >= 75 ? "good" : base.score >= 50 ? "mid" : "bad";
    const order = { avoid: 0, neutral: 1, good: 2, ideal: 3 };
    const items = base.items.slice().sort((a, b) => order[a.status] - order[b.status]);
    const label = { ideal: "Ideal", good: "Good", neutral: "Neutral", avoid: "Avoid" };
    return [
      `<div class="score-card ${cls}"><div class="ring" style="--p:${base.score}"><b>${base.score}</b><span>/100</span></div><div><h4>Vastu score</h4><p>${esc(C.FACINGS[d.plot.facing].label)} plot · ${base.items.length} rooms checked</p>${UI.toggle("Show Vastu grid on plan", st.ui.display.vastuGrid, "disp", { k: "vastuGrid" })}</div></div>`,
      base.entrance ? UI.section("Main entrance", `<div class="vrow ${base.entrance.status}"><span class="pill ${base.entrance.status}">${label[base.entrance.status]}</span><p>${esc(base.entrance.message)}</p></div>`) : UI.section("Main entrance", `<p class="hint">Mark a door as the main entrance to check its direction.</p>`),
      list.length ? UI.section("Suggestions", list.map((s) => `<div class="suggest">${esc(s.text)}${s.kind === "mirror" ? UI.btn("Apply mirror", "mirror", {}, { cls: "small primary", disabled: ro }) : s.ref ? UI.btn("Show", "select", { sel: s.ref }, { cls: "small" }) : ""}</div>`).join("")) : "",
      UI.section("Room directions", `<div class="list">${items.map((i) => `<div class="vrow li ${i.status}" data-act="select"${A({ sel: { kind: "room", id: i.roomId, floorId: i.floorId } })}><span class="pill ${i.status}">${label[i.status]}</span><div class="grow"><b>${esc(i.name)}</b> <small>${esc(i.floorName)} · ${esc(O.DIR_NAMES[i.zone])}</small><p>${esc(i.message)}</p></div></div>`).join("")}</div>`),
      `<details class="sec adv"><summary>Configure Vastu rules (advanced)</summary><p class="hint">Rules are data: ideal / good / avoid zones per room type. Changes apply immediately and are stored in this browser.</p>
        <textarea id="vastuRules" spellcheck="false">${esc(JSON.stringify(rules, null, 2))}</textarea><div class="btn-row">${UI.btn("Save rules", "vastuRulesSave", {}, { cls: "primary" })}${UI.btn("Reset to default", "vastuRulesReset")}</div></details>`
    ].join("");
  };

  /* ---------------- Cost ---------------- */
  UI.panels.cost = (st, d, ro) => {
    const pricing = HD.cost.getPricing();
    const e = HD.cost.estimate(d, pricing);
    const max = Math.max(...Object.values(e.groups));
    const byGroup = {};
    e.lines.forEach((l) => (byGroup[l.group] = byGroup[l.group] || []).push(l));
    return [
      `<div class="cost-hero"><span>Estimated construction cost</span><b>${U.fmtLakh(e.total)}</b><em>${U.fmtINR(e.perSqft)} / sq ft on ${U.fmtArea(e.builtUp)} built-up</em></div>`,
      UI.section("Specification", UI.seg(C.GRADES, d.settings.grade, "grade", {}, { disabled: ro })),
      UI.section("Breakdown", Object.entries(e.groups).map(([g, v]) => `<div class="bar"><span>${esc(g)}</span><i style="width:${(v / max) * 100}%"></i><b>${U.fmtLakh(v)}</b></div>`).join("")),
      UI.section("Line items", Object.entries(byGroup).map(([g, ls]) => `<details class="lines"><summary>${esc(g)}<b>${U.fmtINR(U.sum(ls, (l) => l.amount))}</b></summary><table>${ls.map((l) => `<tr><td>${esc(l.item)}</td><td class="n">${U.fmtNum(l.qty, l.qty < 10 ? 1 : 0)} ${esc(l.unit)}</td><td class="n">× ${U.fmtINR(l.rate)}</td><td class="n">${U.fmtINR(l.amount)}</td></tr>`).join("")}</table></details>`).join("")),
      UI.section("Material estimate (thumb rules)", `<table class="qty">${e.quantities.map((q) => `<tr><td>${esc(q.item)}</td><td class="n">${U.fmtNum(q.qty)} ${esc(q.unit)}</td></tr>`).join("")}</table>`),
      `<details class="sec adv"><summary>Configure pricing rules (advanced)</summary><p class="hint">${esc(pricing.note || "")} Material prices come from the material catalogue.</p><textarea id="pricingRules" spellcheck="false">${esc(JSON.stringify(pricing, null, 2))}</textarea><div class="btn-row">${UI.btn("Save pricing", "pricingSave", {}, { cls: "primary" })}${UI.btn("Reset to default", "pricingReset")}</div></details>`
    ].join("");
  };

  /* ---------------- Review ---------------- */
  UI.panels.review = (st, d, ro) => {
    const s = HD.metrics.designStats(d), checks = HD.metrics.validate(d);
    const e = HD.cost.estimate(d), v = HD.vastu.analyze(d);
    return [
      UI.section("Summary", `<div class="stats">${[
        UI.stat("Type", d.meta.bhk === "custom" ? "Custom" : d.meta.bhk + " BHK"), UI.stat("Floors", d.floors.length === 1 ? "G" : "G+" + (d.floors.length - 1)),
        UI.stat("Built-up", U.fmtArea(s.builtUp)), UI.stat("Carpet", U.fmtArea(s.carpet)),
        UI.stat("Bedrooms", s.bedrooms), UI.stat("Bathrooms", s.bathrooms),
        UI.stat("Doors / windows", `${s.doors} / ${s.windows}`), UI.stat("Vastu", v.score + "/100"),
        UI.stat("Estimate", U.fmtLakh(e.total), { cls: "wide" })
      ].join("")}</div>`),
      UI.section("Export", `<div class="btn-col">${UI.btn("📄 Design summary / PDF", "exportReport", {}, { cls: "primary" })}${UI.btn("🗺️ Floor plan – SVG (vector)", "exportPlan", { fmt: "svg" })}${UI.btn("🖼️ Floor plan – PNG", "exportPlan", { fmt: "png" })}${UI.btn("🏠 3D view – PNG", "export3D")}${UI.btn("{ } Design data – JSON", "exportJSON")}</div>`),
      UI.section("Share & versions", `<div class="btn-col">${UI.btn("🔗 Share with client", "share", {}, { cls: "primary" })}${UI.btn("⎘ Create variant (Design B, C…)", "variant", {}, { disabled: ro })}${UI.btn("⚖ Compare designs", "compare")}</div>`),
      UI.section("Design checks", checks.length ? `<div class="list">${checks.map((c) => `<div class="check ${c.level}" ${c.ref ? `data-act="select"${A({ sel: c.ref })}` : ""}><i>${c.level === "error" ? "⛔" : c.level === "warn" ? "⚠️" : "ℹ️"}</i><span>${esc(c.msg)}</span></div>`).join("")}</div>` : `<p class="hint ok">✓ No issues found.</p>`)
    ].join("");
  };

  /* ================= actions ================= */
  const Aa = UI.actions;
  Aa.step = ({ value }) => { S.setUI({ step: value, placeMode: null }); };
  Aa.select = ({ sel }) => S.select(sel);
  Aa.disp = ({ k, value }, v) => S.setDisplay({ [k]: value ?? v });

  Aa.plotPreset = ({ w, d }) => upd((dd) => Cmd.setPlot(dd, { width: w, depth: d, setbacks: Mo.defaultSetbacks(w, d) }));
  Aa.plotSet = ({ k }, v) => { if (isFinite(v) && v > 0) upd((dd) => Cmd.setPlot(dd, { [k]: v })); };
  Aa.setback = ({ k }, v) => { if (isFinite(v) && v >= 0) upd((dd) => Cmd.setPlot(dd, { setbacks: { [k]: v } })); };
  Aa.setFacing = ({ value }) => upd((dd) => Cmd.setPlot(dd, { facing: value }));
  Aa.floorName = ({ id }, v) => upd((dd) => Cmd.updateFloor(dd, id, { name: v || "Floor" }));
  Aa.floorHeight = ({ id }, v) => { if (isFinite(v)) upd((dd) => Cmd.updateFloor(dd, id, { height: U.clamp(v, 8, 16) })); };
  Aa.addFloor = ({ mode }) => { const id = upd((dd) => Cmd.addFloor(dd, mode)); if (id) S.setUI({ activeFloorId: id }); };
  Aa.delFloor = async ({ id }) => { const f = S.state.design.floors.find((x) => x.id === id); if (await UI.confirm(`Delete <b>${esc(f.name)}</b> and everything on it?`, { danger: true, ok: "Delete floor" })) { upd((dd) => Cmd.deleteFloor(dd, id)); S.setUI({ activeFloorId: S.state.design.floors[0].id }); } };
  Aa.grade = ({ value }) => upd((dd) => (dd.settings.grade = value));

  Aa.genSet = ({ k, value }) => { const g = (S.state.ui.gen = S.state.ui.gen || genDefaults(S.state.design)); g[k] = k === "floors" ? +value : value; S.emit("ui"); };
  Aa.genToggle = ({ k }, v) => { S.state.ui.gen[k] = v; S.emit("ui"); };
  Aa.generate = async () => {
    const d = S.state.design, g = S.state.ui.gen || genDefaults(d);
    const has = d.floors.some((f) => f.rooms.length);
    if (has && !(await UI.confirm("Generate a new floor plan? The current rooms, doors, windows and furniture will be replaced (you can undo).", { ok: "Generate" }))) return;
    upd((dd) => HD.gen.generate(dd, { bhk: g.bhk === "custom" ? "custom" : +g.bhk, floors: g.floors, vastu: g.vastu, furnish: g.furnish, parking: g.parking }));
    S.select(null);
    S.setUI({ activeFloorId: S.state.design.floors[0].id, step: "rooms" });
    HD.editor?.fitViews();
    UI.toast("Floor plan generated");
  };
  Aa.mirror = () => { upd((dd) => Cmd.mirrorLayout(dd)); UI.toast("Layout mirrored"); };
  Aa.reopenings = () => upd((dd) => { const f = Cmd.floorOf(dd, S.state.ui.activeFloorId); f.openings = []; HD.gen.autoOpenings(dd, f); });
  Aa.refurnish = () => upd((dd) => { const f = Cmd.floorOf(dd, S.state.ui.activeFloorId); f.furniture = []; HD.gen.autoFurnish(dd, f); });

  Aa.addRoom = ({ type }) => { const f = S.activeFloor(); const id = upd((dd) => Cmd.addRoom(dd, f.id, type)); if (id) S.select({ kind: "room", id, floorId: f.id, facet: "floor" }); };
  Aa.delRoom = ({ id }, el, e) => { e?.stopPropagation(); const f = S.activeFloor(); upd((dd) => Cmd.deleteRoom(dd, f.id, id)); };

  Aa.placeMode = ({ kind, style }) => { const pm = S.state.ui.placeMode; S.setUI({ placeMode: pm && pm.kind === kind && pm.style === style ? null : { kind, style } }); };
  Aa.cancelPlace = () => S.setUI({ placeMode: null });
  Aa.wallAdd = ({ kind }) => {
    const sel = S.state.selection, d = S.state.design, f = Cmd.floorOf(d, sel.floorId);
    const w = G.wallById(G.floorWalls(d, f), sel.id);
    if (!w) return;
    const id = upd((dd) => Cmd.addOpening(dd, f.id, w, kind, kind === "door" ? "single" : "casement"));
    if (id) S.select({ kind: "opening", id, floorId: f.id });
  };

  Aa.furCat = ({ value }) => S.setUI({ furCat: value });
  Aa.addItem = ({ type }) => {
    const st = S.state, d = st.design, f = S.activeFloor(), sel = st.selection;
    const def = C.FUR[type];
    const room = sel && sel.kind === "room" && sel.floorId === f.id ? f.rooms.find((r) => r.id === sel.id) : null;
    let fid = f.id, area;
    if (def.cat === "outdoor" && !room) {
      fid = "site";
      const bb = U.bbox(d.floors[0].rooms.filter((r) => r.type !== "parking")) || Mo.envelope(d.plot);
      area = { x: 1, y: bb.y + bb.d, w: d.plot.width - 2, d: Math.max(3, d.plot.depth - bb.y - bb.d - 1) };
    } else area = room || U.bbox(f.rooms) || Mo.envelope(d.plot);
    const others = (fid === "site" ? d.site.items : f.furniture).map((it) => G.itemRect(it));
    const cx = area.x + area.w / 2, cy = area.y + area.d / 2;
    let spot = { x: cx, y: cy };
    outer: for (let rad = 0; rad < 12; rad += 1) for (let a = 0; a < 8; a++) {
      const x = cx + Math.cos((a * Math.PI) / 4) * rad, y = cy + Math.sin((a * Math.PI) / 4) * rad;
      const r = { x: x - def.size[0] / 2, y: y - def.size[1] / 2, w: def.size[0], d: def.size[1] };
      if (!others.some((o) => U.rectOverlap(o, r))) { spot = { x, y }; break outer; }
    }
    const id = upd((dd) => Cmd.addItem(dd, fid, type, U.snap(spot.x, 0.25), U.snap(spot.y, 0.25)));
    if (id) S.select({ kind: "furniture", id, floorId: fid });
  };
  Aa.addSite = ({ type }) => { S.setUI({ activeFloorId: S.state.design.floors[0].id }); S.select(null); Aa.addItem({ type }); };

  Aa.setMat = ({ slot, value }) => upd((dd) => (dd.materials[slot] = value));
  Aa.resetRoomMats = () => upd((dd) => dd.floors.forEach((f) => f.rooms.forEach((r) => { r.floorMat = r.wallMat = r.ceilingMat = null; })));

  Aa.extSet = ({ k, value }) => upd((dd) => (dd.exterior[k] = value));
  Aa.extToggle = ({ k }, v) => upd((dd) => (dd.exterior[k] = v));
  Aa.extNum = ({ k }, v) => { if (isFinite(v)) upd((dd) => (dd.exterior[k] = v)); };
  Aa.cwToggle = ({ k }, v) => upd((dd) => (dd.exterior.compound[k] = v));
  Aa.cwNum = ({ k }, v) => { if (isFinite(v)) upd((dd) => (dd.exterior.compound[k] = v)); };
  Aa.cwSet = ({ k, value }) => upd((dd) => (dd.exterior.compound[k] = value));
  Aa.gateSet = ({ k, value }) => upd((dd) => (dd.exterior.compound.gate[k] = value));
  Aa.gateNum = ({ k }, v) => { if (isFinite(v)) upd((dd) => (dd.exterior.compound.gate[k] = v)); };
  // live preview while dragging the slider; one undo step on release
  let gateDragging = false;
  Aa.gatePos = (a, v) => {
    if (!gateDragging) { S.begin(); gateDragging = true; }
    S.update((dd) => (dd.exterior.compound.gate.center = v), { transient: true });
  };
  Aa.gatePosEnd = () => { if (gateDragging) { gateDragging = false; S.end(); } };

  Aa.vastuRulesSave = () => {
    try { const r = JSON.parse(document.getElementById("vastuRules").value); if (!r.rooms || !r.points) throw 0; HD.vastu.setRules(r); S.emit("design"); UI.toast("Vastu rules saved"); }
    catch (_) { UI.toast("Invalid rules JSON", "err"); }
  };
  Aa.vastuRulesReset = () => { HD.vastu.resetRules(); S.emit("design"); UI.toast("Vastu rules reset"); };
  Aa.pricingSave = () => {
    try { const p = JSON.parse(document.getElementById("pricingRules").value); if (!p.grades) throw 0; HD.cost.setPricing(p); S.emit("design"); UI.toast("Pricing saved"); }
    catch (_) { UI.toast("Invalid pricing JSON", "err"); }
  };
  Aa.pricingReset = () => { HD.cost.resetPricing(); S.emit("design"); UI.toast("Pricing reset"); };
})(window.HD);
