/* Dialogs: export menu, share, compare, variants, make-a-copy. */
(function (HD) {
  const U = HD.util, C = HD.catalog, O = HD.orient, S = HD.store, UI = HD.ui, X = HD.exporter;
  const esc = U.esc;
  const R = () => HD.persist.repo;
  const viewer = () => HD.editor.viewer;

  const D = {};

  D.exportMenu = () => {
    const d = S.state.design, f = S.activeFloor();
    const m = UI.modal(`<div class="export-grid">
      <button data-x="report"><b>📄 Design summary / PDF</b><span>Plans, 3D views, schedules, Vastu and cost — print or save as PDF</span></button>
      <button data-x="svg"><b>🗺️ Floor plan – SVG</b><span>${esc(f.name)}, vector, dimensioned, with north arrow</span></button>
      <button data-x="png"><b>🖼️ Floor plan – PNG</b><span>${esc(f.name)}, high resolution image</span></button>
      <button data-x="allpng"><b>🗂️ All floor plans – PNG</b><span>${d.floors.length} file${d.floors.length > 1 ? "s" : ""}</span></button>
      <button data-x="3d"><b>🏠 3D view – PNG</b><span>Exactly what the 3D view shows now</span></button>
      <button data-x="json"><b>{ } Design data – JSON</b><span>Full design, re-importable</span></button></div>
      <label class="toggle"><input type="checkbox" id="xNorth"><i></i><span>Rotate plans so North is up</span></label>`, { title: "Export", cls: "medium" });
    m.el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-x]");
      if (!b) return;
      const northUp = m.el.querySelector("#xNorth").checked;
      const x = b.dataset.x, dd = S.state.design;
      if (x === "report") X.report(dd, viewer());
      if (x === "svg" || x === "png") await X.exportPlan(dd, S.activeFloor().id, x, { northUp });
      if (x === "allpng") for (const fl of dd.floors) await X.exportPlan(dd, fl.id, "png", { northUp });
      if (x === "3d") X.export3D(dd, viewer());
      if (x === "json") X.exportJSON(dd);
      m.close();
    });
  };

  D.share = async () => {
    const d = S.state.design;
    const m = UI.modal(`<p class="hint">Creating link…</p>`, { title: "Share design", cls: "medium" });
    let code;
    try { code = await HD.persist.encodeShare({ ...d, meta: { ...d.meta, ui: { ...d.meta.ui } } }); }
    catch (e) { m.el.querySelector(".modal-body").innerHTML = `<p>Could not create a link in this browser.</p>`; return; }
    const url = location.href.split("#")[0] + "#share=" + code;
    const body = encodeURIComponent(`Hello,\n\nPlease review the home design "${d.name}" (${d.meta.bhk === "custom" ? "custom" : d.meta.bhk + " BHK"}, plot ${d.plot.width}×${d.plot.depth}, ${C.FACINGS[d.plot.facing].label}).\n\nOpen it here (view-only, interactive 2D + 3D):\n${url}\n\nRegards`);
    m.el.querySelector(".modal-body").innerHTML = `
      <p>Anyone with this link can open an <b>interactive, view-only copy</b> of the design as it is now (2D plan, 3D model, Vastu and cost). They can make their own editable copy.</p>
      <div class="share-row"><input type="text" readonly value="${esc(url)}" id="shareUrl"><button class="btn primary" id="copyBtn">Copy link</button></div>
      <p class="hint">Link length: ${U.fmtNum(url.length)} characters — the design travels inside the link, no account needed.</p>
      <h3>Send to a client</h3>
      <div class="grid2"><label class="field"><span>Client email</span><div class="inp"><input type="email" id="clientEmail" placeholder="client@example.com"></div></label>
      <div class="field"><span>&nbsp;</span><a class="btn" id="mailBtn" href="#">Open in email app</a></div></div>
      <div class="btn-row"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Preview shared view ↗</a><button class="btn" data-x="report">Attach: design summary / PDF</button></div>
      <p class="hint">Production: links become signed tokens with roles (viewer / commenter / approver), expiry and an approval workflow — see docs/ARCHITECTURE.md §12.</p>`;
    const inp = m.el.querySelector("#shareUrl");
    m.el.querySelector("#copyBtn").onclick = async () => {
      try { await navigator.clipboard.writeText(url); UI.toast("Link copied"); } catch (_) { inp.select(); document.execCommand("copy"); UI.toast("Link copied"); }
    };
    const mail = m.el.querySelector("#mailBtn"), em = m.el.querySelector("#clientEmail");
    const upd = () => (mail.href = `mailto:${encodeURIComponent(em.value)}?subject=${encodeURIComponent("Home design: " + d.name)}&body=${body}`);
    em.addEventListener("input", upd); upd();
    m.el.querySelector('[data-x="report"]').onclick = () => X.report(S.state.design, viewer());
  };

  D.compare = async (ids) => {
    const list = await R().list();
    const cur = S.state.design;
    let chosen = ids && ids.length ? ids : cur ? list.filter((x) => x.id === cur.id || (cur.meta.variantGroupId && (x.variantGroupId === cur.meta.variantGroupId || x.id === cur.meta.variantGroupId))).map((x) => x.id) : [];
    if (chosen.length < 2) chosen = list.slice(0, 3).map((x) => x.id);
    const m = UI.modal(`<div class="cmp-pick"></div><div class="cmp-table"></div>`, { title: "Compare designs", cls: "wide" });
    const draw = async () => {
      m.el.querySelector(".cmp-pick").innerHTML = `<p class="hint">Choose up to 4 designs:</p><div class="chips">${list.map((x) => `<label class="chip-btn ${chosen.includes(x.id) ? "on" : ""}"><input type="checkbox" data-id="${x.id}" ${chosen.includes(x.id) ? "checked" : ""} hidden>${esc(x.name)}</label>`).join("")}</div>`;
      const ds = (await Promise.all(chosen.slice(0, 4).map((id) => R().get(id)))).filter(Boolean);
      if (!ds.length) { m.el.querySelector(".cmp-table").innerHTML = `<p class="hint">Save at least two designs (use “+ Variant”) to compare.</p>`; return; }
      const rows = ds.map((d) => { const s = HD.metrics.designStats(d), e = HD.cost.estimate(d), v = HD.vastu.analyze(d); return { d, s, e, v, kitchen: Math.max(0, ...d.floors.flatMap((f) => f.rooms).filter((r) => r.type === "kitchen").map((r) => r.w * r.d)) }; });
      const best = (f, dir = 1) => { const vals = rows.map(f); const b = dir > 0 ? Math.max(...vals) : Math.min(...vals); return (r) => (f(r) === b && rows.length > 1 ? "best" : ""); };
      const line = (label, f, fmt, dir) => { const b = dir ? best(f, dir) : () => ""; return `<tr><th>${label}</th>${rows.map((r) => `<td class="${b(r)}">${fmt(f(r), r)}</td>`).join("")}</tr>`; };
      m.el.querySelector(".cmp-table").innerHTML = `<table class="cmp"><tr><th></th>${rows.map((r) => `<th>${R().thumbnail(r.d.id) ? `<img src="${R().thumbnail(r.d.id)}">` : ""}<b>${esc(r.d.name)}</b>${r.d.meta.variantGroupId ? `<small>${esc(r.d.meta.variantLabel)}</small>` : ""}<button class="btn small" data-open="${r.d.id}">Open</button></th>`).join("")}</tr>
        ${line("Type", (r) => r.d.meta.bhk, (x) => (x === "custom" ? "Custom" : x + " BHK"))}
        ${line("Plot", (r) => r.d.plot.width * r.d.plot.depth, (x, r) => `${r.d.plot.width}×${r.d.plot.depth}`)}
        ${line("Facing", (r) => r.d.plot.facing, (x) => O.DIR_NAMES[x])}
        ${line("Floors", (r) => r.d.floors.length, (x) => (x === 1 ? "G" : "G+" + (x - 1)))}
        ${line("Built-up area", (r) => r.s.builtUp, U.fmtArea, 1)}
        ${line("Carpet area", (r) => r.s.carpet, U.fmtArea, 1)}
        ${line("Largest kitchen", (r) => r.kitchen, U.fmtArea, 1)}
        ${line("Bedrooms / baths", (r) => r.s.bedrooms * 10 + r.s.bathrooms, (x, r) => `${r.s.bedrooms} / ${r.s.bathrooms}`)}
        ${line("Doors / windows", (r) => r.s.windows, (x, r) => `${r.s.doors} / ${r.s.windows}`, 1)}
        ${line("Vastu score", (r) => r.v.score, (x) => x + "/100", 1)}
        ${line("Estimate", (r) => r.e.total, U.fmtLakh, -1)}
        ${line("Cost / sq ft", (r) => r.e.perSqft, U.fmtINR, -1)}
        ${line("Flooring", (r) => r.d.materials.floor, (x) => esc(C.MAT[x]?.name))}
        ${line("Exterior", (r) => r.d.exterior.wall, (x, r) => esc(C.MAT[x]?.name) + (r.d.exterior.accentOn ? " + " + esc(C.MAT[r.d.exterior.accent]?.name) : ""))}
        ${line("Roof", (r) => r.d.exterior.roofType, (x) => esc(C.ROOF_TYPES[x]))}
        ${line("Specification", (r) => r.d.settings.grade, (x) => C.GRADES[x])}</table>`;
    };
    m.el.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      chosen = e.target.checked ? [...chosen, id].slice(-4) : chosen.filter((x) => x !== id);
      draw();
    });
    m.el.addEventListener("click", (e) => { const o = e.target.closest("[data-open]"); if (o) { m.close(); location.hash = "#/d/" + o.dataset.open; } });
    draw();
  };

  D.variant = async () => {
    const d = S.state.design;
    HD.persist.saveNow();
    await R().save(d, viewer().thumbnail());
    const n = await R().duplicate(d.id, { variant: true });
    if (!n) return;
    UI.toast(`${n.meta.variantLabel} created — you are now editing it`);
    location.hash = "#/d/" + n.id;
  };

  D.makeCopy = async () => {
    const d = HD.util.clone(S.state.design);
    d.id = HD.util.uid("dsn");
    d.name = d.name + " (my copy)";
    d.meta.variantGroupId = null;
    await R().save(d);
    location.hash = "#/d/" + d.id;
  };

  const Aa = UI.actions;
  Aa.exportMenu = D.exportMenu;
  Aa.share = D.share;
  Aa.compare = () => D.compare();
  Aa.variant = D.variant;
  Aa.makeCopy = D.makeCopy;
  Aa.exportReport = () => X.report(S.state.design, viewer());
  Aa.exportPlan = ({ fmt }) => X.exportPlan(S.state.design, S.activeFloor().id, fmt, { northUp: S.state.ui.display.northUp });
  Aa.export3D = () => X.export3D(S.state.design, viewer());
  Aa.exportJSON = () => X.exportJSON(S.state.design);

  HD.dialogs = D;
})(window.HD);
