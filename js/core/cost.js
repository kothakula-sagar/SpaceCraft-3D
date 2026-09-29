/* Cost estimation: quantity take-off from derived geometry × configurable pricing rules.
   Pure function — the same code can run on the server to produce quotations. */
(function (HD) {
  const U = HD.util, C = HD.catalog, G = HD.geo, Mo = HD.model;
  const STORE_KEY = "bc.pricing";

  const DEFAULT_PRICING = {
    version: 1,
    currency: "INR",
    note: "Indicative rates; configure per region / vendor.",
    grades: { basic: 1650, standard: 2050, premium: 2700 },           // ₹ per sq ft built-up: structure, masonry, plaster, basic MEP
    floorFactor: [1, 1.03, 1.06, 1.09, 1.12],                         // upper floors cost a little more
    openAreaFactor: { balcony: 0.6, sitout: 0.5, terrace: 0.15, parking: 0 },
    staircasePerFlight: 55000,
    plinthPerSqft: 140,
    sunshadePerOpening: 3500,
    parapetPerRft: 450,
    slopedRoofFramePerSqft: 140,
    compoundPerRftPerFtHeight: 320,
    compoundMaterialFactor: { compPaint: 1, compBrick: 1.2, compStone: 1.45 },
    lawnPerSqft: 45,
    contingency: 0.05,
    quantities: {                                                     // thumb rules per sq ft built-up
      cementBags: 0.4, steelKg: 4.0, sandCft: 1.8, aggregateCft: 1.35, bricks: 8
    }
  };

  function getPricing() {
    try { const s = localStorage.getItem(STORE_KEY); if (s) return Object.assign(U.clone(DEFAULT_PRICING), JSON.parse(s)); } catch (_) {}
    return U.clone(DEFAULT_PRICING);
  }
  function setPricing(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (_) {} }
  function resetPricing() { try { localStorage.removeItem(STORE_KEY); } catch (_) {} }

  const mat = (id) => C.MAT[id] || { name: id, price: 0 };

  /** Quantity take-off (also used by reports & material estimation). */
  function takeoff(design) {
    const q = { floors: [], floorFinish: {}, wallFinish: {}, ceilFinish: {}, extFinish: {}, doors: [], windows: [], railingRft: {}, parapetRft: 0, roofArea: 0, stairs: 0, sunshades: 0 };
    const addTo = (obj, k, v) => (obj[k] = (obj[k] || 0) + v);
    const top = design.floors.length - 1;
    design.floors.forEach((f, fi) => {
      const walls = G.floorWalls(design, f);
      const byId = Object.fromEntries(f.rooms.map((r) => [r.id, r]));
      const H = f.height - 0.5;
      let enclosed = 0;
      const open = {};
      f.rooms.forEach((r) => {
        const a = r.w * r.d, t = C.ROOM_TYPES[r.type];
        if (t.enclosed) {
          enclosed += a;
          addTo(q.ceilFinish, Mo.roomCeilMat(design, r), a);
        } else addTo(open, r.type, a);
        if (r.type === "staircase") q.stairs++;
        if (!(r.type === "staircase" && fi > 0)) addTo(q.floorFinish, Mo.roomFloorMat(design, r), a);
      });
      q.floors.push({ name: f.name, level: fi, enclosed, open });
      walls.forEach((w) => {
        const ops = f.openings.filter((o) => G.onWall(o, w));
        const opArea = U.sum(ops, (o) => Math.min(o.width, w.len) * o.height);
        const face = Math.max(0, w.len * H - opArea);
        if (w.kind === "interior" || w.kind === "exterior") {
          [w.pos, w.neg].forEach((rid) => { const r = byId[rid]; if (r && C.ROOM_TYPES[r.type].enclosed) addTo(q.wallFinish, Mo.roomWallMat(design, r), face); });
          if (w.kind === "exterior") {
            const accent = design.exterior.accentOn && w.axis === "h" && w.outside === 1;
            addTo(q.extFinish, accent ? design.exterior.accent : design.exterior.wall, face);
            if (design.exterior.sunshades) q.sunshades += ops.filter((o) => o.kind === "window").length;
          }
        } else if (w.kind === "railing") addTo(q.railingRft, design.exterior.railing, w.len);
        else if (w.kind === "parapet") q.parapetRft += w.len;
      });
      f.openings.forEach((o) => {
        const wall = G.wallOfOpening(walls, o);
        if (!wall) return;
        if (o.kind === "door") q.doors.push({ style: o.style, material: o.material || (o.main ? design.materials.mainDoor : design.materials.door), main: o.main });
        else q.windows.push({ style: o.style, area: o.width * o.height, material: o.material || design.materials.window });
      });
      if (fi === top) {
        const roofed = f.rooms.filter((r) => C.ROOM_TYPES[r.type].enclosed || r.type === "sitout" || r.type === "balcony");
        q.roofArea = U.sum(roofed, (r) => r.w * r.d);
        if (design.exterior.roofType === "flat") {
          const rw = G.deriveWalls(roofed.map((r) => ({ ...r, type: "custom" })), design.settings);
          q.parapetRft += U.sum(rw.filter((w) => w.kind === "exterior"), (w) => w.len);
        }
      }
    });
    const P = design.plot;
    const g = design.floors[0];
    const parking = g.rooms.filter((r) => r.type === "parking");
    q.pavingArea = U.sum(parking, (r) => r.w * r.d);
    const gate = design.exterior.compound.gate;
    const bb = U.bbox(g.rooms.filter((r) => r.type !== "parking"));
    const driveDepth = parking.length ? P.depth - Math.max(...parking.map((r) => r.y + r.d)) : bb ? P.depth - (bb.y + bb.d) : 0;
    q.pavingArea += Math.max(0, driveDepth) * (parking.length ? gate.width : 4);
    q.footprint = U.sum(g.rooms.filter((r) => r.type !== "parking"), (r) => r.w * r.d);
    q.lawnArea = design.exterior.lawn ? Math.max(0, P.width * P.depth - q.footprint - q.pavingArea) : 0;
    q.compoundRft = design.exterior.compound.on ? Math.max(0, 2 * (P.width + P.depth) - (gate.style !== "none" ? gate.width : 0)) : 0;
    q.furniture = design.floors.flatMap((f) => f.furniture).concat(design.site.items).map((it) => C.FUR[it.type]).filter(Boolean);
    q.builtUp = U.sum(q.floors, (f) => f.enclosed + (f.open.balcony || 0) + (f.open.sitout || 0));
    return q;
  }

  function estimate(design, pricing = getPricing()) {
    const q = takeoff(design);
    const lines = [];
    const add = (group, item, qty, unit, rate) => { const amount = qty * rate; if (amount > 0.5) lines.push({ group, item, qty, unit, rate, amount }); };
    const grade = design.settings.grade || "standard";
    const baseRate = pricing.grades[grade] ?? pricing.grades.standard;

    // Structure & civil
    q.floors.forEach((f) => {
      const ff = pricing.floorFactor[f.level] ?? pricing.floorFactor[pricing.floorFactor.length - 1];
      add("Structure & civil", `${f.name} – enclosed built-up (${C.GRADES[grade]})`, f.enclosed, "sq ft", baseRate * ff);
      Object.entries(f.open).forEach(([type, a]) => {
        const k = pricing.openAreaFactor[type] ?? 0.4;
        add("Structure & civil", `${f.name} – ${C.ROOM_TYPES[type].label}`, a, "sq ft", baseRate * ff * k);
      });
    });
    add("Structure & civil", "Plinth & foundation extra", q.footprint, "sq ft", pricing.plinthPerSqft);
    add("Structure & civil", "Staircase flights", q.stairs, "nos", pricing.staircasePerFlight);

    // Finishes
    Object.entries(q.floorFinish).forEach(([m, a]) => add("Flooring", mat(m).name, a * 1.05, "sq ft", mat(m).price));
    Object.entries(q.wallFinish).forEach(([m, a]) => add("Wall & ceiling finishes", "Walls – " + mat(m).name, a, "sq ft", mat(m).price));
    Object.entries(q.ceilFinish).forEach(([m, a]) => add("Wall & ceiling finishes", "Ceiling – " + mat(m).name, a, "sq ft", mat(m).price));

    // Doors & windows
    const doorGroups = {};
    q.doors.forEach((d) => {
      const k = d.style + "|" + d.material;
      doorGroups[k] = doorGroups[k] || { ...d, n: 0 };
      doorGroups[k].n++;
    });
    Object.values(doorGroups).forEach((g) => {
      const s = C.DOOR_STYLES[g.style] || C.DOOR_STYLES.single;
      const mult = g.style === "arch" ? 1 : mat(g.material).price || 1;
      add("Doors & windows", `${s.label}${g.style === "arch" ? "" : " – " + mat(g.material).name}`, g.n, "nos", s.price * mult);
    });
    const winGroups = {};
    q.windows.forEach((w) => { winGroups[w.material] = (winGroups[w.material] || 0) + w.area; });
    Object.entries(winGroups).forEach(([m, a]) => add("Doors & windows", `Windows – ${mat(m).name}`, a, "sq ft", mat(m).price));
    add("Doors & windows", "Sunshades (chajja) over windows", q.sunshades, "nos", pricing.sunshadePerOpening);

    // Roof & terrace
    const ex = design.exterior;
    if (ex.roofType !== "flat") {
      const slope = 1.25;
      add("Roof & terrace", `${C.ROOF_TYPES[ex.roofType]} – ${mat(ex.roofMaterial).name}`, q.roofArea * slope, "sq ft", mat(ex.roofMaterial).price + pricing.slopedRoofFramePerSqft);
    } else add("Roof & terrace", "Terrace waterproofing & finish", q.roofArea, "sq ft", 65);
    add("Roof & terrace", "Parapet walls", q.parapetRft, "rft", pricing.parapetPerRft);
    Object.entries(q.railingRft).forEach(([m, l]) => add("Roof & terrace", "Balcony railing – " + mat(m).name, l, "rft", mat(m).price));

    // Exterior
    Object.entries(q.extFinish).forEach(([m, a]) => add("Exterior & elevation", "Exterior walls – " + mat(m).name, a, "sq ft", mat(m).price));

    // Site
    const cw = ex.compound;
    if (cw.on) {
      add("Site works", `Compound wall ${U.fmtFt(cw.height)} high – ${mat(cw.material).name}`, q.compoundRft, "rft", pricing.compoundPerRftPerFtHeight * cw.height * (pricing.compoundMaterialFactor[cw.material] || 1));
      const gs = C.GATE_STYLES[cw.gate.style];
      if (gs && gs.price) add("Site works", `${gs.label} (${U.fmtFt(cw.gate.width)}) – ${mat(cw.gate.material).name}`, 1, "nos", gs.price * (cw.gate.width / 12) * (mat(cw.gate.material).price || 1));
    }
    add("Site works", "Paving – parking & driveway", q.pavingArea, "sq ft", mat(design.materials.paving).price);
    add("Site works", "Lawn & landscaping", q.lawnArea, "sq ft", pricing.lawnPerSqft);

    // Interiors
    const furGroups = {};
    q.furniture.forEach((f) => { furGroups[f.id] = furGroups[f.id] || { f, n: 0 }; furGroups[f.id].n++; });
    Object.values(furGroups).forEach(({ f, n }) => add("Interiors & furniture", f.label, n, "nos", f.price));

    const subtotal = U.sum(lines, (l) => l.amount);
    add("Contingency", `Contingency (${Math.round(pricing.contingency * 100)}%)`, 1, "lump sum", subtotal * pricing.contingency);
    const total = U.sum(lines, (l) => l.amount);
    const groups = {};
    lines.forEach((l) => (groups[l.group] = (groups[l.group] || 0) + l.amount));
    const Qr = pricing.quantities;
    const quantities = [
      { item: "Cement", qty: q.builtUp * Qr.cementBags, unit: "bags" },
      { item: "Steel (TMT)", qty: q.builtUp * Qr.steelKg, unit: "kg" },
      { item: "Sand", qty: q.builtUp * Qr.sandCft, unit: "cft" },
      { item: "Aggregate", qty: q.builtUp * Qr.aggregateCft, unit: "cft" },
      { item: "Bricks / blocks", qty: q.builtUp * Qr.bricks, unit: "nos" },
      { item: "Floor tiles & stone (incl. 5% wastage)", qty: U.sum(Object.values(q.floorFinish)) * 1.05, unit: "sq ft" },
      { item: "Interior paint & wall tiles area", qty: U.sum(Object.values(q.wallFinish)), unit: "sq ft" },
      { item: "Exterior finish area", qty: U.sum(Object.values(q.extFinish)), unit: "sq ft" }
    ];
    return { lines, groups, total, builtUp: q.builtUp, perSqft: q.builtUp ? total / q.builtUp : 0, quantities, takeoff: q, grade };
  }

  HD.cost = { DEFAULT_PRICING, getPricing, setPricing, resetPricing, takeoff, estimate };
})(window.HD);
