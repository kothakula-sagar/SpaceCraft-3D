/* 3D builders: turn the design document into three.js groups.
   Every pickable mesh gets userData.pick = {kind, id, floorId, facet} so clicks map to model objects.
   Plan (x, y) → world (X = x, Z = y); height → Y. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, Mo = HD.model, MT = HD.mat3d;
  const DEG = Math.PI / 180;
  const PLASTER = () => MT.color("#dcd7ce", 0.95);

  function mesh(geo, mat, pick) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    if (pick) m.userData.pick = pick;
    return m;
  }
  function box(g, w, h, d, mat, x, y, z, pick) {
    const geo = MT.worldUV(new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)), w, h, d);
    const m = mesh(geo, mat, pick);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  function cyl(g, rt, rb, h, mat, x, y, z, seg = 18, pick) {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, pick);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  function sphere(g, r, mat, x, y, z, sy = 1, pick) {
    const m = mesh(new THREE.SphereGeometry(r, 14, 10), mat, pick);
    m.position.set(x, y, z);
    m.scale.y = sy;
    g.add(m);
    return m;
  }
  function tagAll(obj, pick) { obj.traverse((o) => { if (o.isMesh) o.userData.pick = pick; }); return obj; }

  /* ================= Labels ================= */
  function label(lines, opts = {}) {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    const fs = 30;
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
    const w = Math.max(...lines.map((l, i) => { ctx.font = `${i ? 500 : 600} ${i ? fs * 0.8 : fs}px Inter, system-ui`; return ctx.measureText(l).width; })) + 28;
    const h = fs * 1.25 + (lines.length - 1) * fs * 1.05 + 14;
    cv.width = Math.ceil(w); cv.height = Math.ceil(h);
    ctx.fillStyle = opts.bg || "rgba(255,255,255,0.88)";
    const r = 12;
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.arcTo(cv.width, 0, cv.width, cv.height, r); ctx.arcTo(cv.width, cv.height, 0, cv.height, r); ctx.arcTo(0, cv.height, 0, 0, r); ctx.arcTo(0, 0, cv.width, 0, r); ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    lines.forEach((l, i) => {
      ctx.font = `${i ? 500 : 600} ${i ? fs * 0.8 : fs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = i ? "#51606c" : opts.color || "#1d2a33";
      ctx.fillText(l, cv.width / 2, 8 + (i ? fs * 1.2 + (i - 1) * fs * 1.05 : 0));
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: !!opts.onTop === false, transparent: true }));
    const scale = (opts.size || 1) * 0.03;
    sp.scale.set(cv.width * scale, cv.height * scale, 1);
    sp.renderOrder = 10;
    return sp;
  }

  /* ================= Furniture ================= */
  function buildItem(it, pick) {
    const def = C.FUR[it.type];
    const g = new THREE.Group();
    if (!def) return g;
    const { w, d, h } = G.itemSize(it);
    const col = it.color || def.color;
    const main = MT.color(col, 0.7), dark = MT.color(U.shade(col, -0.18), 0.6), light = MT.color("#f4f2ee", 0.6);
    const metal = MT.color("#8d949a", 0.35, 0.6), black = MT.color("#1f2427", 0.4);
    const Z = (f) => -d / 2 + f; // from back
    switch (def.shape) {
      case "bed": {
        box(g, w, 1, d, main, 0, 0.5, 0);
        box(g, w - 0.2, 0.7, d - 0.5, light, 0, 1.35, 0.2);
        box(g, w, h, 0.3, dark, 0, h / 2, Z(0.15));
        const pw = w > 4 ? w / 2 - 0.4 : w - 0.6;
        (w > 4 ? [-w / 4, w / 4] : [0]).forEach((x) => box(g, pw, 0.35, 1.2, MT.color("#ffffff", 0.9), x, 1.85, Z(1.1)));
        box(g, w - 0.05, 0.12, d * 0.55, MT.color("#6f8fae", 0.9), 0, 1.76, d * 0.2);
        break;
      }
      case "wardrobe": {
        box(g, w, h, d, main, 0, h / 2, 0);
        const n = Math.max(2, Math.round(w / 1.6));
        for (let i = 1; i < n; i++) box(g, 0.04, h - 0.4, 0.04, dark, -w / 2 + (i * w) / n, h / 2, d / 2 + 0.01);
        for (let i = 0; i < n; i++) box(g, 0.06, 0.8, 0.08, metal, -w / 2 + ((i + 0.5) * w) / n + (i % 2 ? -0.25 : 0.25), h * 0.5, d / 2 + 0.05);
        break;
      }
      case "cabinet":
        box(g, w, h, d, main, 0, h / 2, 0);
        box(g, w * 0.7, 0.04, 0.04, dark, 0, h * 0.62, d / 2 + 0.01);
        break;
      case "dresser":
        box(g, w, 2.6, d, main, 0, 1.3, 0);
        box(g, w * 0.7, h - 3, 0.08, MT.color("#cfe3ea", 0.05, 0.3), 0, 2.6 + (h - 2.6) / 2, Z(0.1));
        break;
      case "sofa":
      case "armchair": {
        const arm = Math.min(0.6, w * 0.15);
        box(g, w, 1.2, d, main, 0, 0.75, 0);
        box(g, w, h - 0.3, 0.7, main, 0, (h - 0.3) / 2 + 0.3, Z(0.35));
        box(g, arm, 2, d, dark, -w / 2 + arm / 2, 1, 0);
        box(g, arm, 2, d, dark, w / 2 - arm / 2, 1, 0);
        const n = def.shape === "sofa" ? 3 : 1, cw = (w - 2 * arm) / n;
        for (let i = 0; i < n; i++) box(g, cw - 0.08, 0.35, d - 0.9, MT.color(U.shade(col, 0.08), 0.9), -w / 2 + arm + cw * (i + 0.5), 1.5, 0.3);
        for (let i = 0; i < 4; i++) box(g, 0.2, 0.3, 0.2, black, (i % 2 ? 1 : -1) * (w / 2 - 0.3), 0.15, (i < 2 ? 1 : -1) * (d / 2 - 0.3));
        break;
      }
      case "sofaL": {
        const sd = 3;
        box(g, w, 1.2, sd, main, 0, 0.75, Z(sd / 2));
        box(g, sd, 1.2, d, main, w / 2 - sd / 2, 0.75, 0);
        box(g, w, h - 0.3, 0.7, main, 0, (h - 0.3) / 2 + 0.3, Z(0.35));
        box(g, 0.7, h - 0.3, d, main, w / 2 - 0.35, (h - 0.3) / 2 + 0.3, 0);
        box(g, 0.6, 2, sd, dark, -w / 2 + 0.3, 1, Z(sd / 2));
        break;
      }
      case "table":
        box(g, w, 0.12, d, main, 0, h - 0.06, 0);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(g, 0.18, h - 0.12, 0.18, dark, sx * (w / 2 - 0.25), (h - 0.12) / 2, sz * (d / 2 - 0.25)));
        break;
      case "dining": {
        box(g, w, 0.15, d, main, 0, h - 0.07, 0);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(g, 0.2, h - 0.15, 0.2, dark, sx * (w / 2 - 0.35), (h - 0.15) / 2, sz * (d / 2 - 0.35)));
        const seats = def.seats || 4, perSide = seats === 6 ? 2 : 2;
        const chairAt = (x, z, ry) => { const c = chairMesh(dark, MT.color("#c9b79c", 0.9)); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); };
        for (let i = 0; i < perSide; i++) {
          const x = -w / 2 + (w / perSide) * (i + 0.5);
          chairAt(x, -d / 2 - 0.55, 0);
          chairAt(x, d / 2 + 0.55, Math.PI);
        }
        if (seats === 6) { chairAt(-w / 2 - 0.55, 0, -Math.PI / 2); chairAt(w / 2 + 0.55, 0, Math.PI / 2); }
        break;
      }
      case "chair": { const c = chairMesh(main, MT.color(U.shade(col, 0.25), 0.9)); g.add(c); break; }
      case "counter": {
        box(g, w, 2.75, d, main, 0, 1.375, 0);
        box(g, w + 0.05, 0.13, d + 0.05, MT.color("#2d2f31", 0.25), 0, 2.82, 0);
        const n = Math.max(1, Math.round(w / 2));
        for (let i = 1; i < n; i++) box(g, 0.03, 2.4, 0.03, dark, -w / 2 + (i * w) / n, 1.4, d / 2 + 0.01);
        if (def.hob) { box(g, 2, 0.05, 1.3, black, w / 2 - 1.6, 2.91, 0); [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]].forEach(([x, z]) => cyl(g, 0.22, 0.22, 0.05, metal, w / 2 - 1.6 + x, 2.95, z)); }
        if (def.sink && w >= 5) { box(g, 1.8, 0.06, 1.2, metal, -w / 2 + 1.5, 2.9, 0.1); cyl(g, 0.04, 0.04, 0.9, metal, -w / 2 + 1.5, 3.3, Z(0.3)); }
        box(g, w, 2.2, 1.1, main, 0, 6.3, Z(0.55));
        break;
      }
      case "fridge":
        box(g, w, h, d, main, 0, h / 2, 0);
        box(g, w - 0.05, 0.03, 0.03, dark, 0, h * 0.62, d / 2 + 0.01);
        box(g, 0.08, 1.2, 0.1, metal, -w / 2 + 0.3, h * 0.78, d / 2 + 0.05);
        box(g, 0.08, 1.2, 0.1, metal, -w / 2 + 0.3, h * 0.4, d / 2 + 0.05);
        break;
      case "wc":
        box(g, 1.3, 0.9, 1.5, main, 0, 0.45, 0.25);
        box(g, 1.4, 0.2, 1.7, main, 0, 1.3, 0.3);
        box(g, 1.4, 1.4, 0.6, main, 0, 2.0, Z(0.3));
        break;
      case "basin":
        box(g, w, 2.6, d, MT.color("#8d7a67", 0.7), 0, 1.3, 0);
        box(g, w * 0.8, 0.25, d * 0.7, main, 0, 2.72, 0.05);
        box(g, w * 0.9, 2, 0.06, MT.color("#d8e9ef", 0.05, 0.4), 0, 4.6, Z(0.03));
        break;
      case "shower":
        box(g, w, 0.15, d, MT.color("#dfe6e8", 0.4), 0, 0.08, 0);
        box(g, 0.05, h, d, MT.glass(0.25), w / 2, h / 2, 0);
        box(g, w, h, 0.05, MT.glass(0.25), 0, h / 2, d / 2);
        cyl(g, 0.3, 0.3, 0.06, metal, 0, h - 0.4, Z(0.6));
        break;
      case "washer":
        box(g, w, h, d, main, 0, h / 2, 0);
        { const c = cyl(g, 0.6, 0.6, 0.06, MT.color("#44525c", 0.2, 0.2), 0, h * 0.45, d / 2 + 0.03); c.rotation.x = Math.PI / 2; }
        break;
      case "desk":
        box(g, w, 0.12, d, main, 0, h - 0.06, 0);
        box(g, 0.12, h - 0.12, d, dark, -w / 2 + 0.06, (h - 0.12) / 2, 0);
        box(g, 0.12, h - 0.12, d, dark, w / 2 - 0.06, (h - 0.12) / 2, 0);
        box(g, 1.8, 1.1, 0.08, black, 0, h + 0.8, Z(0.4));
        break;
      case "shelf": {
        box(g, w, h, 0.1, main, 0, h / 2, Z(0.05));
        box(g, 0.1, h, d, main, -w / 2 + 0.05, h / 2, 0);
        box(g, 0.1, h, d, main, w / 2 - 0.05, h / 2, 0);
        const cols = ["#b5543b", "#2f5d8a", "#d8a940", "#5b7f4a", "#7a4b7a", "#c9c2b5"];
        for (let y = 0.1, k = 0; y < h - 0.3; y += 1.2, k++) {
          box(g, w - 0.2, 0.08, d, main, 0, y, 0);
          for (let i = 0; i < Math.floor((w - 0.6) / 0.4); i++) box(g, 0.3, 0.8, d * 0.7, MT.color(cols[(i + k) % 6], 0.8), -w / 2 + 0.45 + i * 0.4, y + 0.45, 0);
        }
        break;
      }
      case "pooja": {
        box(g, w, 2.5, d, main, 0, 1.25, 0);
        box(g, w * 0.8, 2.4, d * 0.8, MT.color("#e8c98a", 0.5, 0.2), 0, 3.7, 0);
        const top = mesh(new THREE.ConeGeometry(w * 0.55, 1.4, 4), MT.color("#c99a3f", 0.35, 0.6));
        top.position.set(0, 5.6, 0); top.rotation.y = Math.PI / 4; g.add(top);
        sphere(g, 0.12, MT.emissive("#ffb347", 1.2), 0, 2.75, d / 2 - 0.2);
        break;
      }
      case "plant":
        cyl(g, 0.45, 0.35, 1.1, MT.color("#d9d2c6", 0.8), 0, 0.55, 0);
        sphere(g, 0.7, MT.color(col, 0.9), 0, 1.9, 0, 1.2);
        sphere(g, 0.5, MT.color(U.shade(col, 0.08), 0.9), 0.3, 2.6, 0.1);
        break;
      case "tree":
        cyl(g, 0.35, 0.5, h * 0.45, MT.color("#6b4f37", 0.9), 0, h * 0.225, 0, 10);
        sphere(g, w * 0.45, MT.color(col, 0.95), 0, h * 0.6, 0, 1.1);
        sphere(g, w * 0.32, MT.color(U.shade(col, 0.07), 0.95), w * 0.25, h * 0.75, w * 0.1);
        sphere(g, w * 0.3, MT.color(U.shade(col, -0.05), 0.95), -w * 0.22, h * 0.72, -w * 0.12);
        break;
      case "palm": {
        cyl(g, 0.25, 0.35, h * 0.85, MT.color("#8a7457", 0.9), 0, h * 0.42, 0, 8);
        for (let i = 0; i < 7; i++) {
          const leaf = mesh(new THREE.BoxGeometry(0.5, 0.05, w * 0.55), MT.color(col, 0.9));
          const a = (i / 7) * Math.PI * 2;
          leaf.position.set(Math.sin(a) * w * 0.25, h * 0.85, Math.cos(a) * w * 0.25);
          leaf.rotation.y = a; leaf.rotation.x = 0.35;
          g.add(leaf);
        }
        break;
      }
      case "shrub":
        sphere(g, w * 0.45, MT.color(col, 0.95), 0, h * 0.45, 0, 0.9);
        sphere(g, w * 0.3, MT.color(U.shade(col, 0.07), 0.95), w * 0.2, h * 0.6, 0.1);
        break;
      case "swing":
        [-1, 1].forEach((s) => { box(g, 0.15, h, 0.15, dark, s * (w / 2), h / 2, -0.6); box(g, 0.15, h, 0.15, dark, s * (w / 2), h / 2, 0.6); });
        box(g, w + 0.3, 0.15, 0.15, dark, 0, h, 0);
        box(g, w - 0.8, 0.15, 1.8, main, 0, 1.6, 0);
        box(g, w - 0.8, 1.2, 0.12, main, 0, 2.2, -0.85);
        [-1, 1].forEach((s) => box(g, 0.04, h - 1.6, 0.04, metal, s * (w / 2 - 0.5), (h + 1.6) / 2, 0));
        break;
      case "car": {
        box(g, w, 1.7, d, main, 0, 1.45, 0);
        box(g, w * 0.86, 1.4, d * 0.48, MT.color("#2b3440", 0.15, 0.3), 0, 2.95, -d * 0.03);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const c = cyl(g, 0.95, 0.95, 0.6, black, sx * (w / 2 - 0.25), 0.95, sz * (d / 2 - 2.3)); c.rotation.z = Math.PI / 2; });
        box(g, 1, 0.3, 0.05, MT.emissive("#fff5d6", 0.5), -w / 2 + 0.8, 1.9, d / 2 + 0.01);
        box(g, 1, 0.3, 0.05, MT.emissive("#fff5d6", 0.5), w / 2 - 0.8, 1.9, d / 2 + 0.01);
        break;
      }
      case "bike":
        box(g, 0.6, 1, d * 0.6, main, 0, 1.8, 0);
        [-1, 1].forEach((s) => { const c = cyl(g, 0.9, 0.9, 0.2, black, 0, 0.9, s * d * 0.35); c.rotation.z = Math.PI / 2; });
        break;
      case "rug": box(g, w, 0.04, d, MT.color(col, 1), 0, 0.03, 0); break;
      case "tvUnit":
        box(g, w, 1.6, d, main, 0, 0.8, 0);
        box(g, w * 0.7, h * 0.42, 0.12, black, 0, 4, Z(0.2));
        break;
      default: box(g, w, h, d, main, 0, h / 2, 0);
    }
    if (pick) tagAll(g, pick);
    return g;
  }
  function chairMesh(frameMat, seatMat) {
    const c = new THREE.Group();
    box(c, 1.4, 0.15, 1.4, seatMat, 0, 1.5, 0);
    box(c, 1.4, 1.6, 0.15, frameMat, 0, 2.3, -0.62);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(c, 0.12, 1.45, 0.12, frameMat, sx * 0.6, 0.72, sz * 0.6));
    return c;
  }

  function placeItem(parent, it, elev, pick) {
    const g = buildItem(it, pick);
    g.position.set(it.x, elev, it.y);
    g.rotation.y = -(it.rot || 0) * DEG;
    parent.add(g);
    return g;
  }

  /* ================= Walls & openings ================= */
  function wallFaceMats(design, f, w) {
    const byId = (id) => f.rooms.find((r) => r.id === id);
    const ex = design.exterior;
    const extMat = MT.get(ex.accentOn && w.axis === "h" && w.outside === 1 ? ex.accent : ex.wall);
    const face = (rid) => {
      const r = rid && byId(rid);
      return r && C.ROOM_TYPES[r.type].enclosed ? MT.get(Mo.roomWallMat(design, r)) : extMat;
    };
    return { pos: face(w.pos), neg: face(w.neg) };
  }

  function wallBox(g, w, s0, s1, y0, y1, t, mats, elev, pick) {
    const L = s1 - s0, h = y1 - y0;
    if (L <= 0.01 || h <= 0.01) return;
    const pl = PLASTER();
    const mid = (s0 + s1) / 2;
    if (w.axis === "h") {
      const geo = MT.worldUV(new THREE.BoxGeometry(L, h, t), L, h, t);
      const m = mesh(geo, [pl, pl, pl, pl, mats.pos, mats.neg], pick);
      m.position.set(mid, elev + y0 + h / 2, w.line);
      g.add(m);
    } else {
      const geo = MT.worldUV(new THREE.BoxGeometry(t, h, L), t, h, L);
      const m = mesh(geo, [mats.pos, mats.neg, pl, pl, pl, pl], pick);
      m.position.set(w.line, elev + y0 + h / 2, mid);
      g.add(m);
    }
  }

  function buildWall(g, design, f, w, elev, H, ops) {
    const t = w.thickness;
    const pick = { kind: "wall", id: w.id, floorId: f.id };
    const mats = wallFaceMats(design, f, w);
    const ext = design.settings.extWall / 2;
    const s0 = w.a - (w.contA ? 0 : ext), s1 = w.b + (w.contB ? 0 : ext);
    const cuts = ops
      .map((o) => ({ o, a: Math.max(w.a, o.center - o.width / 2), b: Math.min(w.b, o.center + o.width / 2) }))
      .filter((c) => c.b - c.a > 0.05)
      .sort((p, q) => p.a - q.a);
    let s = s0;
    cuts.forEach(({ o, a, b }) => {
      if (a > s) wallBox(g, w, s, a, 0, H, t, mats, elev, pick);
      const top = Math.min(H, o.sill + o.height);
      if (o.sill > 0.01) wallBox(g, w, a, b, 0, Math.min(H, o.sill), t, mats, elev, pick);
      if (top < H) wallBox(g, w, a, b, top, H, t, mats, elev, pick);
      s = Math.max(s, b);
    });
    if (s1 > s) wallBox(g, w, s, s1, 0, H, t, mats, elev, pick);
  }

  /** Local frame for an opening: returns a group positioned at the opening centre, x along wall, z across (+z = pos side). */
  function openingFrame(w, o, elev) {
    const grp = new THREE.Group();
    if (w.axis === "h") grp.position.set(o.center, elev, w.line);
    else { grp.position.set(w.line, elev, o.center); grp.rotation.y = Math.PI / 2; } // local +z → world +x (pos side); local +x → world -z
    return grp;
  }

  function buildDoor(g, design, f, w, o, elev, H) {
    const pick = { kind: "opening", id: o.id, floorId: f.id };
    const grp = openingFrame(w, o, elev);
    const t = w.thickness, W = Math.min(o.width, w.len), Hd = Math.min(o.height, H - 0.2);
    const dm = MT.get(o.material || (o.main ? design.materials.mainDoor : design.materials.door));
    const frameMat = o.style === "arch" ? PLASTER() : MT.color(U.shade(C.MAT[o.material || design.materials.door]?.color || "#7a4a26", -0.15), 0.6);
    const fw = 0.22;
    box(grp, fw, Hd, t + 0.08, frameMat, -W / 2 + fw / 2, Hd / 2, 0);
    box(grp, fw, Hd, t + 0.08, frameMat, W / 2 - fw / 2, Hd / 2, 0);
    box(grp, W, fw, t + 0.08, frameMat, 0, Hd - fw / 2, 0);
    const clear = W - 2 * fw, lh = Hd - fw - 0.05;
    const handle = MT.color("#c9a55a", 0.3, 0.8);
    const leaf = (lw, hingeX, dir, glassy) => {
      // dir: +1 leaf extends to +x from hinge, -1 to -x
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, 0, (o.swing > 0 ? 1 : -1) * (t / 2));
      const angle = 30 * DEG;
      pivot.rotation.y = -(o.swing > 0 ? 1 : -1) * dir * angle;
      if (glassy) {
        box(pivot, lw, lh, 0.12, MT.get(design.materials.window), dir * lw / 2, lh / 2, 0);
        box(pivot, lw - 0.35, lh - 0.4, 0.13, MT.glass(0.35), dir * lw / 2, lh / 2, 0);
      } else {
        box(pivot, lw, lh, 0.15, dm, dir * lw / 2, lh / 2, 0);
        if (o.main) {
          [0.28, 0.62].forEach((fy) => box(pivot, lw * 0.62, lh * 0.26, 0.17, MT.color(U.shade(C.MAT[o.material || design.materials.mainDoor]?.color || "#7a4a26", -0.1), 0.5), dir * lw / 2, lh * fy, 0));
        }
        box(pivot, 0.08, 0.5, 0.25, handle, dir * (lw - 0.3), 3.4, 0);
      }
      grp.add(pivot);
    };
    // 'start' hinge = lower plan coordinate; on vertical walls local +x points to lower y
    const hingeLeft = (o.hinge !== "end") !== (w.axis === "v");
    switch (o.style) {
      case "arch": break;
      case "double": case "french":
        leaf(clear / 2, -W / 2 + fw, 1, o.style === "french");
        leaf(clear / 2, W / 2 - fw, -1, o.style === "french");
        break;
      case "sliding": {
        const pw = clear / 2 + 0.15;
        [[-clear / 4 + clear * 0.12, -0.08], [clear / 4, 0.08]].forEach(([x, z]) => {
          box(grp, pw, lh, 0.1, MT.get(design.materials.window), x, lh / 2, z);
          box(grp, pw - 0.3, lh - 0.35, 0.11, MT.glass(0.35), x, lh / 2, z);
        });
        break;
      }
      default:
        leaf(clear, hingeLeft ? -W / 2 + fw : W / 2 - fw, hingeLeft ? 1 : -1, false);
    }
    // main-door canopy and step on the outside
    if (o.main && w.outside) {
      const out = w.outside;
      box(grp, W + 2, 0.25, 2.5, MT.color("#d9d4cb", 0.9), 0, Hd + 0.7, out * (t / 2 + 1.25));
    }
    tagAll(grp, pick);
    g.add(grp);
  }

  function buildWindow(g, design, f, w, o, elev, H) {
    const pick = { kind: "opening", id: o.id, floorId: f.id };
    const grp = openingFrame(w, o, elev);
    const t = w.thickness, W = Math.min(o.width, w.len), Hh = Math.min(o.height, H - o.sill - 0.1);
    const fm = MT.get(o.material || design.materials.window), gl = MT.glass(0.32);
    const y0 = o.sill, fd = 0.3, fw = 0.18;
    box(grp, W, fw, fd, fm, 0, y0 + fw / 2, 0);
    box(grp, W, fw, fd, fm, 0, y0 + Hh - fw / 2, 0);
    box(grp, fw, Hh, fd, fm, -W / 2 + fw / 2, y0 + Hh / 2, 0);
    box(grp, fw, Hh, fd, fm, W / 2 - fw / 2, y0 + Hh / 2, 0);
    const iw = W - 2 * fw, ih = Hh - 2 * fw, cy = y0 + Hh / 2;
    switch (o.style) {
      case "sliding":
        box(grp, iw / 2 + 0.1, ih, 0.05, gl, -iw / 4, cy, -0.05);
        box(grp, iw / 2 + 0.1, ih, 0.05, gl, iw / 4, cy, 0.05);
        box(grp, 0.12, ih, 0.2, fm, 0, cy, 0);
        break;
      case "casement":
        box(grp, iw, ih, 0.05, gl, 0, cy, 0);
        box(grp, 0.12, ih, 0.22, fm, 0, cy, 0);
        break;
      case "ventilator":
        box(grp, iw, ih, 0.05, gl, 0, cy, 0);
        for (let i = 1; i < 3; i++) box(grp, iw, 0.06, 0.22, fm, 0, y0 + fw + (ih * i) / 3, 0);
        break;
      case "french":
        box(grp, iw, ih, 0.05, gl, 0, cy, 0);
        box(grp, 0.12, ih, 0.22, fm, 0, cy, 0);
        box(grp, iw, 0.12, 0.22, fm, 0, y0 + Hh * 0.78, 0);
        break;
      default: box(grp, iw, ih, 0.05, gl, 0, cy, 0);
    }
    if (design.exterior.sunshades && w.outside) {
      box(grp, W + 1, 0.2, 1.6, MT.color("#e4dfd6", 0.9), 0, y0 + Hh + 0.55, w.outside * (t / 2 + 0.8));
    }
    tagAll(grp, pick);
    g.add(grp);
  }

  function buildRailing(g, design, f, w, elev) {
    const pick = { kind: "wall", id: w.id, floorId: f.id };
    const grp = new THREE.Group();
    const h = 3.4, L = w.len;
    const rm = MT.get(design.exterior.railing);
    const isGlass = design.exterior.railing === "railGlass";
    const post = MT.color(isGlass ? "#b9bec3" : C.MAT[design.exterior.railing]?.color || "#999", 0.35, 0.6);
    const n = Math.max(1, Math.round(L / 4));
    const along = (s, y, geoW, geoH, geoD, mat) => {
      if (w.axis === "h") box(grp, geoW, geoH, geoD, mat, s, elev + y, w.line);
      else box(grp, geoD, geoH, geoW, mat, w.line, elev + y, s);
    };
    for (let i = 0; i <= n; i++) along(w.a + (L * i) / n, h / 2, 0.15, h, 0.15, post);
    along((w.a + w.b) / 2, h, L, 0.12, 0.2, post);
    if (isGlass) along((w.a + w.b) / 2, h / 2 + 0.1, L - 0.2, h - 0.5, 0.06, rm);
    else {
      along((w.a + w.b) / 2, 0.4, L, 0.08, 0.1, post);
      const bars = Math.floor(L / 0.45);
      for (let i = 1; i < bars; i++) along(w.a + (L * i) / bars, h / 2 + 0.15, 0.05, h - 0.4, 0.05, rm);
    }
    tagAll(grp, pick);
    g.add(grp);
  }

  function buildParapet(g, design, w, elev, height, pick, thick = 0.5) {
    const mat = MT.get(design.exterior.wall);
    const ext = thick / 2;
    const s0 = w.a - (w.contA ? 0 : ext), s1 = w.b + (w.contB ? 0 : ext), L = s1 - s0, mid = (s0 + s1) / 2;
    const m = w.axis === "h" ? box(g, L, height, thick, mat, mid, elev + height / 2, w.line, pick) : box(g, thick, height, L, mat, w.line, elev + height / 2, mid, pick);
    // coping
    if (w.axis === "h") box(g, L + 0.1, 0.12, thick + 0.2, MT.color("#d9d4cb", 0.8), mid, elev + height + 0.06, w.line, pick);
    else box(g, thick + 0.2, 0.12, L + 0.1, MT.color("#d9d4cb", 0.8), w.line, elev + height + 0.06, mid, pick);
    return m;
  }

  /* ================= Stairs ================= */
  function buildStairs(g, design, f, r, elev, H) {
    const pick = { kind: "room", id: r.id, floorId: f.id, facet: "stairs" };
    const mat = MT.get(Mo.roomFloorMat(design, r)), side = MT.color("#cfc9bf", 0.9);
    const alongY = r.d >= r.w;
    const L = alongY ? r.d : r.w, S = alongY ? r.w : r.d;
    // start at the end nearest a door (default: the +y / +x end)
    const doors = f.openings.filter((o) => o.kind === "door");
    const nearEnd = (() => {
      const endLine0 = alongY ? r.y : r.x, endLine1 = alongY ? r.y + r.d : r.x + r.w;
      const ax = alongY ? "h" : "v";
      if (doors.some((o) => o.axis === ax && U.near(o.line, endLine0, 0.06))) return 0;
      return 1;
    })();
    const N = Math.max(4, Math.ceil(H / 0.6)), riser = H / N;
    // map local (u along run from start, v across from left) → plan
    const toPlan = (u, v) => {
      const uu = nearEnd === 1 ? L - u : u;
      return alongY ? { x: r.x + v, y: r.y + uu } : { x: r.x + uu, y: r.y + v };
    };
    const step = (u0, u1, v0, v1, top) => {
      const p0 = toPlan(u0, v0), p1 = toPlan(u1, v1);
      const x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y), w = Math.abs(p1.x - p0.x), d = Math.abs(p1.y - p0.y);
      const geo = MT.worldUV(new THREE.BoxGeometry(w, top, d), w, top, d);
      const m = mesh(geo, [side, side, mat, side, side, side], pick);
      m.position.set(x + w / 2, elev + top / 2, y + d / 2);
      g.add(m);
    };
    if (S < 5) {
      const tread = L / N;
      for (let i = 0; i < N; i++) step(i * tread, (i + 1) * tread, 0.1, S - 0.1, riser * (i + 1));
      return;
    }
    const n1 = Math.ceil(N / 2), n2 = N - n1;
    const landing = Math.min(3.5, L * 0.3);
    const tread = (L - landing) / n1;
    for (let i = 0; i < n1; i++) step(i * tread, (i + 1) * tread, 0.15, S / 2 - 0.05, riser * (i + 1));
    step(L - landing, L - 0.1, 0.15, S - 0.15, riser * n1);
    const tread2 = (L - landing) / n2;
    for (let j = 0; j < n2; j++) step(L - landing - (j + 1) * tread2, L - landing - j * tread2, S / 2 + 0.05, S - 0.15, riser * (n1 + j + 1));
    // centre wall between flights
    const a = toPlan(0, S / 2 - 0.05), b = toPlan(L - landing, S / 2 + 0.05);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), d = Math.abs(b.y - a.y);
    box(g, w, H * 0.5 + 3, d, side, x + w / 2, elev + (H * 0.5 + 3) / 2, y + d / 2, pick);
  }

  /* ================= Floor ================= */
  function buildFloor(design, f, ctx) {
    const g = new THREE.Group();
    g.name = "floor:" + f.id;
    const elev = Mo.floorElevation(design, f.level);
    const H = f.height - 0.5;
    const wallH = ctx.cutaway ? Math.min(3.5, H) : H;
    const below = f.level > 0 ? design.floors[f.level - 1] : null;
    const plinth = design.settings.plinth;

    f.rooms.forEach((r) => {
      const t = C.ROOM_TYPES[r.type];
      const pickRoom = { kind: "room", id: r.id, floorId: f.id, facet: "floor" };
      const voidBelowStair = r.type === "staircase" && below?.rooms.some((b) => b.type === "staircase" && U.rectOverlap(b, r));
      if (f.level === 0) {
        if (r.type === "parking") {
          box(g, r.w, 0.15, r.d, MT.get(design.materials.paving), r.x + r.w / 2, 0.075, r.y + r.d / 2, pickRoom);
          return;
        }
        box(g, r.w, plinth - 0.04, r.d, MT.color("#8e877d", 0.95), r.x + r.w / 2, (plinth - 0.04) / 2, r.y + r.d / 2, pickRoom);
      } else if (!voidBelowStair) {
        const slab = box(g, r.w, 0.5, r.d, MT.color("#e7e2d9", 0.9), r.x + r.w / 2, elev - 0.25, r.y + r.d / 2, pickRoom);
        slab.userData.slab = true;
      }
      if (!voidBelowStair) box(g, r.w - 0.02, 0.04, r.d - 0.02, MT.get(Mo.roomFloorMat(design, r)), r.x + r.w / 2, elev - 0.02, r.y + r.d / 2, pickRoom);
      if (r.type === "staircase") buildStairs(g, design, f, r, elev, f.height);
      if (ctx.ceilings && t.enclosed) {
        const c = box(g, r.w, 0.05, r.d, MT.get(Mo.roomCeilMat(design, r)), r.x + r.w / 2, elev + H - 0.03, r.y + r.d / 2, { kind: "ceiling", id: r.id, floorId: f.id, facet: "ceiling" });
        c.castShadow = false;
      }
      if (ctx.labels) {
        const sp = label([r.name, `${U.fmtDims(r.w, r.d)} · ${Math.round(r.w * r.d)} sq ft`], { size: Math.min(1, Math.max(0.55, Math.min(r.w, r.d) / 12)) });
        sp.position.set(r.x + r.w / 2, elev + (ctx.cutaway ? 4.2 : 1.2), r.y + r.d / 2);
        sp.userData.label = true;
        g.add(sp);
      }
    });

    const walls = G.floorWalls(design, f);
    const solidEnds = new Set();
    walls.forEach((w) => {
      if (w.kind === "interior" || w.kind === "exterior") G.wallEnds(w).forEach((p) => solidEnds.add(`${U.r2(p.x)},${U.r2(p.y)}`));
    });
    walls.forEach((w) => {
      const ops = f.openings.filter((o) => G.onWall(o, w));
      if (w.kind === "interior" || w.kind === "exterior") buildWall(g, design, f, w, elev, wallH, ops);
      else if (w.kind === "railing") buildRailing(g, design, f, w, elev);
      else if (w.kind === "parapet") buildParapet(g, design, w, elev, 3.4, { kind: "wall", id: w.id, floorId: f.id }, 0.45);
      else if (w.kind === "none") {
        // columns at free corners of porches (support the slab above)
        const room = f.rooms.find((r) => r.id === (w.pos || w.neg));
        if (room && room.type === "sitout") {
          G.wallEnds(w).forEach((p) => {
            const k = `${U.r2(p.x)},${U.r2(p.y)}`;
            if (solidEnds.has(k)) return;
            solidEnds.add(k);
            const cx = U.clamp(p.x, room.x + 0.45, room.x + room.w - 0.45), cy = U.clamp(p.y, room.y + 0.45, room.y + room.d - 0.45);
            box(g, 0.9, wallH, 0.9, MT.get(design.exterior.wall), cx, elev + wallH / 2, cy, { kind: "room", id: room.id, floorId: f.id, facet: "column" });
          });
        }
      }
      if (w.kind === "interior" || w.kind === "exterior") ops.forEach((o) => {
        if (o.kind === "door") buildDoor(g, design, f, w, o, elev, ctx.cutaway ? f.height - 0.5 : wallH);
        else if (!ctx.cutaway) buildWindow(g, design, f, w, o, elev, wallH);
      });
    });

    if (ctx.furniture) {
      f.furniture.forEach((it) => placeItem(g, it, elev, { kind: "furniture", id: it.id, floorId: f.id }));
    }
    return g;
  }

  /* ================= Roof ================= */
  function buildRoof(design) {
    const g = new THREE.Group();
    g.name = "roof";
    const ex = design.exterior;
    const pick = { kind: "roof" };
    const roofable = (r) => C.ROOM_TYPES[r.type].enclosed || r.type === "sitout" || r.type === "balcony";
    const slabMat = MT.get("roofRCC"), band = MT.color("#e7e2d9", 0.9);
    // Slabs over anything not covered by the floor above
    design.floors.forEach((f, i) => {
      const above = design.floors[i + 1];
      const top = Mo.floorElevation(design, i) + f.height;
      f.rooms.filter(roofable).forEach((r) => {
        if (above && above.rooms.some((a) => U.rectOverlap(a, r) && a.w * a.d >= r.w * r.d * 0.5 && U.rectContainsPt(a, r.x + r.w / 2, r.y + r.d / 2))) return;
        const geo = MT.worldUV(new THREE.BoxGeometry(r.w + 0.3, 0.5, r.d + 0.3), r.w + 0.3, 0.5, r.d + 0.3);
        const m = mesh(geo, [band, band, slabMat, band, band, band], pick);
        m.position.set(r.x + r.w / 2, top - 0.25, r.y + r.d / 2);
        g.add(m);
      });
    });
    const topF = design.floors[design.floors.length - 1];
    const Etop = Mo.floorElevation(design, topF.level) + topF.height;
    const roofed = topF.rooms.filter(roofable);
    if (!roofed.length) return g;
    const bb = U.bbox(roofed);
    if (ex.roofType === "flat") {
      const rw = G.deriveWalls(roofed.map((r) => ({ ...r, type: "custom" })), design.settings);
      rw.filter((w) => w.kind === "exterior").forEach((w) => buildParapet(g, design, w, Etop, ex.parapet, pick));
      // staircase headroom (mumty) + water tank
      topF.rooms.filter((r) => r.type === "staircase").forEach((r) => {
        const hh = 8, mat = MT.get(ex.wall);
        box(g, r.w + 0.5, hh, r.d + 0.5, mat, r.x + r.w / 2, Etop + hh / 2, r.y + r.d / 2, pick);
        box(g, r.w + 1.4, 0.4, r.d + 1.4, band, r.x + r.w / 2, Etop + hh + 0.2, r.y + r.d / 2, pick);
        cyl(g, 1.6, 1.6, 3.4, MT.color("#2a2d30", 0.6), r.x + r.w / 2, Etop + hh + 2.1, r.y + r.d / 2, 20, pick);
      });
    } else {
      const o = 1.5;
      const x0 = bb.x - o, x1 = bb.x + bb.w + o, z0 = bb.y - o, z1 = bb.y + bb.d + o;
      const alongX = bb.w >= bb.d;
      const span = alongX ? z1 - z0 : x1 - x0;
      const rise = (span / 2) * Math.tan(24 * DEG);
      const y0 = Etop + 0.05, yr = y0 + rise;
      const mat = MT.get(ex.roofMaterial);
      let verts;
      if (ex.roofType === "hip") {
        const inset = span / 2;
        if (alongX) verts = [
          [x0, y0, z0], [x1, y0, z0], [x1 - inset, yr, (z0 + z1) / 2], [x0 + inset, yr, (z0 + z1) / 2],
          [x1, y0, z1], [x0, y0, z1]
        ];
        else verts = [
          [x0, y0, z0], [x0, y0, z1], [(x0 + x1) / 2, yr, z1 - inset], [(x0 + x1) / 2, yr, z0 + inset],
          [x1, y0, z1], [x1, y0, z0]
        ];
        const [A, B, R2, R1, Cc, D] = verts;
        const tris = alongX
          ? [A, R1, B, B, R1, R2, Cc, R2, D, D, R2, R1, A, D, R1, B, R2, Cc]
          : [A, B, R1, B, R2, R1, Cc, D, R2, D, R1, R2, A, R1, D, B, Cc, R2];
        const pos = new Float32Array(tris.flat()), uv = new Float32Array((tris.length) * 2);
        tris.forEach((p, i) => { uv[i * 2] = p[0] + p[2]; uv[i * 2 + 1] = p[1] * 2 + (alongX ? p[2] : p[0]); });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        geo.computeVertexNormals();
        const m = mesh(geo, mat, pick);
        m.material = mat.clone(); m.material.side = THREE.DoubleSide;
        g.add(m);
      } else {
        // gable: two sloped slabs + triangular gable walls
        const slope = Math.hypot(span / 2, rise), ang = Math.atan2(rise, span / 2);
        const len = alongX ? x1 - x0 : z1 - z0;
        [-1, 1].forEach((s) => {
          const w = alongX ? new THREE.BoxGeometry(len, 0.3, slope) : new THREE.BoxGeometry(slope, 0.3, len);
          MT.worldUV(w, alongX ? len : slope, 0.3, alongX ? slope : len);
          const m = mesh(w, mat, pick);
          if (alongX) { m.position.set((x0 + x1) / 2, y0 + rise / 2, (z0 + z1) / 2 + (s * span) / 4); m.rotation.x = s * ang; }
          else { m.position.set((x0 + x1) / 2 + (s * span) / 4, y0 + rise / 2, (z0 + z1) / 2); m.rotation.z = -s * ang; }
          g.add(m);
        });
        const shape = new THREE.Shape();
        const half = span / 2 - o;
        shape.moveTo(-half, 0); shape.lineTo(half, 0); shape.lineTo(0, rise * (half / (span / 2))); shape.closePath();
        const tri = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
        [alongX ? bb.x : bb.y, alongX ? bb.x + bb.w : bb.y + bb.d].forEach((p, i) => {
          const m = mesh(tri, MT.get(ex.wall), pick);
          if (alongX) { m.rotation.y = Math.PI / 2; m.position.set(p + (i ? -0.5 : 0), y0 - 0.05, bb.y + bb.d / 2); }
          else m.position.set(bb.x + bb.w / 2, y0 - 0.05, p + (i ? -0.5 : 0));
          g.add(m);
        });
      }
    }
    return g;
  }

  /* ================= Site ================= */
  function buildSite(design, ctx) {
    const g = new THREE.Group();
    g.name = "site";
    const P = design.plot, ex = design.exterior, cw = ex.compound;
    const W = P.width, D = P.depth;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), MT.color("#b9c2a6", 1));
    ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.12, D / 2); ground.receiveShadow = true;
    g.add(ground);
    box(g, W, 0.1, D, MT.get(ex.lawn ? "lawn" : "soil"), W / 2, -0.05, D / 2, { kind: "plot" });
    // road & footpath
    const road = P.roadWidth || 30;
    box(g, W + 400, 0.06, 5, MT.get("concrete"), W / 2, -0.07, D + 2.5, { kind: "plot" });
    const asphalt = box(g, W + 400, 0.04, road, MT.color("#4a4d52", 0.95), W / 2, -0.09, D + 5 + road / 2);
    asphalt.castShadow = false;
    for (let x = -200; x < W + 200; x += 12) box(g, 5, 0.02, 0.35, MT.color("#e8e6df", 0.8), x, -0.06, D + 5 + road / 2);
    // driveway / walkway from gate
    const gnd = design.floors[0];
    const parking = gnd.rooms.find((r) => r.type === "parking");
    const bb = U.bbox(gnd.rooms.filter((r) => r.type !== "parking"));
    const gc = cw.gate.center ?? W / 2, gw = cw.gate.width;
    const startY = parking ? parking.y + parking.d : bb ? bb.y + bb.d : D;
    const pw = parking ? Math.min(gw, parking.w) : 4;
    if (D - startY > 0.2) box(g, pw, 0.12, D - startY, MT.get(design.materials.paving), U.clamp(gc, pw / 2, W - pw / 2), 0.02, (startY + D) / 2, { kind: "plot" });
    // compound wall + gate
    if (cw.on) {
      const pick = { kind: "compound" };
      const cm = MT.get(cw.material), cap = MT.color("#d9d4cb", 0.8), t = 0.6, h = cw.height;
      const seg = (x0, z0, x1, z1) => {
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 0.1) return;
        const alongX = Math.abs(z1 - z0) < 0.01;
        box(g, alongX ? L : t, h, alongX ? t : L, cm, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, pick);
        box(g, alongX ? L + 0.1 : t + 0.2, 0.15, alongX ? t + 0.2 : L + 0.1, cap, (x0 + x1) / 2, h + 0.07, (z0 + z1) / 2, pick);
      };
      seg(0, 0, W, 0); seg(0, 0, 0, D); seg(W, 0, W, D);
      const hasGate = cw.gate.style !== "none";
      const ga = U.clamp(gc - gw / 2, 0.8, W - gw - 0.8), gb = ga + gw;
      if (hasGate) {
        seg(0, D, ga, D); seg(gb, D, W, D);
        [ga - 0.7, gb + 0.7].forEach((x) => { box(g, 1.4, h + 1.2, 1.4, cm, x, (h + 1.2) / 2, D, pick); box(g, 1.7, 0.25, 1.7, cap, x, h + 1.3, D, pick); });
        const gateG = new THREE.Group();
        const gm = MT.get(cw.gate.material), gh = h - 0.2;
        // panel of length L built along +x from its hinge/origin, then placed and rotated
        const panel = (L, px, ang) => {
          const p = new THREE.Group();
          box(p, L, 0.2, 0.15, gm, L / 2, gh - 0.1, 0);
          box(p, L, 0.2, 0.15, gm, L / 2, 0.4, 0);
          for (let x = 0.15; x < L; x += 0.45) box(p, 0.08, gh - 0.3, 0.08, gm, x, gh / 2 + 0.1, 0);
          p.position.set(px, 0, D);
          p.rotation.y = ang;
          gateG.add(p);
        };
        if (cw.gate.style === "sliding") panel(gw, ga, 0);
        else { panel(gw / 2 - 0.05, ga, 0.35); panel(gw / 2 - 0.05, gb, Math.PI - 0.35); }
        tagAll(gateG, { kind: "gate" });
        g.add(gateG);
      } else seg(0, D, W, D);
    }
    if (ctx.furniture) design.site.items.forEach((it) => placeItem(g, it, 0, { kind: "furniture", id: it.id, floorId: "site" }));
    return g;
  }

  HD.build = { buildFloor, buildRoof, buildSite, buildItem, label, box };
})(window.HD);
