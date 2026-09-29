/* UI toolkit: tiny HTML-string components + delegated actions.
   Elements declare behaviour with data-act (click), data-change (change), data-input (input);
   arguments go in data-args (JSON). Handlers live in HD.ui.actions. */
(function (HD) {
  const U = HD.util, C = HD.catalog;
  const UI = (HD.ui = HD.ui || {});
  UI.actions = {};
  const esc = U.esc;
  const A = (o) => (o ? ` data-args='${esc(JSON.stringify(o))}'` : "");
  UI.A = A;

  UI.num = (label, value, act, args, o = {}) => {
    const ft = o.ft !== false && isFinite(value);
    return `<label class="field ${o.cls || ""}"><span>${esc(label)}</span>
      <div class="inp"><input type="number" value="${isFinite(value) ? U.r2(value) : ""}" step="${o.step ?? 0.25}" ${o.min != null ? `min="${o.min}"` : ""} ${o.max != null ? `max="${o.max}"` : ""}
        data-change="${act}"${A(args)} data-key="${esc(act + JSON.stringify(args || {}))}" ${o.disabled ? "disabled" : ""}>
      <em>${o.suffix != null ? esc(o.suffix) : ft ? U.fmtFt(value) : ""}</em></div></label>`;
  };
  UI.text = (label, value, act, args, o = {}) =>
    `<label class="field ${o.cls || ""}"><span>${esc(label)}</span><div class="inp"><input type="text" value="${esc(value)}" data-change="${act}"${A(args)} data-key="${esc(act + JSON.stringify(args || {}))}" ${o.disabled ? "disabled" : ""} placeholder="${esc(o.placeholder || "")}"></div></label>`;
  UI.select = (label, value, options, act, args, o = {}) =>
    `<label class="field ${o.cls || ""}"><span>${esc(label)}</span><div class="inp"><select data-change="${act}"${A(args)} ${o.disabled ? "disabled" : ""}>${Object.entries(options)
      .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`)
      .join("")}</select></div></label>`;
  UI.toggle = (label, checked, act, args, o = {}) =>
    `<label class="toggle ${o.cls || ""}"><input type="checkbox" ${checked ? "checked" : ""} data-change="${act}"${A(args)} ${o.disabled ? "disabled" : ""}><i></i><span>${esc(label)}</span></label>`;
  UI.seg = (options, value, act, args = {}, o = {}) =>
    `<div class="seg ${o.cls || ""}">${Object.entries(options)
      .map(([v, l]) => `<button class="${String(v) === String(value) ? "on" : ""}" data-act="${act}"${A({ ...args, value: v })} ${o.disabled ? "disabled" : ""} title="${esc(typeof l === "string" ? l.replace(/<[^>]+>/g, "") : v)}">${l}</button>`)
      .join("")}</div>`;
  UI.swatches = (ids, current, act, args = {}, o = {}) =>
    `<div class="swatches ${o.cls || ""}">${ids
      .map((id) => {
        const m = C.MAT[id];
        return `<button class="sw ${HD.mat3d.swatchClass(id)} ${id === current ? "on" : ""}" title="${esc(m?.name || id)}${m && m.price ? ` · ₹${m.price}${m.price < 10 ? "×" : "/sq ft"}` : ""}" data-act="${act}"${A({ ...args, value: id })} ${o.disabled ? "disabled" : ""}><span>${esc(m?.name || id)}</span></button>`;
      })
      .join("")}</div>`;
  UI.section = (title, body, o = {}) =>
    `<section class="sec ${o.cls || ""}" ${o.id ? `id="${o.id}"` : ""}>${title ? `<h3>${title}${o.right ? `<span class="right">${o.right}</span>` : ""}</h3>` : ""}${body}</section>`;
  UI.btn = (label, act, args, o = {}) =>
    `<button class="btn ${o.cls || ""}" data-act="${act}"${A(args)} ${o.disabled ? "disabled" : ""} ${o.title ? `title="${esc(o.title)}"` : ""}>${label}</button>`;
  UI.stat = (label, value, o = {}) => `<div class="stat ${o.cls || ""}"><span>${esc(label)}</span><b>${value}</b></div>`;
  UI.chip = (label, cls = "") => `<span class="chip ${cls}">${label}</span>`;

  /** Render HTML into an element, skipping identical HTML and preserving focus on [data-key] inputs. */
  UI.renderInto = (el, html) => {
    if (!el || el._html === html) return;
    const ae = document.activeElement;
    const key = ae && el.contains(ae) ? ae.dataset.key : null;
    const sel = key && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
    const scroll = el.scrollTop;
    el.innerHTML = html;
    el._html = html;
    el.scrollTop = scroll;
    if (key) {
      const n = [...el.querySelectorAll("[data-key]")].find((x) => x.dataset.key === key);
      if (n) { n.focus(); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch (_) {} }
    }
  };

  const args = (el) => { try { return el.dataset.args ? JSON.parse(el.dataset.args) : {}; } catch (_) { return {}; } };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = UI.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(args(el), el, e); }
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-change]");
    if (!el) return;
    const fn = UI.actions[el.dataset.change];
    if (fn) fn(args(el), el.type === "checkbox" ? el.checked : el.type === "number" ? parseFloat(el.value) : el.value, el, e);
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-input]");
    if (!el) return;
    const fn = UI.actions[el.dataset.input];
    if (fn) fn(args(el), el.type === "range" || el.type === "number" ? parseFloat(el.value) : el.value, el, e);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input[data-change]")) e.target.blur();
  });

  /* ---------- toast & modal ---------- */
  UI.toast = (msg, kind = "") => {
    let host = document.getElementById("toasts");
    if (!host) { host = document.createElement("div"); host.id = "toasts"; document.body.appendChild(host); }
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  };
  UI.modal = (html, o = {}) => {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal ${o.cls || ""}" role="dialog" aria-modal="true">${o.title ? `<header><h2>${o.title}</h2><button class="icon close" data-close aria-label="Close">✕</button></header>` : ""}<div class="modal-body">${html}</div></div>`;
    document.body.appendChild(back);
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); o.onClose && o.onClose(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); });
    return { el: back.querySelector(".modal"), close };
  };
  UI.confirm = (msg, o = {}) =>
    new Promise((res) => {
      const m = UI.modal(`<p class="confirm-msg">${msg}</p><div class="modal-actions"><button class="btn" data-no>Cancel</button><button class="btn ${o.danger ? "danger" : "primary"}" data-yes>${o.ok || "Continue"}</button></div>`, { title: o.title || "Please confirm", cls: "small", onClose: () => res(false) });
      m.el.querySelector("[data-yes]").onclick = () => { res(true); m.close(); };
      m.el.querySelector("[data-no]").onclick = () => m.close();
      m.el.querySelector("[data-yes]").focus();
    });

  /* ---------- descriptions shared by 2D/3D ---------- */
  UI.describe = (design, p) => {
    if (!p || !design) return "";
    const f = design.floors.find((x) => x.id === p.floorId);
    switch (p.kind) {
      case "room": { const r = f?.rooms.find((x) => x.id === p.id); return r ? `${r.name} · ${U.fmtDims(r.w, r.d)}${p.facet === "floor" ? " · flooring" : ""}` : ""; }
      case "ceiling": { const r = f?.rooms.find((x) => x.id === p.id); return r ? `Ceiling · ${r.name}` : ""; }
      case "wall": { const w = f && HD.geo.floorWalls(design, f).find((x) => x.id === p.id); return w ? `${w.kind[0].toUpperCase() + w.kind.slice(1)} wall · ${U.fmtFt(w.len)}` : ""; }
      case "opening": { const o = f?.openings.find((x) => x.id === p.id); if (!o) return ""; const s = o.kind === "door" ? C.DOOR_STYLES[o.style] : C.WINDOW_STYLES[o.style]; return `${o.main ? "Main entrance · " : ""}${s?.label || o.style} ${o.kind} · ${U.fmtFt(o.width)} wide`; }
      case "furniture": { const it = HD.cmd.itemsOf(design, p.floorId).find((x) => x.id === p.id); return it ? C.FUR[it.type]?.label || it.type : ""; }
      case "roof": return `Roof · ${C.ROOF_TYPES[design.exterior.roofType]}`;
      case "compound": return "Compound wall";
      case "gate": return "Main gate";
      case "plot": return `Plot ${U.fmtFt(design.plot.width)} × ${U.fmtFt(design.plot.depth)}`;
    }
    return "";
  };
  UI.dimensionText = (design, sel) => {
    if (!sel || !design) return "";
    const f = design.floors.find((x) => x.id === sel.floorId);
    if (sel.kind === "room") { const r = f?.rooms.find((x) => x.id === sel.id); return r ? `${U.fmtDims(r.w, r.d)} · ${Math.round(r.w * r.d)} sq ft` : ""; }
    if (sel.kind === "wall") { const w = f && HD.geo.floorWalls(design, f).find((x) => x.id === sel.id); return w ? `${U.fmtFt(w.len)} long · ${Math.round(w.thickness * 12)}" thick` : ""; }
    if (sel.kind === "opening") { const o = f?.openings.find((x) => x.id === sel.id); return o ? `${U.fmtFt(o.width)} × ${U.fmtFt(o.height)}` : ""; }
    if (sel.kind === "furniture") { const it = HD.cmd.itemsOf(design, sel.floorId).find((x) => x.id === sel.id); if (!it) return ""; const s = HD.geo.itemSize(it); return U.fmtDims(s.w, s.d); }
    return "";
  };
})(window.HD);
