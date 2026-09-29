/* Dashboard (saved designs, continue, compare) and the New Design wizard. */
(function (HD) {
  const U = HD.util, C = HD.catalog, O = HD.orient, UI = HD.ui, R = () => HD.persist.repo;
  const esc = U.esc, A = UI.A;

  const ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const Dash = {
    compareSel: new Set(),
    async render() {
      document.body.dataset.page = "home";
      const el = document.getElementById("home");
      const list = await R().list();
      const last = list.find((x) => x.id === R().lastOpened()) || list[0];
      el.innerHTML = `
        <header class="topbar home-top"><a class="brand" href="#/"><span class="logo">B</span><span class="bt"><b>BuildCraft</b><small>Home Designer</small></span></a><div class="grow"></div>
          <button class="btn ghost" data-act="importJSON">Import design</button><button class="btn primary" data-act="newDesign">+ New design</button></header>
        <main class="home-main">
          <section class="hero">
            <div><h1>Design your home in 3D</h1><p>Pick a plot, choose 1–4 BHK and facing, and get a complete, editable floor plan with doors, windows, furniture, Vastu analysis and a cost estimate — in seconds.</p>
              <div class="hero-cta"><button class="btn primary lg" data-act="newDesign">Start a new design</button>${last ? `<button class="btn lg" data-act="openDesign"${A({ id: last.id })}>Continue “${esc(last.name)}”</button>` : ""}</div></div>
            <ol class="flow"><li>Plot</li><li>BHK</li><li>Facing</li><li>Customise</li><li>3D</li><li>Share</li></ol>
          </section>
          <div class="list-head"><h2>Your designs <span>${list.length}</span></h2>
            <button class="btn" data-act="compareSelected" ${this.compareSel.size < 2 ? "disabled" : ""}>Compare selected (${this.compareSel.size})</button></div>
          ${list.length ? `<div class="cards">${list.map((x) => this.card(x)).join("")}</div>` : `<div class="empty-home"><p>No designs yet. Create your first design to get started.</p></div>`}
        </main>`;
    },
    card(x) {
      const th = R().thumbnail(x.id);
      return `<article class="card">
        <label class="cmp" title="Select to compare"><input type="checkbox" data-change="cmpToggle"${A({ id: x.id })} ${this.compareSel.has(x.id) ? "checked" : ""}></label>
        <div class="thumb" data-act="openDesign"${A({ id: x.id })}>${th ? `<img src="${th}" alt="">` : `<div class="ph">🏠</div>`}</div>
        <div class="card-body" data-act="openDesign"${A({ id: x.id })}>
          <h3>${esc(x.name)}</h3>
          <div class="chips">${UI.chip(x.bhk === "custom" ? "Custom" : x.bhk + " BHK")}${UI.chip(`${x.plot.w}×${x.plot.d}`)}${UI.chip(O.DIR_NAMES[x.facing] + " facing")}${UI.chip(x.floors === 1 ? "G" : "G+" + (x.floors - 1))}${x.variantGroupId ? UI.chip(x.variantLabel, "var") : ""}</div>
          <div class="card-stats"><span>${U.fmtArea(x.builtUp)}</span><span>${U.fmtLakh(x.estimate)}</span><span>Vastu ${x.vastu}</span></div>
          <small>Edited ${ago(x.updatedAt)}</small>
        </div>
        <footer><button class="btn small" data-act="dupDesign"${A({ id: x.id })}>Duplicate</button><button class="btn small" data-act="variantOf"${A({ id: x.id })}>Variant</button><button class="btn small danger ghost" data-act="delDesign"${A({ id: x.id })}>Delete</button></footer>
      </article>`;
    }
  };

  /* ---------------- wizard ---------------- */
  function wizard() {
    const s = { step: 0, w: 30, d: 40, bhk: 2, floors: 1, facing: "E", grade: "standard", vastu: true, furnish: true, parking: true, name: "" };
    const m = UI.modal(`<div class="wiz"></div>`, { title: "New design", cls: "wide" });
    const root = m.el.querySelector(".wiz");
    const steps = ["Plot", "Building type", "Facing", "Finish"];
    const draw = () => {
      const facingSvg = (k) => {
        const b = C.FACINGS[k].bearing, a = (180 - b + 360) % 360;
        return `<svg viewBox="-30 -30 60 60" class="fsvg"><rect x="-14" y="-16" width="28" height="24" rx="2" class="h"/><rect x="-22" y="12" width="44" height="8" class="rd"/><text x="0" y="18" class="rt">ROAD</text>
          <g transform="rotate(${a})"><path d="M0 -27 L4 -19 L-4 -19 Z" class="na"/><text x="0" y="-19" class="nt" transform="rotate(${-a} 0 -23)">N</text></g></svg>`;
      };
      const body = [
        `<h3>Plot dimensions</h3><p class="hint">Width is along the road (front). Setbacks are set automatically and can be edited later.</p>
          <div class="chips">${C.PLOT_PRESETS.map((p) => `<button class="chip-btn ${p.w === s.w && p.d === s.d ? "on" : ""}" data-w="${p.w}" data-d="${p.d}">${p.label}</button>`).join("")}</div>
          <div class="grid2"><label class="field"><span>Width (ft)</span><div class="inp"><input type="number" id="wzW" value="${s.w}" min="15" max="200"></div></label><label class="field"><span>Depth (ft)</span><div class="inp"><input type="number" id="wzD" value="${s.d}" min="20" max="300"></div></label></div>
          <p class="hint">Plot area: <b>${U.fmtArea(s.w * s.d)}</b></p>`,
        `<h3>BHK / building type</h3><div class="bhk-grid">${[1, 2, 3, 4, "custom"].map((b) => `<button class="bhk ${String(s.bhk) === String(b) ? "on" : ""}" data-bhk="${b}"><b>${b === "custom" ? "Custom" : b + " BHK"}</b><span>${b === "custom" ? "Draw your own" : ["", "Compact home", "Most popular", "Family home", "Large home"][b]}</span></button>`).join("")}</div>
          <h3>Floors</h3><div class="seg">${[1, 2, 3, 4].map((n) => `<button class="${s.floors === n ? "on" : ""}" data-fl="${n}">${n === 1 ? "G (single floor)" : "G+" + (n - 1)}</button>`).join("")}</div>`,
        `<h3>Which way does the plot face?</h3><p class="hint">Facing = the direction you look when you stand at the main entrance facing the road.</p>
          <div class="facing-cards">${Object.entries(C.FACINGS).map(([k, f]) => `<button class="fcard ${s.facing === k ? "on" : ""}" data-fc="${k}">${facingSvg(k)}<b>${f.label}</b></button>`).join("")}</div>`,
        `<h3>Almost done</h3><label class="field"><span>Design name</span><div class="inp"><input type="text" id="wzName" value="${esc(s.name || `${s.bhk === "custom" ? "Custom" : s.bhk + " BHK"} · ${s.w}×${s.d} · ${C.FACINGS[s.facing].label}`)}"></div></label>
          <h3>Specification</h3><div class="seg">${Object.entries(C.GRADES).map(([k, l]) => `<button class="${s.grade === k ? "on" : ""}" data-gr="${k}">${l}</button>`).join("")}</div>
          <div class="wz-opts"><label class="toggle"><input type="checkbox" id="wzV" ${s.vastu ? "checked" : ""}><i></i><span>Vastu-optimised room placement</span></label>
          <label class="toggle"><input type="checkbox" id="wzF" ${s.furnish ? "checked" : ""}><i></i><span>Furnish rooms</span></label>
          <label class="toggle"><input type="checkbox" id="wzP" ${s.parking ? "checked" : ""}><i></i><span>Car parking (if space)</span></label></div>`
      ][s.step];
      root.innerHTML = `<ol class="wz-steps">${steps.map((l, i) => `<li class="${i === s.step ? "on" : i < s.step ? "done" : ""}">${i + 1}. ${l}</li>`).join("")}</ol>
        <div class="wz-body">${body}</div>
        <div class="modal-actions">${s.step ? `<button class="btn" data-back>Back</button>` : `<span></span>`}${s.step < 3 ? `<button class="btn primary" data-next>Next</button>` : `<button class="btn primary" data-create>Create design</button>`}</div>`;
    };
    const read = () => {
      const w = root.querySelector("#wzW"), d = root.querySelector("#wzD"), n = root.querySelector("#wzName");
      if (w) s.w = U.clamp(+w.value || 30, 15, 200);
      if (d) s.d = U.clamp(+d.value || 40, 20, 300);
      if (n) s.name = n.value;
      ["V", "F", "P"].forEach((k) => { const el = root.querySelector("#wz" + k); if (el) s[{ V: "vastu", F: "furnish", P: "parking" }[k]] = el.checked; });
    };
    root.addEventListener("click", async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      read();
      if (t.dataset.w) { s.w = +t.dataset.w; s.d = +t.dataset.d; }
      if (t.dataset.bhk) s.bhk = t.dataset.bhk === "custom" ? "custom" : +t.dataset.bhk;
      if (t.dataset.fl) s.floors = +t.dataset.fl;
      if (t.dataset.fc) s.facing = t.dataset.fc;
      if (t.dataset.gr) s.grade = t.dataset.gr;
      if ("next" in t.dataset) s.step++;
      if ("back" in t.dataset) s.step--;
      if ("create" in t.dataset) {
        const d = HD.model.createDesign({ width: s.w, depth: s.d, facing: s.facing, bhk: s.bhk, grade: s.grade, name: s.name });
        HD.gen.generate(d, { bhk: s.bhk, floors: s.floors, vastu: s.vastu, furnish: s.furnish, parking: s.parking });
        d.name = s.name || d.name;
        d.meta.ui.step = "rooms";
        await R().save(d);
        m.close();
        location.hash = "#/d/" + d.id;
        return;
      }
      draw();
    });
    root.addEventListener("input", (e) => { if (e.target.id === "wzW" || e.target.id === "wzD") { read(); const h = root.querySelector(".wz-body .hint:last-child b"); if (h) h.textContent = U.fmtArea(s.w * s.d); } });
    draw();
  }

  /* ---------------- actions ---------------- */
  const Aa = UI.actions;
  Aa.newDesign = () => wizard();
  Aa.openDesign = ({ id }) => { location.hash = "#/d/" + id; };
  Aa.dupDesign = async ({ id }) => { await R().duplicate(id); UI.toast("Design duplicated"); Dash.render(); };
  Aa.variantOf = async ({ id }) => { const n = await R().duplicate(id, { variant: true }); UI.toast(`${n.meta.variantLabel} created`); Dash.render(); };
  Aa.delDesign = async ({ id }) => {
    const x = (await R().list()).find((i) => i.id === id);
    if (await UI.confirm(`Delete <b>${esc(x?.name || "this design")}</b>? This cannot be undone.`, { danger: true, ok: "Delete" })) { await R().remove(id); Dash.compareSel.delete(id); Dash.render(); }
  };
  Aa.cmpToggle = ({ id }, v) => { v ? Dash.compareSel.add(id) : Dash.compareSel.delete(id); Dash.render(); };
  Aa.compareSelected = () => HD.dialogs.compare([...Dash.compareSel]);
  Aa.importJSON = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const d = HD.model.migrate(JSON.parse(await f.text()));
        d.id = U.uid("dsn");
        d.name = d.name + " (imported)";
        await R().save(d);
        location.hash = "#/d/" + d.id;
      } catch (e) { UI.toast("That file is not a valid design", "err"); }
    };
    inp.click();
  };

  HD.dashboard = Dash;
})(window.HD);
