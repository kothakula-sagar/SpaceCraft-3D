/* Store: single source of truth for the open design, selection and UI state.
   - update(fn): clone → mutate via commands → publish. One undo step per update,
     or one per transaction (begin()/end()) for drags.
   - Subscribers are notified once per animation frame with flags of what changed. */
(function (HD) {
  const U = HD.util;
  const DISPLAY_DEFAULTS = { floors: "upto", cutaway: false, labels: true, furniture: true, vastuGrid: false, northUp: false, sunHour: 15, dims: true, site: true };

  const state = {
    design: null,
    selection: null, // {kind, id, floorId, facet?}
    hover: null,
    ui: { step: "rooms", view: "split", activeFloorId: null, placeMode: null, readOnly: false, display: { ...DISPLAY_DEFAULTS } },
    saveStatus: "saved"
  };
  const listeners = new Set();
  const commitHooks = new Set();
  let undoStack = [], redoStack = [], txn = null;
  let scheduled = false, changed = {};

  function emit(kind) {
    changed[kind] = true;
    if (scheduled) return;
    scheduled = true;
    // next animation frame, with a timer fallback for background tabs (rAF is paused there)
    let done = false, timer = 0;
    const run = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      scheduled = false;
      const c = changed;
      changed = {};
      listeners.forEach((fn) => { try { fn(state, c); } catch (e) { console.error(e); } });
    };
    requestAnimationFrame(run);
    timer = setTimeout(run, 80);
  }
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const onCommit = (fn) => { commitHooks.add(fn); return () => commitHooks.delete(fn); };
  const committed = () => commitHooks.forEach((fn) => fn(state));

  function load(design, opts = {}) {
    state.design = design;
    undoStack = []; redoStack = []; txn = null;
    const ui = design.meta?.ui || {};
    state.ui.step = ui.step || "rooms";
    state.ui.view = ui.view || "split";
    state.ui.activeFloorId = design.floors.find((f) => f.id === ui.activeFloorId)?.id || design.floors[0].id;
    state.ui.readOnly = !!opts.readOnly;
    state.ui.placeMode = null;
    state.ui.display = { ...DISPLAY_DEFAULTS, ...(ui.display || {}) };
    state.selection = null;
    state.hover = null;
    emit("design"); emit("ui"); emit("selection");
  }

  function update(mutator, opts = {}) {
    if (!state.design || state.ui.readOnly) return;
    const before = state.design;
    const draft = U.clone(before);
    const res = mutator(draft);
    draft.updatedAt = new Date().toISOString();
    state.design = draft;
    if (!txn && !opts.transient) {
      undoStack.push(before);
      if (undoStack.length > 120) undoStack.shift();
      redoStack = [];
      committed();
    }
    validateSelection();
    emit("design");
    return res;
  }
  function begin() { if (!txn) txn = state.design; }
  function end() {
    if (txn && txn !== state.design) {
      undoStack.push(txn);
      if (undoStack.length > 120) undoStack.shift();
      redoStack = [];
      committed();
    }
    txn = null;
    emit("design");
  }
  function undo() {
    if (!undoStack.length || state.ui.readOnly) return;
    redoStack.push(state.design);
    state.design = undoStack.pop();
    afterHistory();
  }
  function redo() {
    if (!redoStack.length || state.ui.readOnly) return;
    undoStack.push(state.design);
    state.design = redoStack.pop();
    afterHistory();
  }
  function afterHistory() {
    if (!state.design.floors.some((f) => f.id === state.ui.activeFloorId)) state.ui.activeFloorId = state.design.floors[0].id;
    validateSelection();
    committed();
    emit("design"); emit("ui");
  }
  const canUndo = () => undoStack.length > 0;
  const canRedo = () => redoStack.length > 0;

  function exists(sel) {
    const d = state.design;
    if (!sel || !d) return false;
    const f = d.floors.find((x) => x.id === sel.floorId);
    switch (sel.kind) {
      case "room": case "ceiling": return !!f?.rooms.some((r) => r.id === sel.id);
      case "opening": return !!f?.openings.some((o) => o.id === sel.id);
      case "furniture": return sel.floorId === "site" ? d.site.items.some((i) => i.id === sel.id) : !!f?.furniture.some((i) => i.id === sel.id);
      case "wall": return !!f && HD.geo.floorWalls(d, f).some((w) => w.id === sel.id);
      default: return true;
    }
  }
  function validateSelection() {
    if (state.selection && !exists(state.selection)) { state.selection = null; emit("selection"); }
  }

  function select(sel) {
    const same = JSON.stringify(sel) === JSON.stringify(state.selection);
    if (same) return;
    state.selection = sel;
    if (sel && sel.floorId && sel.floorId !== "site" && sel.floorId !== state.ui.activeFloorId && state.design.floors.some((f) => f.id === sel.floorId)) {
      state.ui.activeFloorId = sel.floorId;
      emit("ui");
    }
    emit("selection");
  }
  function hover(h) {
    if (JSON.stringify(h) === JSON.stringify(state.hover)) return;
    state.hover = h;
    emit("hover");
  }
  function setUI(patch) {
    Object.assign(state.ui, patch);
    emit("ui");
    if ("step" in patch || "view" in patch || "activeFloorId" in patch) committed();
  }
  function setDisplay(patch) {
    Object.assign(state.ui.display, patch);
    emit("ui");
  }
  function setSaveStatus(s) { state.saveStatus = s; emit("save"); }

  const activeFloor = () => state.design?.floors.find((f) => f.id === state.ui.activeFloorId) || state.design?.floors[0];

  HD.store = { state, subscribe, onCommit, load, update, begin, end, undo, redo, canUndo, canRedo, select, hover, setUI, setDisplay, setSaveStatus, activeFloor, emit, exists };
})(window.HD);
