/* 3D materials: PBR materials from catalog ids, with procedural canvas textures.
   Geometry UVs are in feet (see worldUV), textures repeat every `scale` feet. */
(function (HD) {
  const C = HD.catalog, U = HD.util;
  const texCache = new Map(), matCache = new Map(), hiCache = new Map();

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  function drawPattern(ctx, S, pattern, color, seed) {
    const r = rng(seed);
    const sh = (a) => U.shade(color, a);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, S, S);
    const noise = (n, amt, size = 2) => { for (let i = 0; i < n; i++) { ctx.fillStyle = sh((r() - 0.5) * amt); ctx.globalAlpha = 0.35; ctx.fillRect(r() * S, r() * S, size, size); } ctx.globalAlpha = 1; };
    switch (pattern) {
      case "tiles": {
        noise(900, 0.06, 3);
        ctx.strokeStyle = sh(-0.18); ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, S, S);
        ctx.strokeStyle = sh(0.08); ctx.lineWidth = 1; ctx.strokeRect(3, 3, S - 6, S - 6);
        break;
      }
      case "wood": {
        const n = 4, h = S / n;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = sh((r() - 0.5) * 0.12); ctx.fillRect(0, i * h, S, h);
          ctx.strokeStyle = sh(-0.12); ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
          for (let k = 0; k < 7; k++) {
            ctx.beginPath(); const y0 = i * h + r() * h;
            ctx.moveTo(0, y0);
            for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y0 + Math.sin(x / 30 + k) * 2 * r());
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = sh(-0.25); ctx.fillRect(0, i * h, S, 2);
          const jx = r() * S; ctx.fillRect(jx, i * h, 2, h);
        }
        break;
      }
      case "marble": {
        noise(600, 0.05, 4);
        ctx.lineCap = "round";
        for (let k = 0; k < 7; k++) {
          ctx.strokeStyle = sh(-0.15 - r() * 0.15); ctx.globalAlpha = 0.25 + r() * 0.3; ctx.lineWidth = 1 + r() * 2.5;
          ctx.beginPath(); ctx.moveTo(r() * S, 0);
          ctx.bezierCurveTo(r() * S, S * 0.3, r() * S, S * 0.6, r() * S, S);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = sh(-0.08); ctx.lineWidth = 2; ctx.strokeRect(0, 0, S, S);
        break;
      }
      case "granite": noise(5000, 0.5, 2); noise(1500, 0.8, 1); break;
      case "grass": {
        for (let i = 0; i < 5000; i++) { ctx.strokeStyle = sh((r() - 0.5) * 0.2); ctx.globalAlpha = 0.6; ctx.beginPath(); const x = r() * S, y = r() * S; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); ctx.stroke(); }
        ctx.globalAlpha = 1; break;
      }
      case "stone": {
        let y = 0;
        while (y < S) {
          const h = 28 + r() * 36; let x = -r() * 40;
          while (x < S) { const w = 40 + r() * 70; ctx.fillStyle = sh((r() - 0.5) * 0.22); ctx.fillRect(x + 2, y + 2, w - 4, h - 4); x += w; }
          y += h;
        }
        ctx.globalCompositeOperation = "source-over"; noise(1500, 0.15, 2); break;
      }
      case "brick": {
        const rows = 8, h = S / rows, w = S / 4;
        ctx.fillStyle = sh(0.25); ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < rows; i++) for (let j = -1; j < 5; j++) {
          const x = j * w + (i % 2 ? w / 2 : 0);
          ctx.fillStyle = sh((r() - 0.5) * 0.18); ctx.fillRect(x + 2, i * h + 2, w - 4, h - 4);
        }
        noise(1200, 0.12, 2); break;
      }
      case "pavers": {
        ctx.fillStyle = sh(-0.2); ctx.fillRect(0, 0, S, S);
        const h = S / 4, w = S / 2;
        for (let i = 0; i < 4; i++) for (let j = -1; j < 3; j++) { const x = j * w + (i % 2 ? w / 2 : 0); ctx.fillStyle = sh((r() - 0.5) * 0.12); ctx.fillRect(x + 3, i * h + 3, w - 6, h - 6); }
        noise(800, 0.1, 2); break;
      }
      case "roofTiles": {
        const rows = 6, h = S / rows, w = S / 6;
        for (let i = 0; i < rows; i++) for (let j = -1; j < 7; j++) {
          const x = j * w + (i % 2 ? w / 2 : 0), y = i * h;
          const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, sh(0.08)); g.addColorStop(1, sh(-0.2));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.7); ctx.quadraticCurveTo(x + w / 2, y + h * 1.1, x, y + h * 0.7); ctx.closePath(); ctx.fill();
        }
        break;
      }
      default: noise(400, 0.03, 3);
    }
  }

  function texture(pattern, color) {
    const key = pattern + color;
    if (texCache.has(key)) return texCache.get(key);
    const S = 256, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    drawPattern(cv.getContext("2d"), S, pattern, color, hashStr(key));
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    texCache.set(key, t);
    return t;
  }

  /** Material for a catalog material id. */
  function get(id) {
    if (matCache.has(id)) return matCache.get(id);
    const m = C.MAT[id];
    let mat;
    if (!m) mat = new THREE.MeshStandardMaterial({ color: "#cccccc" });
    else if (m.cat === "railing" && id === "railGlass") mat = glass(0.35);
    else {
      mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: m.rough, metalness: m.metal || 0 });
      if (m.pattern && m.pattern !== "plain") {
        const t = texture(m.pattern, m.color).clone();
        t.needsUpdate = true;
        t.repeat.set(1 / m.scale, 1 / m.scale);
        mat.map = t;
      } else mat.color.set(m.color);
    }
    matCache.set(id, mat);
    return mat;
  }

  /** Plain colour material (furniture, details). */
  function color(hex, rough = 0.7, metal = 0) {
    const key = `c:${hex}:${rough}:${metal}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
    return matCache.get(key);
  }
  function glass(opacity = 0.3) {
    const key = "glass:" + opacity;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: "#a9d4e6", roughness: 0.05, metalness: 0.1, transparent: true, opacity, depthWrite: false }));
    return matCache.get(key);
  }
  function emissive(hex, intensity = 0.8) {
    const key = `e:${hex}:${intensity}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity }));
    return matCache.get(key);
  }

  function highlighted(mat, strength = 1) {
    const key = mat.uuid + ":" + strength;
    if (hiCache.has(key)) return hiCache.get(key);
    const h = mat.clone();
    h.emissive = new THREE.Color(strength >= 1 ? "#1b7cff" : "#5ea8ff");
    h.emissiveIntensity = strength >= 1 ? 0.42 : 0.2;
    if (h.transparent) h.opacity = Math.min(1, (h.opacity || 0.3) + 0.25);
    hiCache.set(key, h);
    return h;
  }

  /** Rewrite BoxGeometry UVs to feet so textures keep their real-world size. */
  function worldUV(geo, w, h, d) {
    const uv = geo.attributes.uv;
    // face order: +x, -x, +y, -y, +z, -z (4 verts each)
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
    uv.needsUpdate = true;
    return geo;
  }

  /** CSS background for a UI swatch of a catalog material. */
  const swatchCache = new Map();
  function swatch(id) {
    if (swatchCache.has(id)) return swatchCache.get(id);
    const m = C.MAT[id];
    if (!m) return "#ccc";
    let css = m.color;
    if (m.pattern && m.pattern !== "plain") {
      const cv = document.createElement("canvas"); cv.width = cv.height = 64;
      const ctx = cv.getContext("2d");
      const big = document.createElement("canvas"); big.width = big.height = 256;
      drawPattern(big.getContext("2d"), 256, m.pattern, m.color, hashStr(m.pattern + m.color));
      const rep = Math.max(1, Math.min(3, Math.round(4 / (m.scale || 2))));
      for (let i = 0; i < rep; i++) for (let j = 0; j < rep; j++) ctx.drawImage(big, (i * 64) / rep, (j * 64) / rep, 64 / rep, 64 / rep);
      css = `url(${cv.toDataURL()}) center/cover`;
    }
    swatchCache.set(id, css);
    return css;
  }

  /** Class name whose background is the swatch (CSS rule injected once, keeps panel HTML small). */
  let styleEl = null;
  const classDone = new Set();
  function swatchClass(id) {
    const cls = "swm-" + String(id).replace(/[^\w-]/g, "");
    if (!classDone.has(id)) {
      classDone.add(id);
      if (!styleEl) { styleEl = document.createElement("style"); document.head.appendChild(styleEl); }
      styleEl.appendChild(document.createTextNode(`.${cls}{background:${swatch(id)}}\n`));
    }
    return cls;
  }

  HD.mat3d = { get, color, glass, emissive, highlighted, worldUV, texture, swatch, swatchClass };
})(window.HD);
