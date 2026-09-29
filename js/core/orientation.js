/* Orientation: the plan is stored with the road at +y (bottom). plot.facing says which compass
   direction that front faces. Every compass-related feature derives from bearingOf(). */
(function (HD) {
  const C = HD.catalog;
  const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const DIR_NAMES = { N: "North", NE: "North-East", E: "East", SE: "South-East", S: "South", SW: "South-West", W: "West", NW: "North-West", C: "Centre (Brahmasthan)" };

  const frontBearing = (facing) => C.FACINGS[facing]?.bearing ?? 0;
  const norm = (a) => ((a % 360) + 360) % 360;

  /** Compass bearing (0 = N, clockwise) of a plan direction vector (dx, dy), y pointing to the road. */
  function bearingOf(facing, dx, dy) {
    return norm(frontBearing(facing) + (Math.atan2(-dx, dy) * 180) / Math.PI);
  }
  /** Unit plan vector for a compass bearing. */
  function vecOf(facing, bearing) {
    const a = ((bearing - frontBearing(facing)) * Math.PI) / 180;
    return { dx: -Math.sin(a), dy: Math.cos(a) };
  }
  function dirOf(bearing) {
    return DIRS[Math.round(norm(bearing) / 45) % 8];
  }
  /** Vastu 3×3 zone of a point inside a bounding box. */
  function zoneOf(facing, box, x, y) {
    const col = Math.min(2, Math.max(0, Math.floor(((x - box.x) / box.w) * 3)));
    const row = Math.min(2, Math.max(0, Math.floor(((y - box.y) / box.d) * 3)));
    if (col === 1 && row === 1) return "C";
    return dirOf(bearingOf(facing, col - 1, row - 1));
  }
  /** Zone labels for each of the 9 grid cells [row][col] — used to draw the Vastu grid. */
  function zoneGrid(facing) {
    const g = [];
    for (let r = 0; r < 3; r++) {
      g.push([]);
      for (let c = 0; c < 3; c++) g[r].push(r === 1 && c === 1 ? "C" : dirOf(bearingOf(facing, c - 1, r - 1)));
    }
    return g;
  }
  /** Rotation (deg, clockwise) that turns the plan so north points up. */
  function northUpRotation(facing) {
    return norm(frontBearing(facing) - 180);
  }
  /** Which side of the plan (top/right/bottom/left) a compass direction lies on. */
  function sideLabels(facing) {
    return {
      bottom: dirOf(bearingOf(facing, 0, 1)),
      top: dirOf(bearingOf(facing, 0, -1)),
      left: dirOf(bearingOf(facing, -1, 0)),
      right: dirOf(bearingOf(facing, 1, 0))
    };
  }

  HD.orient = { DIRS, DIR_NAMES, frontBearing, bearingOf, vecOf, dirOf, zoneOf, zoneGrid, northUpRotation, sideLabels };
})(window.HD);
