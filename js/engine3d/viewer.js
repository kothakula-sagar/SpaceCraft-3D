/* 3D viewer: renderer, camera presets, incremental rebuilds, picking, highlight, 3D dragging,
   compass and sun position. Talks to the rest of the app only through HD.store. */
(function (HD) {
  const U = HD.util, B = HD.build, Mo = HD.model, G = HD.geo, O = HD.orient, S = HD.store, Cmd = HD.cmd;
  const DEG = Math.PI / 180;

  class Viewer {
    constructor(container) {
      this.el = container;
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
      r.setPixelRatio(Math.min(devicePixelRatio, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      container.appendChild(r.domElement);

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color("#dfe8ef");
      this.scene.fog = new THREE.Fog("#dfe8ef", 400, 1100);
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 3000);
      this.camera.position.set(-40, 60, 110);

      const c = (this.controls = new THREE.OrbitControls(this.camera, r.domElement));
      c.enableDamping = true;
      c.dampingFactor = 0.12;
      c.screenSpacePanning = true;
      c.maxPolarAngle = 88 * DEG;
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

      this.hemi = new THREE.HemisphereLight(0xffffff, 0x8d8a7c, 0.62);
      this.scene.add(this.hemi);
      const sun = (this.sun = new THREE.DirectionalLight(0xfff4e0, 1.25));
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      this.scene.add(sun, sun.target);

      this.world = new THREE.Group();
      this.scene.add(this.world);
      this.sections = { site: null, roof: null, floors: new Map() };
      this.sigs = { site: "", roof: "", floors: new Map() };
      this.highlighted = [];
      this.helpers = new THREE.Group();
      this.scene.add(this.helpers);
      this.view = "orbit";
      this.anim = null;

      // overlays
      this.compass = document.createElement("div");
      this.compass.className = "compass3d";
      this.compass.innerHTML = `<div class="rose"><span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span><i></i></div>`;
      container.appendChild(this.compass);
      this.tip = document.createElement("div");
      this.tip.className = "tip3d";
      container.appendChild(this.tip);

      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();
      this.bindPointer();
      new ResizeObserver(() => this.resize()).observe(container);
      this.resize();
      this.framed = false;
      const loop = () => { requestAnimationFrame(loop); this.tick(); };
      loop();
    }

    resize() {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    /* ---------- building the scene ---------- */
    sync(st) {
      const d = st.design;
      if (!d) return;
      const disp = st.ui.display;
      const active = S.activeFloor();
      const ctx = { cutaway: disp.cutaway && this.view !== "interior", labels: disp.labels, furniture: disp.furniture, ceilings: this.view === "interior" };
      const common = JSON.stringify([d.settings, d.materials, d.exterior, ctx]);

      const siteSig = JSON.stringify([d.plot, d.exterior, d.site, d.materials.paving, d.floors[0].rooms, disp.furniture]);
      if (siteSig !== this.sigs.site) { this.replace("site", B.buildSite(d, ctx)); this.sigs.site = siteSig; }

      const seen = new Set();
      d.floors.forEach((f, i) => {
        seen.add(f.id);
        const below = i > 0 ? d.floors[i - 1].rooms.filter((r) => r.type === "staircase") : [];
        const sig = common + JSON.stringify([f, below, Mo.floorElevation(d, i), ctx.labels && f.id === active.id]);
        if (this.sigs.floors.get(f.id) !== sig) {
          this.replaceFloor(f.id, B.buildFloor(d, f, { ...ctx, labels: ctx.labels && f.id === active.id }));
          this.sigs.floors.set(f.id, sig);
        }
      });
      [...this.sections.floors.keys()].forEach((id) => { if (!seen.has(id)) { this.disposeGroup(this.sections.floors.get(id)); this.sections.floors.delete(id); this.sigs.floors.delete(id); } });

      const roofSig = JSON.stringify([d.floors.map((f) => [f.rooms, f.height]), d.exterior, d.settings.plinth]);
      if (roofSig !== this.sigs.roof) { this.replace("roof", B.buildRoof(d)); this.sigs.roof = roofSig; }

      // visibility by display mode
      const upto = disp.floors === "upto";
      d.floors.forEach((f) => { const g = this.sections.floors.get(f.id); if (g) g.visible = !upto || f.level <= active.level; });
      if (this.sections.roof) this.sections.roof.visible = !upto && this.view !== "interior" && !ctx.cutaway;
      if (this.sections.site) this.sections.site.visible = true;

      this.updateSun(d, disp.sunHour);
      if (!this.framed) { this.framed = true; this.setView("orbit", true); }
      this.applyHighlight(st);
    }

    replace(key, group) {
      if (this.sections[key]) this.disposeGroup(this.sections[key]);
      this.sections[key] = group;
      this.world.add(group);
    }
    replaceFloor(id, group) {
      const old = this.sections.floors.get(id);
      if (old) this.disposeGroup(old);
      this.sections.floors.set(id, group);
      this.world.add(group);
    }
    disposeGroup(g) {
      g.parent && g.parent.remove(g);
      g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
      });
      this.highlighted = [];
    }

    bounds() {
      const d = S.state.design;
      const all = d.floors.flatMap((f) => f.rooms);
      const bb = U.bbox(all) || { x: 0, y: 0, w: d.plot.width, d: d.plot.depth };
      const top = Mo.floorElevation(d, d.floors.length - 1) + d.floors[d.floors.length - 1].height;
      return { cx: bb.x + bb.w / 2, cz: bb.y + bb.d / 2, cy: top / 2, size: Math.max(d.plot.width, d.plot.depth, top * 1.4), bb, top };
    }

    updateSun(d, hour = 15) {
      const b = this.bounds();
      const t = U.clamp((hour - 6) / 12, 0, 1);
      const az = 90 + t * 180;
      const el = (Math.sin(t * Math.PI) * 62 + 6) * DEG;
      const v = O.vecOf(d.plot.facing, az);
      const R = b.size * 2;
      this.sun.position.set(b.cx + v.dx * Math.cos(el) * R, Math.sin(el) * R, b.cz + v.dy * Math.cos(el) * R);
      this.sun.target.position.set(b.cx, 0, b.cz);
      const sc = this.sun.shadow.camera, ext = Math.max(d.plot.width, d.plot.depth) * 0.9 + 20;
      Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: R * 3 });
      sc.updateProjectionMatrix();
      const low = 1 - Math.sin(t * Math.PI);
      this.sun.color.setHSL(0.09, 0.35 + low * 0.5, 0.92 - low * 0.12);
      this.sun.intensity = 0.7 + Math.sin(t * Math.PI) * 0.65;
    }

    /* ---------- camera ---------- */
    setView(v, instant) {
      this.view = v;
      const b = this.bounds();
      const s = b.size;
      const c = this.controls;
      c.minDistance = 1; c.maxDistance = 900;
      c.enableRotate = true;
      let pos, tgt;
      if (v === "top") { tgt = new THREE.Vector3(b.cx, 0, b.cz); pos = new THREE.Vector3(b.cx, s * 1.45 + 10, b.cz + 0.01); }
      else if (v === "front") { tgt = new THREE.Vector3(b.cx, b.cy * 0.8, b.cz); pos = new THREE.Vector3(b.cx, b.cy + s * 0.1, b.cz + s * 1.05 + 12); }
      else if (v === "side") { tgt = new THREE.Vector3(b.cx, b.cy * 0.8, b.cz); pos = new THREE.Vector3(b.cx + s * 1.05 + 12, b.cy + s * 0.1, b.cz); }
      else if (v === "back") { tgt = new THREE.Vector3(b.cx, b.cy * 0.8, b.cz); pos = new THREE.Vector3(b.cx, b.cy + s * 0.1, b.cz - s * 1.05 - 12); }
      else if (v === "interior") {
        const d = S.state.design, f = S.activeFloor();
        const sel = S.state.selection;
        const room = (sel && sel.kind === "room" && f.rooms.find((r) => r.id === sel.id)) || f.rooms.find((r) => r.type === "living" || r.type === "lounge") || f.rooms.find((r) => HD.catalog.ROOM_TYPES[r.type].enclosed) || f.rooms[0];
        const e = Mo.floorElevation(d, f.level);
        if (!room) return;
        tgt = new THREE.Vector3(room.x + room.w / 2, e + 5.2, room.y + room.d / 2);
        pos = tgt.clone().add(new THREE.Vector3(0.01, 0, Math.min(room.d / 2 - 0.8, 3)));
        c.minDistance = 0.05; c.maxDistance = Math.max(2, Math.min(room.w, room.d) / 2 - 0.5);
      } else { tgt = new THREE.Vector3(b.cx, b.cy * 0.5, b.cz + 2); pos = new THREE.Vector3(b.cx - s * 0.5, b.cy + s * 0.55, b.cz + s * 0.85); }
      if (instant) { this.camera.position.copy(pos); c.target.copy(tgt); c.update(); }
      else this.anim = { t0: performance.now(), dur: 520, p0: this.camera.position.clone(), p1: pos, q0: c.target.clone(), q1: tgt };
      S.emit("design"); // rebuild for ceilings/visibility
    }
    zoom(f) {
      const c = this.controls, off = this.camera.position.clone().sub(c.target);
      off.multiplyScalar(f);
      this.camera.position.copy(c.target.clone().add(off));
    }

    tick() {
      if (this.anim) {
        const a = this.anim, k = Math.min(1, (performance.now() - a.t0) / a.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.camera.position.lerpVectors(a.p0, a.p1, e);
        this.controls.target.lerpVectors(a.q0, a.q1, e);
        if (k >= 1) this.anim = null;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.updateCompass();
    }

    updateCompass() {
      const d = S.state.design;
      if (!d) return;
      const t = this.controls.target;
      const n = O.vecOf(d.plot.facing, 0);
      const a = t.clone().project(this.camera), b = new THREE.Vector3(t.x + n.dx * 10, t.y, t.z + n.dy * 10).project(this.camera);
      let ang = Math.atan2(b.x - a.x, b.y - a.y) * (180 / Math.PI);
      if (!isFinite(ang)) ang = 0;
      this.compass.firstElementChild.style.transform = `rotate(${ang}deg)`;
    }

    /* ---------- picking & highlight ---------- */
    pickAt(ev) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.world.children, true);
      for (const h of hits) {
        if (!h.object.userData.pick || h.object.isSprite) continue;
        let o = h.object, vis = true;
        while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
        if (vis) return h;
      }
      return null;
    }
    static samePick(a, b) {
      if (!a || !b) return false;
      if (a.kind !== b.kind) {
        // clicking a room's floor, column or stairs selects the room
        return false;
      }
      return (a.id || null) === (b.id || null) && (a.floorId || null) === (b.floorId || null);
    }

    applyHighlight(st) {
      this.highlighted.forEach(({ o, mat }) => (o.material = mat));
      this.highlighted = [];
      while (this.helpers.children.length) { const h = this.helpers.children[0]; this.helpers.remove(h); h.geometry?.dispose(); h.material?.map?.dispose?.(); }
      const sel = st.selection, hov = st.hover;
      const selBox = new THREE.Box3();
      let any = false;
      this.world.traverse((o) => {
        if (!o.isMesh || !o.userData.pick) return;
        const p = o.userData.pick;
        const isSel = sel && Viewer.matches(p, sel);
        const isHov = !isSel && hov && Viewer.matches(p, hov);
        if (!isSel && !isHov) return;
        this.highlighted.push({ o, mat: o.material });
        const hl = (m) => HD.mat3d.highlighted(m, isSel ? 1 : 0.5);
        o.material = Array.isArray(o.material) ? o.material.map(hl) : hl(o.material);
        if (isSel) { let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (v) { selBox.expandByObject(o); any = true; } }
      });
      if (any) {
        const helper = new THREE.Box3Helper(selBox.expandByScalar(0.08), new THREE.Color("#1b7cff"));
        helper.material.depthTest = false;
        helper.renderOrder = 20;
        this.helpers.add(helper);
        const txt = HD.ui?.dimensionText?.(st.design, sel);
        if (txt) {
          const sp = B.label([txt], { size: 1.2, bg: "rgba(27,124,255,0.92)", color: "#ffffff", onTop: true });
          sp.position.set((selBox.min.x + selBox.max.x) / 2, selBox.max.y + 1.2, (selBox.min.z + selBox.max.z) / 2);
          this.helpers.add(sp);
        }
      }
    }
    static matches(p, sel) {
      if (sel.kind === "room") return (p.kind === "room") && p.id === sel.id && p.floorId === sel.floorId;
      if (["roof", "compound", "gate", "plot"].includes(sel.kind)) return p.kind === sel.kind;
      return p.kind === sel.kind && p.id === sel.id && (p.floorId || null) === (sel.floorId || null);
    }

    /* ---------- pointer: select, drag, place ---------- */
    bindPointer() {
      const el = this.renderer.domElement;
      let down = null;
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const hit = this.pickAt(e);
        down = { x: e.clientX, y: e.clientY, hit, drag: null };
        const st = S.state;
        if (!hit || st.ui.readOnly || st.ui.placeMode) return;
        const p = hit.object.userData.pick, sel = st.selection;
        const canDrag =
          (p.kind === "furniture") ||
          (p.kind === "room" && sel && sel.kind === "room" && sel.id === p.id && p.facet !== "stairs") ||
          (p.kind === "opening" && sel && sel.kind === "opening" && sel.id === p.id);
        if (!canDrag) return;
        const d = st.design;
        const elev = p.floorId === "site" ? 0 : Mo.floorElevation(d, d.floors.find((f) => f.id === p.floorId).level);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const pt = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(plane, pt)) return;
        let origin;
        if (p.kind === "furniture") { const it = Cmd.itemsOf(d, p.floorId).find((x) => x.id === p.id); origin = { x: it.x, y: it.y }; }
        else if (p.kind === "room") { const r = Cmd.roomOf(Cmd.floorOf(d, p.floorId), p.id); origin = { x: r.x, y: r.y }; }
        else { const o = Cmd.floorOf(d, p.floorId).openings.find((x) => x.id === p.id); origin = { c: o.center }; }
        down.drag = { p, plane, start: pt.clone(), origin, active: false };
        if (p.kind === "furniture") S.select({ kind: "furniture", id: p.id, floorId: p.floorId });
      });
      el.addEventListener("pointermove", (e) => {
        if (down && down.drag) {
          const dr = down.drag;
          if (!dr.active && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) { dr.active = true; this.controls.enabled = false; S.begin(); el.setPointerCapture(e.pointerId); }
          if (!dr.active) return;
          const rect = el.getBoundingClientRect();
          this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
          this.raycaster.setFromCamera(this.pointer, this.camera);
          const pt = new THREE.Vector3();
          if (!this.raycaster.ray.intersectPlane(dr.plane, pt)) return;
          const dx = pt.x - dr.start.x, dz = pt.z - dr.start.z;
          const p = dr.p;
          S.update((d) => {
            if (p.kind === "furniture") Cmd.moveItem(d, p.floorId, p.id, U.snap(dr.origin.x + dx, 0.25), U.snap(dr.origin.y + dz, 0.25));
            else if (p.kind === "room") Cmd.moveRoom(d, p.floorId, p.id, U.snap(dr.origin.x + dx), U.snap(dr.origin.y + dz));
            else {
              const f = Cmd.floorOf(d, p.floorId), o = f.openings.find((x) => x.id === p.id);
              const w = G.wallOfOpening(G.floorWalls(d, f), o);
              if (w) Cmd.moveOpening(d, p.floorId, p.id, w, dr.origin.c + (w.axis === "h" ? dx : dz));
            }
          }, { transient: true });
          return;
        }
        if (e.buttons) return;
        this.hoverThrottle = this.hoverThrottle || 0;
        const now = performance.now();
        if (now - this.hoverThrottle < 50) return;
        this.hoverThrottle = now;
        const hit = this.pickAt(e);
        const p = hit?.object.userData.pick || null;
        const hov = p ? (p.kind === "room" ? { kind: "room", id: p.id, floorId: p.floorId } : p) : null;
        S.hover(hov);
        el.style.cursor = p ? (S.state.ui.placeMode ? (p.kind === "wall" ? "copy" : "not-allowed") : "pointer") : "";
        const desc = p && HD.ui?.describe?.(S.state.design, p);
        if (desc) { this.tip.textContent = desc; this.tip.style.left = e.offsetX + 14 + "px"; this.tip.style.top = e.offsetY + 14 + "px"; this.tip.style.display = "block"; }
        else this.tip.style.display = "none";
      });
      const up = (e) => {
        if (!down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (down.drag && down.drag.active) {
          S.end();
          this.controls.enabled = true;
          try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        } else if (moved < 5) this.click(down.hit);
        down = null;
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", () => { this.tip.style.display = "none"; S.hover(null); });
    }

    click(hit) {
      const st = S.state;
      const p = hit?.object.userData.pick;
      const pm = st.ui.placeMode;
      if (pm) {
        if (p && p.kind === "wall") {
          const d = st.design, f = Cmd.floorOf(d, p.floorId), w = G.wallById(G.floorWalls(d, f), p.id);
          if (w && (w.kind === "interior" || w.kind === "exterior")) {
            const along = w.axis === "h" ? hit.point.x : hit.point.z;
            const id = S.update((dd) => Cmd.addOpening(dd, f.id, w, pm.kind, pm.style, along));
            S.setUI({ placeMode: null });
            if (id) S.select({ kind: "opening", id, floorId: f.id });
          }
        }
        return;
      }
      if (!p) { S.select(null); return; }
      if (p.kind === "room") S.select({ kind: "room", id: p.id, floorId: p.floorId, facet: p.facet });
      else S.select({ ...p });
    }

    /* ---------- export ---------- */
    screenshot(scale = 1) {
      this.renderer.render(this.scene, this.camera);
      if (scale === 1) return this.renderer.domElement.toDataURL("image/png");
      const src = this.renderer.domElement, cv = document.createElement("canvas");
      cv.width = Math.round(src.width * scale); cv.height = Math.round(src.height * scale);
      cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
      return cv.toDataURL("image/jpeg", 0.72);
    }
    thumbnail() {
      const src = this.renderer.domElement;
      if (!src.width) return null;
      this.renderer.render(this.scene, this.camera);
      const cv = document.createElement("canvas");
      cv.width = 360; cv.height = 220;
      const ctx = cv.getContext("2d");
      const ar = src.width / src.height, tar = cv.width / cv.height;
      let sw = src.width, sh = src.height, sx = 0, sy = 0;
      if (ar > tar) { sw = sh * tar; sx = (src.width - sw) / 2; } else { sh = sw / tar; sy = (src.height - sh) / 2; }
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      return cv.toDataURL("image/jpeg", 0.7);
    }
    /** Render a specific preset view without disturbing the user's camera. */
    renderView(v) {
      const saved = { p: this.camera.position.clone(), t: this.controls.target.clone(), view: this.view, anim: this.anim };
      this.anim = null;
      this.setView(v, true);
      this.view = saved.view;
      const url = this.screenshot();
      this.camera.position.copy(saved.p);
      this.controls.target.copy(saved.t);
      this.controls.update();
      return url;
    }
  }

  HD.Viewer = Viewer;
})(window.HD);
