/* Vastu analysis. Rules are plain data (editable in the UI, stored per browser; in production served
   by the backend per organisation). Zones come from HD.orient, so they follow the plot facing. */
(function (HD) {
  const U = HD.util, O = HD.orient, C = HD.catalog;
  const STORE_KEY = "bc.vastuRules";

  const DEFAULT_RULES = {
    version: 1,
    points: { ideal: 10, good: 7, neutral: 4, avoid: 0 },
    rooms: {
      kitchen:   { ideal: ["SE"], good: ["NW"], avoid: ["NE", "SW", "N", "C"], tip: "Cook facing east; fire element belongs to the South-East." },
      master:    { ideal: ["SW"], good: ["S", "W"], avoid: ["NE", "SE", "C"], tip: "The master bedroom in the South-West gives stability to the head of the family." },
      bedroom:   { ideal: ["S", "W", "NW"], good: ["SW", "N", "E"], avoid: ["NE", "SE", "C"], tip: "Children's and guest bedrooms suit the West or North-West." },
      pooja:     { ideal: ["NE"], good: ["N", "E"], avoid: ["S", "SW", "SE", "C"], tip: "The North-East (Ishanya) is the most sacred zone." },
      bathroom:  { ideal: ["NW", "W"], good: ["S", "SE", "E"], avoid: ["NE", "SW", "C"], tip: "Toilets are best in the North-West or West; never in the North-East." },
      living:    { ideal: ["N", "NE", "E"], good: ["NW", "W"], avoid: ["SW"], tip: "Living areas in the North or East receive morning light and positive energy." },
      dining:    { ideal: ["W"], good: ["E", "N", "S", "NW", "C"], avoid: ["SW"], tip: "Dining in the West, close to the kitchen." },
      staircase: { ideal: ["S", "W", "SW"], good: ["SE", "NW"], avoid: ["NE", "C", "N", "E"], tip: "Staircases carry weight — keep them South/West, never in the North-East or centre." },
      store:     { ideal: ["SW", "NW"], good: ["S", "W"], avoid: ["NE", "C"], tip: "Heavy storage suits the South-West." },
      utility:   { ideal: ["NW", "SE"], good: ["W", "S"], avoid: ["NE", "C"], tip: "Washing and utility areas suit the North-West." },
      study:     { ideal: ["W", "NE", "E"], good: ["N", "SW"], avoid: ["SE", "C"], tip: "Study facing East or North aids concentration." },
      lounge:    { ideal: ["N", "NE", "E", "NW"], good: ["W", "C"], avoid: ["SW"], tip: "Keep family spaces open and light." },
      balcony:   { ideal: ["N", "E", "NE"], good: ["NW", "W"], avoid: ["SW"], tip: "Open spaces and balconies are best towards the North and East." },
      sitout:    { ideal: ["N", "E", "NE"], good: ["NW", "SE", "W"], avoid: ["SW"], tip: "Keep the North-East open and light." },
      terrace:   { ideal: ["N", "E", "NE"], good: ["NW", "W", "SE"], avoid: ["SW"], tip: "Open terraces suit the North and East." },
      parking:   { ideal: ["NW", "SE"], good: ["N", "E"], avoid: ["NE", "SW"], tip: "Vehicles suit the North-West or South-East." }
    },
    entrance: { ideal: ["N", "NE", "E"], good: ["NW", "W"], avoid: ["SW", "S", "SE"], tip: "North, North-East and East entrances are considered most auspicious." },
    centre: { avoid: ["bathroom", "kitchen", "staircase", "store"], tip: "Keep the centre (Brahmasthan) open and free of heavy or wet areas." }
  };

  function getRules() {
    try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s); } catch (_) {}
    return U.clone(DEFAULT_RULES);
  }
  function setRules(r) { try { localStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (_) {} }
  function resetRules() { try { localStorage.removeItem(STORE_KEY); } catch (_) {} }

  function footprint(design) {
    const g = design.floors[0];
    const rects = (g?.rooms || []).filter((r) => r.type !== "parking");
    return U.bbox(rects.length ? rects : design.floors.flatMap((f) => f.rooms));
  }

  function statusFor(rule, zone) {
    if (!rule) return "neutral";
    if (rule.ideal.includes(zone)) return "ideal";
    if (rule.avoid.includes(zone)) return "avoid";
    if (rule.good.includes(zone)) return "good";
    return "neutral";
  }
  const zoneList = (z) => z.map((x) => O.DIR_NAMES[x] || x).join(", ");

  function analyze(design, rules = getRules()) {
    const facing = design.plot.facing;
    const box = footprint(design);
    const items = [];
    if (!box) return { score: 0, items, entrance: null, facing, box };
    design.floors.forEach((f) => {
      f.rooms.forEach((r) => {
        if (["passage", "custom"].includes(r.type)) return;
        const rule = rules.rooms[r.type];
        const zone = O.zoneOf(facing, box, r.x + r.w / 2, r.y + r.d / 2);
        let status = statusFor(rule, zone);
        let message = "";
        if (zone === "C" && rules.centre.avoid.includes(r.type)) { status = "avoid"; message = rules.centre.tip; }
        const label = C.ROOM_TYPES[r.type]?.label || r.type;
        if (!message) {
          if (status === "ideal") message = `${label} in the ${O.DIR_NAMES[zone]} is ideal.`;
          else if (rule) message = `${label} is in the ${O.DIR_NAMES[zone]}. Recommended: ${zoneList(rule.ideal)}${rule.good.length ? " (or " + zoneList(rule.good) + ")" : ""}.`;
        }
        items.push({ floorId: f.id, floorName: f.name, roomId: r.id, name: r.name, type: r.type, zone, status, ideal: rule?.ideal || [], good: rule?.good || [], message, tip: rule?.tip || "" });
      });
    });
    let entrance = null;
    const main = design.floors[0]?.openings.find((o) => o.main);
    if (main) {
      const px = main.axis === "h" ? main.center : main.line, py = main.axis === "h" ? main.line : main.center;
      const zone = O.zoneOf(facing, box, U.clamp(px, box.x + 0.01, box.x + box.w - 0.01), U.clamp(py, box.y + 0.01, box.y + box.d - 0.01));
      const status = statusFor(rules.entrance, zone);
      entrance = { zone, status, message: status === "ideal" ? `Main entrance in the ${O.DIR_NAMES[zone]} is ideal.` : `Main entrance is in the ${O.DIR_NAMES[zone]}. Preferred: ${zoneList(rules.entrance.ideal)}.`, tip: rules.entrance.tip };
    }
    const scored = items.concat(entrance ? [entrance] : []);
    const pts = rules.points;
    const score = scored.length ? Math.round((U.sum(scored, (i) => pts[i.status] ?? pts.neutral) / (scored.length * pts.ideal)) * 100) : 0;
    return { score, items, entrance, facing, box };
  }

  /** Suggestions beyond per-room messages: e.g. mirrored layout scores better. */
  function suggestions(design, rules = getRules()) {
    const base = analyze(design, rules);
    const out = [];
    const mirrored = U.clone(design);
    HD.cmd.mirrorLayout(mirrored);
    const m = analyze(mirrored, rules);
    if (m.score > base.score + 2) out.push({ kind: "mirror", gain: m.score - base.score, text: `Mirroring the layout left↔right raises the Vastu score from ${base.score} to ${m.score}.` });
    const bad = base.items.filter((i) => i.status === "avoid");
    bad.forEach((i) => out.push({ kind: "room", text: `${i.name} (${i.floorName}): ${i.message}`, ref: { kind: "room", id: i.roomId, floorId: i.floorId } }));
    if (base.entrance && base.entrance.status === "avoid") out.push({ kind: "entrance", text: base.entrance.message });
    return { base, list: out };
  }

  HD.vastu = { DEFAULT_RULES, getRules, setRules, resetRules, analyze, suggestions, statusFor };
})(window.HD);
