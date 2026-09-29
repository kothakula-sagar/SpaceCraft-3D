/* Design document schema, factories and migration.
   Coordinates are in feet. Plan origin = plot back-left corner; +x right; +y toward the road (front). */
(function (HD) {
  const U = HD.util, C = HD.catalog;
  const SCHEMA_VERSION = 1;

  function defaultSetbacks(w, d) {
    if (w <= 25) return { front: 4, rear: 2, left: 2, right: 2 };
    if (w <= 35) return { front: 5, rear: 3, left: 3, right: 3 };
    if (w <= 45) return { front: 8, rear: 4, left: 4, right: 4 };
    return { front: 10, rear: 5, left: 5, right: 5 };
  }

  function createFloor(level, name) {
    return {
      id: U.uid("fl"),
      name: name || floorName(level),
      level,
      height: 10,
      rooms: [],
      openings: [],
      furniture: []
    };
  }
  function floorName(level) {
    return ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor"][level] || `Floor ${level}`;
  }

  function createRoom(type, x, y, w, d, name) {
    return { id: U.uid("rm"), type, name: name || C.ROOM_TYPES[type].label, x, y, w, d, floorMat: null, wallMat: null, ceilingMat: null };
  }

  function createDesign(opts = {}) {
    const width = opts.width || 30, depth = opts.depth || 40;
    const now = new Date().toISOString();
    return {
      id: U.uid("dsn"),
      schemaVersion: SCHEMA_VERSION,
      name: opts.name || `${opts.bhk ? opts.bhk + " BHK" : "Custom"} – ${width}×${depth}`,
      createdAt: now,
      updatedAt: now,
      meta: {
        bhk: opts.bhk || "custom",
        variantGroupId: null,
        variantLabel: "Design A",
        status: "draft",
        projectId: null,
        customerId: null,
        notes: "",
        ui: { step: "rooms", view: "split", activeFloorId: null }
      },
      plot: {
        width,
        depth,
        setbacks: opts.setbacks || defaultSetbacks(width, depth),
        facing: opts.facing || "E",
        roadWidth: 30
      },
      settings: { extWall: 0.75, intWall: 0.375, plinth: 1.5, grade: opts.grade || "standard", doorHeight: 7 },
      materials: {
        floor: "vitrified", bathFloor: "antiSkid", outdoor: "outdoorTile", paving: "paverGrey",
        wall: "paintIvory", bathWall: "wallTiles", kitchenWall: "wallTilesSand",
        ceiling: "ceilPOP", door: "doorFlush", mainDoor: "doorTeak", window: "winUPVC"
      },
      exterior: {
        wall: "extCream",
        accent: "stoneClad",
        accentOn: true,
        roofType: "flat",
        roofMaterial: "roofRCC",
        parapet: 3.5,
        sunshades: true,
        railing: "railSteel",
        compound: { on: true, height: 5, material: "compPaint", gate: { style: "sliding", width: 12, center: null, material: "gateSteel" } },
        lawn: true
      },
      floors: [createFloor(0)],
      site: { items: [] }
    };
  }

  /** Buildable envelope inside setbacks (front = +y side). */
  function envelope(plot) {
    const s = plot.setbacks;
    return { x: s.left, y: s.rear, w: Math.max(4, plot.width - s.left - s.right), d: Math.max(4, plot.depth - s.front - s.rear) };
  }

  function migrate(d) {
    if (!d || typeof d !== "object") throw new Error("Not a design");
    const base = createDesign({ width: d.plot?.width, depth: d.plot?.depth });
    const out = Object.assign({}, base, d);
    out.meta = Object.assign({}, base.meta, d.meta, { ui: Object.assign({}, base.meta.ui, d.meta?.ui) });
    out.plot = Object.assign({}, base.plot, d.plot, { setbacks: Object.assign({}, base.plot.setbacks, d.plot?.setbacks) });
    out.settings = Object.assign({}, base.settings, d.settings);
    out.materials = Object.assign({}, base.materials, d.materials);
    out.exterior = Object.assign({}, base.exterior, d.exterior);
    out.exterior.compound = Object.assign({}, base.exterior.compound, d.exterior?.compound);
    out.exterior.compound.gate = Object.assign({}, base.exterior.compound.gate, d.exterior?.compound?.gate);
    out.site = Object.assign({ items: [] }, d.site);
    out.floors = (d.floors && d.floors.length ? d.floors : base.floors).map((f, i) =>
      Object.assign({ height: 10, rooms: [], openings: [], furniture: [] }, f, { level: i, id: f.id || U.uid("fl") })
    );
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }

  /** Material resolution helpers (room overrides → design defaults). */
  function roomFloorMat(design, room) {
    return room.floorMat || design.materials[C.ROOM_TYPES[room.type]?.floorSlot || "floor"] || "vitrified";
  }
  function roomWallMat(design, room) {
    return room.wallMat || design.materials[C.ROOM_TYPES[room.type]?.wallSlot || "wall"] || "paintIvory";
  }
  function roomCeilMat(design, room) {
    return room.ceilingMat || design.materials.ceiling;
  }

  function floorElevation(design, level) {
    let e = design.settings.plinth;
    for (let i = 0; i < level; i++) e += design.floors[i].height;
    return e;
  }

  HD.model = { SCHEMA_VERSION, createDesign, createFloor, createRoom, floorName, envelope, defaultSetbacks, migrate, roomFloorMat, roomWallMat, roomCeilMat, floorElevation };
})(window.HD);
