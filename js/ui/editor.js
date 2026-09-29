/* Editor shell: layout, top bar, workflow steps, view toolbar, status bar, keyboard shortcuts,
   and the render loop that keeps 2D, 3D and panels in sync with the store. */
(function (HD) {
  const U = HD.util, C = HD.catalog, S = HD.store, Cmd = HD.cmd, UI = HD.ui, O = HD.orient;
  const esc = U.esc, A = UI.A;

  const Editor = {
    root: null, viewer: null, plan: null, built: false,

    build() {
      if (this.built) return;
      this.built = true;
      const el = (this.root = document.getElementById("editor"));
      el.innerHTML = `
        <header class="topbar">
          <a class="brand" href="#/" title="All designs"><span class="logo">B</span><span class="bt"><b>BuildCraft</b><small>Home Designer</small></span></a>
          <div class="docname"><input id="docName" data-change="rename" data-key="docName" aria-label="Design name"><span id="variantChip" class="chip"></span><span id="saveStatus" class="save"></span></div>
          <div class="grow"></div>
          <div class="tb">
            <button class="icon" id="undoBtn" data-act="undo" title="Undo (Ctrl+Z)">↶</button>
            <button class="icon" id="redoBtn" data-act="redo" title="Redo (Ctrl+Y)">↷</button>
            <span class="sep"></span>
            <button class="btn ghost" data-act="goHome">Designs</button>
            <button class="btn ghost hide-sm" data-act="variant" id="variantBtn">+ Variant</button>
            <button class="btn ghost hide-sm" data-act="compare">Compare</button>
            <button class="btn ghost" data-act="exportMenu">Export</button>
            <button class="btn primary" data-act="share">Share</button>
          </div>
        </header>
        <div id="roBar" class="robar" hidden>You are viewing a shared design (read-only). <button class="btn small primary" data-act="makeCopy">Make an editable copy</button></div>
        <nav class="steps" id="steps"></nav>
        <div class="main">
          <aside class="left" id="left"></aside>
          <section class="center">
            <div class="viewbar" id="viewbar"></div>
            <div class="views" id="views">
              <div class="pane plan-pane" id="planPane"><span class="pane-tag">2D plan</span>
                <div class="zoomctl"><button data-act="planZoom" ${A({ k: 1.25 })} title="Zoom in">+</button><button data-act="planZoom" ${A({ k: 0.8 })} title="Zoom out">−</button><button data-act="planFit" title="Fit">⤢</button></div></div>
              <div class="pane v3d-pane" id="v3dPane"><span class="pane-tag">3D</span><div class="zoomctl"><button data-act="v3dZoom" ${A({ k: 0.8 })} title="Zoom in">+</button><button data-act="v3dZoom" ${A({ k: 1.25 })} title="Zoom out">−</button><button data-act="camView" ${A({ value: "orbit" })} title="Reset view">⤢</button></div></div>
            </div>
            <div class="placebar" id="placebar" hidden></div>
          </section>
          <aside class="right" id="right"></aside>
        </div>
        <footer class="statusbar" id="status"></footer>`;
      this.plan = new HD.plan.PlanView(document.getElementById("planPane"));
      this.viewer = new HD.Viewer(document.getElementById("v3dPane"));
      S.subscribe((st, ch) => this.onChange(st, ch));
      this.bindKeys();
    },

    fitViews() {
      requestAnimationFrame(() => { this.plan.fit(); this.plan.render(S.state, true); this.viewer.setView(this.viewer.view === "interior" ? "orbit" : this.viewer.view || "orbit"); });
    },

    open(design, opts = {}) {
      this.build();
      S.load(design, opts);
      this.viewer.framed = false;
      this.plan.view = null;
      document.body.dataset.page = "editor";
      requestAnimationFrame(() => { this.plan.fit(); this.viewer.resize(); });
    },

    panelTimer: null,
    onChange(st, ch) {
      if (!st.design || document.body.dataset.page !== "editor") return;
      if (ch.design || ch.ui || ch.selection) {
        this.plan.render(st);
        this.viewer.sync(st);
        this.schedulePanels();
      } else if (ch.hover) this.viewer.applyHighlight(st);
      if (ch.save || ch.design) this.renderSave(st);
    },
    schedulePanels() {
      if (this.panelTimer) return;
      this.panelTimer = setTimeout(() => { this.panelTimer = null; this.renderPanels(S.state); }, 40);
    },

    renderPanels(st) {
      const d = st.design;
      const ro = st.ui.readOnly;
      document.getElementById("roBar").hidden = !ro;
      this.root.classList.toggle("has-sel", !!st.selection);
      const nm = document.getElementById("docName");
      if (document.activeElement !== nm) nm.value = d.name;
      nm.disabled = ro;
      document.getElementById("variantChip").textContent = d.meta.variantGroupId ? d.meta.variantLabel : "";
      document.getElementById("variantChip").hidden = !d.meta.variantGroupId;
      document.getElementById("undoBtn").disabled = !S.canUndo() || ro;
      document.getElementById("redoBtn").disabled = !S.canRedo() || ro;
      document.getElementById("variantBtn").disabled = ro;
      // steps
      UI.renderInto(document.getElementById("steps"), UI.STEPS.map(([k, l, ic], i) => `<button class="${st.ui.step === k ? "on" : ""}" data-act="step"${A({ value: k })}><span class="n">${i + 1}</span><span class="ic">${ic}</span><span class="l">${l}</span></button>`).join(""));
      UI.renderInto(document.getElementById("left"), UI.renderLeft(st));
      UI.renderInto(document.getElementById("right"), UI.renderRight(st));
      UI.renderInto(document.getElementById("viewbar"), this.viewbarHTML(st));
      const views = document.getElementById("views");
      const mode = st.ui.view;
      if (views.dataset.mode !== mode) { views.dataset.mode = mode; setTimeout(() => { this.viewer.resize(); this.plan.applyViewBox(); }, 0); }
      const pb = document.getElementById("placebar");
      const pm = st.ui.placeMode;
      pb.hidden = !pm;
      if (pm) pb.innerHTML = `Placing <b>${esc((pm.kind === "door" ? C.DOOR_STYLES : C.WINDOW_STYLES)[pm.style].label)} ${pm.kind}</b> — click on a wall (Shift-click to place several) <button class="btn small" data-act="cancelPlace">Cancel (Esc)</button>`;
      this.renderStatus(st);
    },

    viewbarHTML(st) {
      const d = st.design, disp = st.ui.display, v = this.viewer?.view || "orbit";
      const floors = d.floors.map((f) => `<button class="${f.id === st.ui.activeFloorId ? "on" : ""}" data-act="floor"${A({ id: f.id })} title="${esc(f.name)}">${f.level === 0 ? "Ground" : f.name.replace(" Floor", "")}</button>`).join("");
      const cams = { orbit: "3D", top: "Top", front: "Front", side: "Side", back: "Rear", interior: "Interior" };
      return `<div class="vb-group floors">${floors}${st.ui.readOnly ? "" : `<button class="add" data-act="addFloor"${A({ mode: "stairs" })} title="Add floor">+</button>`}</div>
        <div class="vb-group">${UI.seg({ "2d": "2D", split: "Split", "3d": "3D" }, st.ui.view, "viewMode")}</div>
        <div class="vb-group cams ${st.ui.view === "2d" ? "dim" : ""}">${UI.seg(cams, v, "camView")}</div>
        <div class="vb-group toggles">
          ${UI.seg({ upto: "Up to this floor", all: "All floors" }, disp.floors, "dispSeg", { k: "floors" })}
          ${UI.toggle("Cut-away", disp.cutaway, "disp", { k: "cutaway" })}
          ${UI.toggle("Labels", disp.labels, "disp", { k: "labels" })}
          ${UI.toggle("Furniture", disp.furniture, "disp", { k: "furniture" })}
          <label class="sun" title="Sun position (time of day)">☀<input type="range" min="6" max="18" step="0.5" value="${disp.sunHour}" data-input="sun" data-key="sun"><em>${String(Math.floor(disp.sunHour)).padStart(2, "0")}:${disp.sunHour % 1 ? "30" : "00"}</em></label>
          <button class="icon" data-act="export3D" title="Save 3D image">📷</button>
        </div>`;
    },

    renderSave(st) {
      const el = document.getElementById("saveStatus");
      if (!el) return;
      if (st.ui.readOnly) { el.textContent = "View only"; el.className = "save ro"; return; }
      const m = { saved: "✓ Saved", saving: "Saving…", error: "⚠ Not saved" }[st.saveStatus] || "";
      el.textContent = m;
      el.className = "save " + st.saveStatus;
    },

    renderStatus(st) {
      const d = st.design, s = HD.metrics.designStats(d), e = HD.cost.estimate(d), v = HD.vastu.analyze(d);
      UI.renderInto(document.getElementById("status"), [
        `<span><em>Plot</em> ${U.fmtFt(d.plot.width)} × ${U.fmtFt(d.plot.depth)} · ${U.fmtArea(s.plotArea)}</span>`,
        `<span><em>Facing</em> ${O.DIR_NAMES[d.plot.facing]}</span>`,
        `<span><em>Built-up</em> ${U.fmtArea(s.builtUp)}</span>`,
        `<span><em>Carpet</em> ${U.fmtArea(s.carpet)}</span>`,
        `<span class="hide-sm"><em>Coverage</em> ${Math.round(s.coverage * 100)}%</span>`,
        `<span class="hide-sm"><em>FAR</em> ${s.far.toFixed(2)}</span>`,
        `<span data-act="step"${A({ value: "vastu" })} class="link"><em>Vastu</em> ${v.score}/100</span>`,
        `<span data-act="step"${A({ value: "cost" })} class="link strong"><em>Estimate</em> ${U.fmtLakh(e.total)}</span>`
      ].join(""));
    },

    bindKeys() {
      document.addEventListener("keydown", (e) => {
        if (document.body.dataset.page !== "editor" || document.querySelector(".modal-back")) return;
        const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
        const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        if (mod && k === "z" && !typing) { e.preventDefault(); e.shiftKey ? S.redo() : S.undo(); return; }
        if (mod && k === "y" && !typing) { e.preventDefault(); S.redo(); return; }
        if (typing) return;
        const st = S.state, sel = st.selection;
        if (e.key === "Escape") { if (st.ui.placeMode) S.setUI({ placeMode: null }); else S.select(null); return; }
        if (!sel || st.ui.readOnly) return;
        if (mod && k === "d") {
          e.preventDefault();
          if (sel.kind === "furniture") UI.actions.itemDup({ id: sel.id, fid: sel.floorId });
          else if (sel.kind === "room") UI.actions.roomDup({ id: sel.id });
          else if (sel.kind === "opening") UI.actions.openDup({ id: sel.id });
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          if (sel.kind === "furniture") UI.actions.itemDel({ id: sel.id, fid: sel.floorId });
          else if (sel.kind === "room") UI.actions.roomDel({ id: sel.id });
          else if (sel.kind === "opening") UI.actions.openDel({ id: sel.id });
          return;
        }
        if (k === "r" && sel.kind === "furniture") { UI.actions.itemRot({ id: sel.id, fid: sel.floorId, delta: e.shiftKey ? -90 : 90 }); return; }
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 2 : 0.5;
          const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
          S.update((d) => {
            if (sel.kind === "furniture") { const it = Cmd.itemsOf(d, sel.floorId).find((x) => x.id === sel.id); if (it) Cmd.moveItem(d, sel.floorId, it.id, it.x + dx, it.y + dy); }
            else if (sel.kind === "room") { const r = Cmd.roomOf(Cmd.floorOf(d, sel.floorId), sel.id); if (r) Cmd.moveRoom(d, sel.floorId, r.id, r.x + dx, r.y + dy); }
            else if (sel.kind === "opening") { const f = Cmd.floorOf(d, sel.floorId), o = f.openings.find((x) => x.id === sel.id), w = HD.geo.wallOfOpening(HD.geo.floorWalls(d, f), o); if (w) Cmd.moveOpening(d, f.id, o.id, w, o.center + (w.axis === "h" ? dx : dy)); }
          });
        }
      });
    }
  };

  /* ---------- actions ---------- */
  const Aa = UI.actions;
  Aa.undo = () => S.undo();
  Aa.redo = () => S.redo();
  Aa.rename = (a, v) => S.update((d) => (d.name = (v || "").trim() || "Untitled design"));
  Aa.floor = ({ id }) => { S.setUI({ activeFloorId: id }); const sel = S.state.selection; if (sel && sel.floorId && sel.floorId !== id && sel.floorId !== "site") S.select(null); };
  Aa.viewMode = ({ value }) => S.setUI({ view: value });
  Aa.camView = ({ value }) => { if (S.state.ui.view === "2d") S.setUI({ view: "split" }); Editor.viewer.setView(value); Editor.schedulePanels(); };
  Aa.dispSeg = ({ k, value }) => S.setDisplay({ [k]: value });
  Aa.sun = (a, v) => { S.state.ui.display.sunHour = v; Editor.viewer.updateSun(S.state.design, v); const em = document.querySelector(".sun em"); if (em) em.textContent = `${String(Math.floor(v)).padStart(2, "0")}:${v % 1 ? "30" : "00"}`; };
  Aa.planZoom = ({ k }) => Editor.plan.zoom(k);
  Aa.planFit = () => { Editor.plan.fit(); Editor.plan.render(S.state, true); };
  Aa.v3dZoom = ({ k }) => Editor.viewer.zoom(k);
  Aa.goHome = () => { HD.persist.saveNow(); location.hash = "#/"; };

  HD.editor = Editor;
})(window.HD);
