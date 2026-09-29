/* Exporters: floor plan (SVG/PNG), 3D image (PNG), design JSON, and the printable design
   summary (Save as PDF from the browser's print dialog). */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, O = HD.orient, Mo = HD.model;
  const esc = U.esc;

  function planSVG(design, floorId, opts = {}) { return HD.plan.exportSVG(design, floorId, opts); }

  function svgToPNG(svg, scale = 1) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.width * scale; cv.height = img.height * scale;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => res(b), "image/png");
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
      img.src = url;
    });
  }

  async function exportPlan(design, floorId, fmt = "svg", opts = {}) {
    const f = design.floors.find((x) => x.id === floorId) || design.floors[0];
    const svg = planSVG(design, f.id, { northUp: opts.northUp, vastuGrid: opts.vastuGrid, pxPerFt: 22 });
    const base = `${U.slug(design.name)}-${U.slug(f.name)}-plan`;
    if (fmt === "svg") U.downloadBlob(new Blob([svg], { type: "image/svg+xml" }), base + ".svg");
    else U.downloadBlob(await svgToPNG(svg, 1), base + ".png");
  }

  function export3D(design, viewer) {
    const url = viewer.screenshot();
    fetch(url).then((r) => r.blob()).then((b) => U.downloadBlob(b, `${U.slug(design.name)}-3d.png`));
  }

  function exportJSON(design) {
    U.downloadBlob(new Blob([JSON.stringify(design, null, 2)], { type: "application/json" }), `${U.slug(design.name)}.json`);
  }

  /** Printable design summary: plans, 3D views, schedules, materials, Vastu, cost. */
  function report(design, viewer) {
    const d = design;
    const s = HD.metrics.designStats(d), e = HD.cost.estimate(d), v = HD.vastu.analyze(d), checks = HD.metrics.validate(d);
    const views = [];
    try { views.push(["3D view", viewer.renderView("orbit")], ["Front elevation", viewer.renderView("front")], ["Top view", viewer.renderView("top")]); } catch (_) {}
    const mat = (id) => esc(C.MAT[id]?.name || id);
    const rooms = d.floors.flatMap((f) => f.rooms.map((r) => ({ f, r, vz: v.items.find((i) => i.roomId === r.id) })));
    const ops = d.floors.flatMap((f) => {
      const walls = G.floorWalls(d, f), byId = (id) => f.rooms.find((r) => r.id === id)?.name || "Outside";
      return f.openings.map((o) => { const w = G.wallOfOpening(walls, o); return { f, o, where: w ? `${byId(w.neg)} / ${byId(w.pos)}` : "—" }; });
    });
    const byGroup = {};
    e.lines.forEach((l) => (byGroup[l.group] = byGroup[l.group] || []).push(l));
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.name)} – Design summary</title>
<style>
@page{size:A4;margin:14mm}body{font-family:Inter,Arial,sans-serif;color:#17232d;margin:0;font-size:12px;line-height:1.45}
.wrap{max-width:900px;margin:0 auto;padding:24px}h1{font-size:26px;margin:0}h2{font-size:16px;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #f08a24}h3{font-size:13px;margin:16px 0 6px}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #12263a;padding-bottom:12px}.brand{font-weight:800;color:#12263a;font-size:13px;letter-spacing:.04em}.muted{color:#5d6b76}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.kpi{border:1px solid #dde3e8;border-radius:8px;padding:8px 10px}.kpi span{display:block;color:#5d6b76;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.kpi b{font-size:15px}
.views{display:grid;grid-template-columns:1fr 1fr;gap:10px}.views figure{margin:0;border:1px solid #dde3e8;border-radius:8px;overflow:hidden}.views figure:first-child{grid-column:1/-1}.views img{width:100%;display:block}.views figcaption{padding:5px 8px;font-size:11px;color:#5d6b76}
.plan{border:1px solid #dde3e8;border-radius:8px;margin-bottom:12px;page-break-inside:avoid}.plan svg{width:100%;height:auto;display:block}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #e6eaee}th{background:#f3f5f7;font-weight:600}.n{text-align:right;white-space:nowrap}
.pill{display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600}.ideal{background:#dff3e6;color:#1f7a45}.good{background:#eaf4dc;color:#4f7a1f}.neutral{background:#fbf0d9;color:#8a6212}.avoid{background:#fbe1dd;color:#a23526}
.total{display:flex;justify-content:space-between;font-size:18px;font-weight:700;background:#12263a;color:#fff;padding:10px 14px;border-radius:8px;margin-top:10px}
.note{font-size:10px;color:#6b7780;margin-top:24px;border-top:1px solid #e6eaee;padding-top:10px}.pb{page-break-before:always}
.bar{position:sticky;top:0;background:#12263a;color:#fff;padding:10px 24px;display:flex;justify-content:space-between;align-items:center}.bar button{background:#f08a24;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:600;cursor:pointer}
@media print{.bar{display:none}.wrap{padding:0}}
</style></head><body>
<div class="bar"><span>Design summary – use “Save as PDF” in the print dialog</span><button onclick="print()">Print / Save as PDF</button></div>
<div class="wrap">
<div class="top"><div><div class="brand">BUILDCRAFT · HOME DESIGNER</div><h1>${esc(d.name)}</h1><div class="muted">${d.meta.variantGroupId ? esc(d.meta.variantLabel) + " · " : ""}Prepared ${today} · Status: ${esc(d.meta.status)}</div></div>
<div class="muted" style="text-align:right">Plot ${U.fmtFt(d.plot.width)} × ${U.fmtFt(d.plot.depth)}<br>${esc(C.FACINGS[d.plot.facing].label)} · ${d.floors.length === 1 ? "Ground floor" : "G+" + (d.floors.length - 1)}</div></div>
<div class="kpis">
<div class="kpi"><span>Type</span><b>${d.meta.bhk === "custom" ? "Custom" : d.meta.bhk + " BHK"}</b></div><div class="kpi"><span>Built-up area</span><b>${U.fmtArea(s.builtUp)}</b></div>
<div class="kpi"><span>Carpet area</span><b>${U.fmtArea(s.carpet)}</b></div><div class="kpi"><span>Estimated cost</span><b>${U.fmtLakh(e.total)}</b></div>
<div class="kpi"><span>Plot area</span><b>${U.fmtArea(s.plotArea)}</b></div><div class="kpi"><span>Ground coverage / FAR</span><b>${Math.round(s.coverage * 100)}% / ${s.far.toFixed(2)}</b></div>
<div class="kpi"><span>Bedrooms / baths</span><b>${s.bedrooms} / ${s.bathrooms}</b></div><div class="kpi"><span>Vastu score</span><b>${v.score}/100</b></div></div>
${views.length ? `<h2>3D views</h2><div class="views">${views.map(([t, u]) => `<figure><img src="${u}"><figcaption>${esc(t)}</figcaption></figure>`).join("")}</div>` : ""}
<h2 class="pb">Floor plans</h2>${d.floors.map((f) => `<div class="plan">${planSVG(d, f.id, { pxPerFt: 10 })}</div>`).join("")}
<h2>Room schedule</h2><table><tr><th>Floor</th><th>Room</th><th class="n">Size</th><th class="n">Area</th><th>Flooring</th><th>Walls</th><th>Direction</th></tr>
${rooms.map(({ f, r, vz }) => `<tr><td>${esc(f.name)}</td><td>${esc(r.name)}</td><td class="n">${U.fmtDims(r.w, r.d)}</td><td class="n">${Math.round(r.w * r.d)} sq ft</td><td>${mat(Mo.roomFloorMat(d, r))}</td><td>${C.ROOM_TYPES[r.type].enclosed ? mat(Mo.roomWallMat(d, r)) : "—"}</td><td>${vz ? `${esc(O.DIR_NAMES[vz.zone])} <span class="pill ${vz.status}">${vz.status}</span>` : ""}</td></tr>`).join("")}</table>
<h2>Door & window schedule</h2><table><tr><th>Floor</th><th>Type</th><th>Style</th><th class="n">Width × height</th><th class="n">Sill</th><th>Between</th><th>Material</th></tr>
${ops.map(({ f, o, where }) => `<tr><td>${esc(f.name)}</td><td>${o.main ? "Main door" : o.kind === "door" ? "Door" : "Window"}</td><td>${esc((o.kind === "door" ? C.DOOR_STYLES : C.WINDOW_STYLES)[o.style]?.label || o.style)}</td><td class="n">${U.fmtFt(o.width)} × ${U.fmtFt(o.height)}</td><td class="n">${o.kind === "window" ? U.fmtFt(o.sill) : "—"}</td><td>${esc(where)}</td><td>${mat(o.material || (o.kind === "door" ? (o.main ? d.materials.mainDoor : d.materials.door) : d.materials.window))}</td></tr>`).join("")}</table>
<h2>Materials & exterior</h2><table>
<tr><th>Flooring (default)</th><td>${mat(d.materials.floor)}</td><th>Bathroom flooring</th><td>${mat(d.materials.bathFloor)}</td></tr>
<tr><th>Interior walls</th><td>${mat(d.materials.wall)}</td><th>Bath / kitchen walls</th><td>${mat(d.materials.bathWall)} / ${mat(d.materials.kitchenWall)}</td></tr>
<tr><th>Ceiling</th><td>${mat(d.materials.ceiling)}</td><th>Doors / main door</th><td>${mat(d.materials.door)} / ${mat(d.materials.mainDoor)}</td></tr>
<tr><th>Windows</th><td>${mat(d.materials.window)}</td><th>Exterior walls</th><td>${mat(d.exterior.wall)}${d.exterior.accentOn ? " + front accent " + mat(d.exterior.accent) : ""}</td></tr>
<tr><th>Roof</th><td>${esc(C.ROOF_TYPES[d.exterior.roofType])}${d.exterior.roofType !== "flat" ? " – " + mat(d.exterior.roofMaterial) : ""}</td><th>Railings</th><td>${mat(d.exterior.railing)}</td></tr>
<tr><th>Compound wall</th><td>${d.exterior.compound.on ? U.fmtFt(d.exterior.compound.height) + " – " + mat(d.exterior.compound.material) : "None"}</td><th>Gate</th><td>${esc(C.GATE_STYLES[d.exterior.compound.gate.style].label)} ${U.fmtFt(d.exterior.compound.gate.width)}</td></tr></table>
<h2 class="pb">Vastu analysis <span class="muted" style="font-weight:400">— score ${v.score}/100, ${esc(C.FACINGS[d.plot.facing].label)}</span></h2>
${v.entrance ? `<p><span class="pill ${v.entrance.status}">${v.entrance.status}</span> ${esc(v.entrance.message)}</p>` : ""}
<table><tr><th>Room</th><th>Floor</th><th>Zone</th><th>Status</th><th>Remark</th></tr>${v.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.floorName)}</td><td>${esc(O.DIR_NAMES[i.zone])}</td><td><span class="pill ${i.status}">${i.status}</span></td><td>${esc(i.message)}</td></tr>`).join("")}</table>
<h2>Cost estimate <span class="muted" style="font-weight:400">— ${esc(C.GRADES[e.grade])} specification</span></h2>
${Object.entries(byGroup).map(([g, ls]) => `<h3>${esc(g)}</h3><table>${ls.map((l) => `<tr><td>${esc(l.item)}</td><td class="n">${U.fmtNum(l.qty, l.qty < 10 ? 1 : 0)} ${esc(l.unit)}</td><td class="n">${U.fmtINR(l.rate)}</td><td class="n">${U.fmtINR(l.amount)}</td></tr>`).join("")}</table>`).join("")}
<div class="total"><span>Estimated total</span><span>${U.fmtINR(e.total)} (${U.fmtINR(e.perSqft)}/sq ft)</span></div>
<h3>Indicative material quantities</h3><table>${e.quantities.map((q) => `<tr><td>${esc(q.item)}</td><td class="n">${U.fmtNum(q.qty)} ${esc(q.unit)}</td></tr>`).join("")}</table>
${checks.length ? `<h2>Design checks</h2><table>${checks.map((c) => `<tr><td>${c.level}</td><td>${esc(c.msg)}</td></tr>`).join("")}</table>` : ""}
<p class="note">This summary is generated from the design configurator. Areas are measured to wall centre-lines. Costs and material quantities are indicative estimates based on configurable rates and thumb rules and must be confirmed by a detailed quotation. Vastu guidance is advisory. Structural design, statutory approvals and site conditions are not covered.</p>
</div></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { HD.ui.toast("Allow pop-ups to open the design summary", "err"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  HD.exporter = { planSVG, exportPlan, export3D, exportJSON, report, svgToPNG };
})(window.HD);
