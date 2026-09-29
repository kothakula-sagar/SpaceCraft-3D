/* Core utilities: ids, cloning, math, formatting. No DOM or three.js dependencies. */
window.HD = window.HD || {};
(function (HD) {
  const U = {};

  U.uid = (prefix = "id") =>
    prefix + "_" + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8);

  U.clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.snap = (v, step = 0.5) => Math.round(v / step) * step;
  U.r2 = (v) => Math.round(v * 100) / 100;
  U.near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;
  U.sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);

  /** 12.5 -> 12'6" */
  U.fmtFt = (v) => {
    if (!isFinite(v)) return "–";
    const neg = v < 0;
    const inches = Math.round(Math.abs(v) * 12);
    const ft = Math.floor(inches / 12), inch = inches % 12;
    return (neg ? "-" : "") + (inch ? `${ft}'${inch}"` : `${ft}'`);
  };
  U.fmtDims = (w, d) => `${U.fmtFt(w)} × ${U.fmtFt(d)}`;
  U.fmtNum = (v, dp = 0) =>
    Number(v).toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: dp });
  U.fmtArea = (v) => `${U.fmtNum(Math.round(v))} sq ft`;
  U.fmtINR = (v) => "₹" + U.fmtNum(Math.round(v));
  /** Indian short form: ₹42.5 L / ₹1.2 Cr */
  U.fmtLakh = (v) => {
    if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2) + " Cr";
    if (v >= 1e5) return "₹" + (v / 1e5).toFixed(1) + " L";
    return U.fmtINR(v);
  };
  U.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  U.debounce = (fn, ms) => {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    return d;
  };

  U.rectOverlap = (a, b, eps = 0.01) =>
    a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.d - eps && b.y < a.y + a.d - eps;
  U.rectContainsPt = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
  U.bbox = (rects) => {
    if (!rects.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    rects.forEach((r) => { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.d); });
    return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
  };

  /** Colour helpers used by 2D and 3D */
  U.shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (s) => U.clamp(Math.round(((n >> s) & 255) + amt * 255), 0, 255);
    return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
  };

  U.downloadBlob = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  U.slug = (s) => String(s || "design").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";

  HD.util = U;
})(window.HD);
