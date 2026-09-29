/* Persistence: DesignRepository interface with a localStorage implementation,
   autosave, and share-link encoding. Swap LocalRepository for an ApiRepository in production
   (same async methods). */
(function (HD) {
  const U = HD.util;
  const K = { index: "bc.designs", doc: (id) => "bc.d." + id, thumb: (id) => "bc.t." + id, last: "bc.last" };

  function summarize(d) {
    let builtUp = 0, estimate = 0, vastu = 0;
    try { const s = HD.metrics.designStats(d); builtUp = s.builtUp; } catch (_) {}
    try { estimate = HD.cost.estimate(d).total; } catch (_) {}
    try { vastu = HD.vastu.analyze(d).score; } catch (_) {}
    return {
      id: d.id, name: d.name, updatedAt: d.updatedAt, createdAt: d.createdAt,
      bhk: d.meta.bhk, plot: { w: d.plot.width, d: d.plot.depth }, facing: d.plot.facing,
      floors: d.floors.length, builtUp, estimate, vastu,
      variantGroupId: d.meta.variantGroupId, variantLabel: d.meta.variantLabel
    };
  }

  const LocalRepository = {
    readIndex() { try { return JSON.parse(localStorage.getItem(K.index) || "[]"); } catch (_) { return []; } },
    writeIndex(ix) { localStorage.setItem(K.index, JSON.stringify(ix)); },
    async list() { return this.readIndex().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); },
    async get(id) {
      const s = localStorage.getItem(K.doc(id));
      return s ? HD.model.migrate(JSON.parse(s)) : null;
    },
    async save(design, thumbnail) {
      localStorage.setItem(K.doc(design.id), JSON.stringify(design));
      if (thumbnail) { try { localStorage.setItem(K.thumb(design.id), thumbnail); } catch (_) {} }
      const ix = this.readIndex().filter((x) => x.id !== design.id);
      ix.push(summarize(design));
      this.writeIndex(ix);
      localStorage.setItem(K.last, design.id);
    },
    async remove(id) {
      localStorage.removeItem(K.doc(id));
      localStorage.removeItem(K.thumb(id));
      this.writeIndex(this.readIndex().filter((x) => x.id !== id));
      if (localStorage.getItem(K.last) === id) localStorage.removeItem(K.last);
    },
    async duplicate(id, opts = {}) {
      const d = await this.get(id);
      if (!d) return null;
      const n = U.clone(d);
      n.id = U.uid("dsn");
      n.createdAt = n.updatedAt = new Date().toISOString();
      if (opts.variant) {
        n.meta.variantGroupId = d.meta.variantGroupId || d.id;
        if (!d.meta.variantGroupId) { d.meta.variantGroupId = d.id; await this.save(d, this.thumbnail(d.id)); }
        const siblings = this.readIndex().filter((x) => x.variantGroupId === n.meta.variantGroupId || x.id === n.meta.variantGroupId).length;
        n.meta.variantLabel = "Design " + String.fromCharCode(65 + Math.min(25, siblings));
        n.name = d.name.replace(/\s+–\s+Design [A-Z]$/, "") + " – " + n.meta.variantLabel;
      } else {
        n.name = d.name + " (copy)";
        n.meta.variantGroupId = null;
        n.meta.variantLabel = "Design A";
      }
      await this.save(n, this.thumbnail(id));
      return n;
    },
    thumbnail(id) { return localStorage.getItem(K.thumb(id)); },
    lastOpened() { return localStorage.getItem(K.last); }
  };

  /* ---------- Autosave ---------- */
  let repo = LocalRepository, thumbFn = null, lastThumb = 0;
  const doSave = U.debounce(async () => {
    const st = HD.store.state;
    if (!st.design || st.ui.readOnly) return;
    try {
      st.design.meta.ui = { step: st.ui.step, view: st.ui.view, activeFloorId: st.ui.activeFloorId, display: st.ui.display };
      let thumb = null;
      if (thumbFn && Date.now() - lastThumb > 8000) { thumb = thumbFn(); lastThumb = Date.now(); }
      await repo.save(st.design, thumb);
      HD.store.setSaveStatus("saved");
    } catch (e) {
      console.error(e);
      HD.store.setSaveStatus("error");
    }
  }, 700);
  function startAutosave(getThumbnail) {
    thumbFn = getThumbnail;
    HD.store.onCommit(() => {
      if (HD.store.state.ui.readOnly) return;
      HD.store.setSaveStatus("saving");
      doSave();
    });
  }
  function saveNow() { lastThumb = 0; doSave.flush(); }

  /* ---------- Share links (snapshot embedded in URL hash) ---------- */
  const b64url = (bytes) => { let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64url = (str) => { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  async function encodeShare(design) {
    const json = new TextEncoder().encode(JSON.stringify(design));
    if (typeof CompressionStream === "function") {
      const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
      return "z." + b64url(new Uint8Array(buf));
    }
    return "j." + b64url(json);
  }
  async function decodeShare(code) {
    const [kind, data] = [code.slice(0, 1), code.slice(2)];
    let bytes = unb64url(data);
    if (kind === "z") bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    return HD.model.migrate(JSON.parse(new TextDecoder().decode(bytes)));
  }

  HD.persist = { LocalRepository, get repo() { return repo; }, setRepository(r) { repo = r; }, startAutosave, saveNow, encodeShare, decodeShare, summarize };
})(window.HD);
