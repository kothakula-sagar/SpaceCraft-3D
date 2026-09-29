/* Bootstrap & routing:
   #/            dashboard
   #/d/<id>      editor for a saved design (continue where you stopped)
   #share=<code> read-only shared snapshot */
(function (HD) {
  const UI = HD.ui;

  async function route() {
    const h = location.hash;
    if (h.startsWith("#share=")) {
      try {
        const d = await HD.persist.decodeShare(h.slice(7));
        HD.editor.open(d, { readOnly: true });
      } catch (e) {
        console.error(e);
        UI.toast("This share link is invalid or incomplete", "err");
        location.hash = "#/";
      }
      return;
    }
    const m = h.match(/^#\/d\/([\w-]+)/);
    if (m) {
      const d = await HD.persist.repo.get(m[1]);
      if (d) { HD.editor.open(d); return; }
      UI.toast("Design not found", "err");
      location.hash = "#/";
      return;
    }
    HD.dashboard.render();
  }

  function start() {
    if (!window.THREE || !THREE.OrbitControls) {
      document.body.innerHTML = `<div class="fatal"><h1>Could not load the 3D engine</h1><p>This app loads three.js from a CDN. Check your internet connection and reload.</p></div>`;
      return;
    }
    HD.persist.startAutosave(() => HD.editor.viewer?.thumbnail());
    window.addEventListener("hashchange", route);
    window.addEventListener("beforeunload", () => HD.persist.saveNow());
    route();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})(window.HD);
