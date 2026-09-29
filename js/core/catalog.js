/* Catalogs: room types, materials, furniture, door/window styles, plot presets.
   Pure data — in production these come from the backend catalog service. */
(function (HD) {
  const C = {};

  /* ---------- Room types ----------
     enclosed: gets full-height walls. Non-enclosed rooms use `edge` on their outer edges.
     floorSlot / wallSlot: which default material slot applies (see model.materials). */
  C.ROOM_TYPES = {
    living:    { label: "Living Room",    color: "#f6e7c8", enclosed: true,  min: [9, 9],  size: [14, 12], floorSlot: "floor",     wallSlot: "wall",        icon: "🛋️" },
    dining:    { label: "Dining",         color: "#f3dcc0", enclosed: true,  min: [7, 7],  size: [10, 9],  floorSlot: "floor",     wallSlot: "wall",        icon: "🍽️" },
    kitchen:   { label: "Kitchen",        color: "#f7d6c9", enclosed: true,  min: [6, 6],  size: [9, 8],   floorSlot: "floor",     wallSlot: "kitchenWall", icon: "🍳" },
    master:    { label: "Master Bedroom", color: "#dfe6f7", enclosed: true,  min: [10, 10], size: [13, 12], floorSlot: "floor",    wallSlot: "wall",        icon: "🛏️" },
    bedroom:   { label: "Bedroom",        color: "#e4ecf8", enclosed: true,  min: [8, 8],  size: [11, 11], floorSlot: "floor",     wallSlot: "wall",        icon: "🛏️" },
    bathroom:  { label: "Bathroom",       color: "#d6eef0", enclosed: true,  min: [4, 5],  size: [5, 7],   floorSlot: "bathFloor", wallSlot: "bathWall",    icon: "🚿" },
    pooja:     { label: "Pooja Room",     color: "#fbe9b7", enclosed: true,  min: [3, 3],  size: [5, 5],   floorSlot: "floor",     wallSlot: "wall",        icon: "🪔" },
    utility:   { label: "Utility",        color: "#e5e7eb", enclosed: true,  min: [3, 4],  size: [5, 6],   floorSlot: "bathFloor", wallSlot: "bathWall",    icon: "🧺" },
    store:     { label: "Store Room",     color: "#e8e2d8", enclosed: true,  min: [3, 3],  size: [5, 6],   floorSlot: "floor",     wallSlot: "wall",        icon: "📦" },
    study:     { label: "Study",          color: "#e2efe0", enclosed: true,  min: [6, 6],  size: [9, 9],   floorSlot: "floor",     wallSlot: "wall",        icon: "📚" },
    lounge:    { label: "Family Lounge",  color: "#efe3f3", enclosed: true,  min: [8, 8],  size: [12, 11], floorSlot: "floor",     wallSlot: "wall",        icon: "🛋️" },
    passage:   { label: "Passage",        color: "#f1f1ef", enclosed: true,  min: [3, 3],  size: [3.5, 10], floorSlot: "floor",    wallSlot: "wall",        icon: "↔" },
    staircase: { label: "Staircase",      color: "#e6e1f2", enclosed: true,  min: [6, 9],  size: [8, 11],  floorSlot: "floor",     wallSlot: "wall",        icon: "🪜" },
    balcony:   { label: "Balcony",        color: "#dff1e6", enclosed: false, edge: "railing", min: [3, 3], size: [10, 4], floorSlot: "outdoor", wallSlot: "wall", icon: "🌿" },
    sitout:    { label: "Sit-out / Porch", color: "#e7f1dc", enclosed: false, edge: "none",   min: [4, 4], size: [9, 7],  floorSlot: "outdoor", wallSlot: "wall", icon: "🪑" },
    terrace:   { label: "Open Terrace",   color: "#e9f2e6", enclosed: false, edge: "parapet", min: [4, 4], size: [12, 10], floorSlot: "outdoor", wallSlot: "wall", icon: "☀️" },
    parking:   { label: "Car Parking",    color: "#e3e5e8", enclosed: false, edge: "none",   min: [8, 12], size: [10, 16], floorSlot: "paving", wallSlot: "wall", icon: "🚗" },
    custom:    { label: "Custom Room",    color: "#f0ede6", enclosed: true,  min: [3, 3],  size: [10, 10], floorSlot: "floor",     wallSlot: "wall",        icon: "▢" }
  };
  C.ADDABLE_ROOMS = ["living", "master", "bedroom", "kitchen", "bathroom", "dining", "balcony", "pooja", "utility", "store", "study", "lounge", "sitout", "terrace", "staircase", "passage", "parking", "custom"];

  /* ---------- Materials ----------
     pattern: procedural texture used in 3D (and swatch in UI); scale = world ft per texture tile.
     price: INR per sq ft (surface), or per unit where noted. */
  const M = (id, cat, name, color, pattern, o = {}) => ({ id, cat, name, color, pattern, scale: 2, rough: 0.8, metal: 0, price: 0, ...o });
  C.MATERIALS = [
    // Flooring
    M("vitrified",   "floor", "Vitrified tiles 2'×2'", "#e9e4da", "tiles", { scale: 2, rough: 0.35, price: 95 }),
    M("vitrGrey",    "floor", "Vitrified tiles – grey", "#c9c9c4", "tiles", { scale: 2, rough: 0.35, price: 100 }),
    M("marble",      "floor", "Italian marble",        "#f1eee8", "marble", { scale: 4, rough: 0.2, price: 260 }),
    M("granite",     "floor", "Granite – black",       "#3b3a3a", "granite", { scale: 3, rough: 0.25, price: 190 }),
    M("woodLaminate","floor", "Wooden laminate",       "#b58354", "wood", { scale: 3, rough: 0.55, price: 150 }),
    M("teakFloor",   "floor", "Engineered teak",       "#8a5a34", "wood", { scale: 3, rough: 0.5, price: 320 }),
    M("ceramic",     "floor", "Ceramic tiles 1'×1'",   "#e6d8c3", "tiles", { scale: 1, rough: 0.5, price: 60 }),
    M("kota",        "floor", "Kota stone",            "#9aa08f", "stone", { scale: 2, rough: 0.6, price: 75 }),
    M("antiSkid",    "floor", "Anti-skid tiles",       "#c8d3d6", "tiles", { scale: 1, rough: 0.8, price: 80 }),
    M("terrazzo",    "floor", "Terrazzo",              "#d9d4ca", "granite", { scale: 3, rough: 0.4, price: 140 }),
    // Outdoor floors / paving
    M("outdoorTile", "outdoor", "Outdoor terracotta tile", "#b9765a", "tiles", { scale: 1, rough: 0.8, price: 70 }),
    M("deck",        "outdoor", "WPC decking",         "#8f6a4a", "wood", { scale: 3, rough: 0.7, price: 180 }),
    M("outdoorStone","outdoor", "Sandstone",           "#cdb48f", "stone", { scale: 2, rough: 0.8, price: 90 }),
    M("paverGrey",   "paving", "Interlocking pavers – grey", "#9c9c98", "pavers", { scale: 1.5, rough: 0.9, price: 85 }),
    M("paverRed",    "paving", "Interlocking pavers – red",  "#a4634d", "pavers", { scale: 1.5, rough: 0.9, price: 85 }),
    M("concrete",    "paving", "Broom-finish concrete", "#b9b8b2", "plain", { rough: 0.95, price: 55 }),
    // Interior walls
    M("paintIvory",  "wall", "Emulsion – ivory",       "#f4efe4", "plain", { rough: 0.9, price: 22 }),
    M("paintWhite",  "wall", "Emulsion – white",       "#f7f7f4", "plain", { rough: 0.9, price: 22 }),
    M("paintGrey",   "wall", "Emulsion – warm grey",   "#d9d6cf", "plain", { rough: 0.9, price: 22 }),
    M("paintSage",   "wall", "Emulsion – sage",        "#cfd8c4", "plain", { rough: 0.9, price: 24 }),
    M("paintBlue",   "wall", "Emulsion – powder blue", "#cfdde8", "plain", { rough: 0.9, price: 24 }),
    M("paintPeach",  "wall", "Emulsion – peach",       "#f1d6c3", "plain", { rough: 0.9, price: 24 }),
    M("wallTiles",   "wall", "Glazed wall tiles",      "#e3eef0", "tiles", { scale: 1, rough: 0.2, price: 85 }),
    M("wallTilesSand","wall","Wall tiles – sand",      "#e9dfcd", "tiles", { scale: 1, rough: 0.25, price: 85 }),
    M("woodPanel",   "wall", "Wood panelling",         "#9b6b43", "wood", { scale: 2, rough: 0.6, price: 260 }),
    M("wallpaper",   "wall", "Textured wallpaper",     "#e8e0d2", "stone", { scale: 1.5, rough: 0.9, price: 65 }),
    // Ceiling
    M("ceilPOP",     "ceiling", "POP – white",         "#fbfbf8", "plain", { rough: 0.95, price: 30 }),
    M("ceilGypsum",  "ceiling", "Gypsum false ceiling", "#f5f3ee", "plain", { rough: 0.95, price: 90 }),
    M("ceilWood",    "ceiling", "Wooden ceiling",      "#a57449", "wood", { scale: 2, rough: 0.6, price: 230 }),
    // Exterior walls
    M("extCream",    "exterior", "Exterior paint – cream",      "#efe3c8", "plain", { rough: 0.9, price: 28 }),
    M("extWhite",    "exterior", "Exterior paint – white",      "#f3f2ee", "plain", { rough: 0.9, price: 28 }),
    M("extGrey",     "exterior", "Exterior paint – slate grey", "#9aa1a6", "plain", { rough: 0.9, price: 30 }),
    M("extTerracotta","exterior","Exterior paint – terracotta", "#c47a5a", "plain", { rough: 0.9, price: 30 }),
    M("extSage",     "exterior", "Exterior paint – sage",       "#aab89c", "plain", { rough: 0.9, price: 30 }),
    M("textured",    "exterior", "Textured finish – sand",      "#d8c7a6", "stone", { scale: 1.5, rough: 1, price: 48 }),
    M("stoneClad",   "exterior", "Stone cladding",              "#9d9180", "stone", { scale: 3, rough: 0.95, price: 185 }),
    M("brickClad",   "exterior", "Brick cladding",              "#a4583d", "brick", { scale: 1.4, rough: 0.9, price: 150 }),
    M("woodClad",    "exterior", "HPL wood panels",             "#8d6240", "wood", { scale: 3, rough: 0.6, price: 320 }),
    // Roof
    M("roofRCC",     "roof", "RCC slab + waterproofing", "#c9c6bf", "plain", { rough: 0.95, price: 0 }),
    M("roofClay",    "roof", "Clay roof tiles",          "#a9533a", "roofTiles", { scale: 2, rough: 0.8, price: 160 }),
    M("roofGrey",    "roof", "Concrete roof tiles",      "#5e6468", "roofTiles", { scale: 2, rough: 0.8, price: 130 }),
    M("roofMetal",   "roof", "Metal sheet – green",      "#48644d", "plain", { rough: 0.45, metal: 0.4, price: 110 }),
    // Doors (price multiplier on door style price)
    M("doorTeak",    "door", "Teak wood",        "#7a4a26", "wood", { scale: 2, rough: 0.5, price: 1.8 }),
    M("doorFlush",   "door", "Flush door – laminate", "#b88a5e", "wood", { scale: 3, rough: 0.55, price: 1.0 }),
    M("doorWhite",   "door", "Painted – white",  "#efece6", "plain", { rough: 0.6, price: 0.9 }),
    M("doorPVC",     "door", "PVC",              "#dfe3e6", "plain", { rough: 0.5, price: 0.6 }),
    M("doorWalnut",  "door", "Walnut veneer",    "#5a3b27", "wood", { scale: 2, rough: 0.5, price: 1.5 }),
    // Window frames (price per sq ft of window)
    M("winUPVC",     "window", "UPVC – white",       "#f2f2f0", "plain", { rough: 0.5, price: 650 }),
    M("winAlu",      "window", "Aluminium – grey",   "#6b7075", "plain", { rough: 0.35, metal: 0.6, price: 480 }),
    M("winAluBlack", "window", "Aluminium – black",  "#262829", "plain", { rough: 0.35, metal: 0.6, price: 520 }),
    M("winWood",     "window", "Wood",               "#7c5130", "wood", { scale: 2, rough: 0.5, price: 900 }),
    // Railings
    M("railSteel",   "railing", "Stainless steel",  "#b9bec3", "plain", { rough: 0.25, metal: 0.8, price: 1200 }),
    M("railGlass",   "railing", "Toughened glass",  "#bfe1ea", "plain", { rough: 0.05, price: 1800 }),
    M("railMS",      "railing", "MS – black",       "#2c2e30", "plain", { rough: 0.5, metal: 0.5, price: 900 }),
    // Compound wall
    M("compPaint",   "compound", "Plastered & painted", "#e6dccb", "plain", { rough: 0.95, price: 0 }),
    M("compBrick",   "compound", "Exposed brick",      "#a4583d", "brick", { scale: 1.4, rough: 0.9, price: 0 }),
    M("compStone",   "compound", "Stone",              "#8f887d", "stone", { scale: 3, rough: 0.95, price: 0 }),
    // Gate
    M("gateSteel",   "gate", "Steel – black", "#25282a", "plain", { rough: 0.4, metal: 0.7, price: 1 }),
    M("gateWood",    "gate", "Wood + steel",  "#7a4a26", "wood", { scale: 2, rough: 0.5, price: 1.3 }),
    M("gateSS",      "gate", "Stainless steel", "#c3c8cc", "plain", { rough: 0.25, metal: 0.8, price: 1.4 }),
    // Landscape (not user-selectable directly)
    M("lawn",        "landscape", "Lawn", "#6f9a4f", "grass", { scale: 6, rough: 1, price: 45 }),
    M("soil",        "landscape", "Soil", "#9b8566", "grass", { scale: 6, rough: 1, price: 0 })
  ];
  C.MAT = Object.fromEntries(C.MATERIALS.map((m) => [m.id, m]));
  C.matsOf = (...cats) => C.MATERIALS.filter((m) => cats.includes(m.cat));

  /* ---------- Doors & windows ---------- */
  C.DOOR_STYLES = {
    single:  { label: "Single swing",  width: 3,   leaves: 1, price: 14000 },
    double:  { label: "Double swing",  width: 4.5, leaves: 2, price: 24000 },
    sliding: { label: "Sliding",       width: 5,   leaves: 2, price: 30000, glass: true },
    french:  { label: "French (glass)", width: 5,  leaves: 2, price: 34000, glass: true },
    main:    { label: "Main entrance", width: 3.5, leaves: 1, price: 45000 },
    arch:    { label: "Open arch (no shutter)", width: 4, leaves: 0, price: 6000 }
  };
  C.WINDOW_STYLES = {
    casement:   { label: "Casement (2 shutters)", width: 4,   height: 4,   sill: 3 },
    sliding:    { label: "Sliding (2 track)",     width: 5,   height: 4,   sill: 3 },
    fixed:      { label: "Fixed glass",           width: 4,   height: 5,   sill: 2.5 },
    ventilator: { label: "Ventilator",            width: 2,   height: 1.5, sill: 5.5 },
    french:     { label: "Full-height glazing",   width: 6,   height: 7,   sill: 0.25 }
  };

  /* ---------- Furniture & objects ----------
     size: [width (x), depth (y), height] in ft. Back of the object is local -y. */
  const F = (id, cat, label, size, shape, price, color, o = {}) => ({ id, cat, label, size, shape, price, color, ...o });
  C.FURNITURE = [
    F("bedKing",     "bedroom", "King bed",          [6.5, 7, 3.5], "bed", 55000, "#8a5a3a"),
    F("bedQueen",    "bedroom", "Queen bed",         [5.2, 6.8, 3.4], "bed", 42000, "#8a5a3a"),
    F("bedSingle",   "bedroom", "Single bed",        [3.5, 6.5, 3], "bed", 22000, "#8a5a3a"),
    F("wardrobe",    "bedroom", "Wardrobe",          [6, 2, 7], "wardrobe", 48000, "#b58a5f"),
    F("sideTable",   "bedroom", "Bedside table",     [1.5, 1.5, 1.8], "cabinet", 6500, "#8a5a3a"),
    F("dresser",     "bedroom", "Dressing unit",     [3, 1.5, 5.5], "dresser", 16000, "#b58a5f"),
    F("sofa3",       "living",  "3-seater sofa",     [7, 3, 2.8], "sofa", 45000, "#6f7f8c"),
    F("sofaL",       "living",  "L-shaped sofa",     [8, 6, 2.8], "sofaL", 72000, "#6f7f8c"),
    F("armchair",    "living",  "Armchair",          [2.8, 2.8, 2.8], "armchair", 16000, "#a0714f"),
    F("coffeeTable", "living",  "Coffee table",      [4, 2, 1.4], "table", 12000, "#7b5236", { tableH: 1.4 }),
    F("tvUnit",      "living",  "TV unit",           [6, 1.5, 6], "tvUnit", 28000, "#5b4a3d"),
    F("rug",         "living",  "Area rug",          [7, 5, 0.05], "rug", 9000, "#9c7a6b"),
    F("dining4",     "dining",  "Dining table (4)",  [4.5, 3, 2.5], "dining", 32000, "#7b5236", { seats: 4 }),
    F("dining6",     "dining",  "Dining table (6)",  [6, 3.5, 2.5], "dining", 48000, "#7b5236", { seats: 6 }),
    F("chair",       "dining",  "Chair",             [1.6, 1.6, 3], "chair", 4500, "#7b5236"),
    F("counter",     "kitchen", "Kitchen counter",   [8, 2, 3], "counter", 60000, "#e9e6df", { hob: true, sink: true }),
    F("counterPlain","kitchen", "Counter (plain)",   [4, 2, 3], "counter", 28000, "#e9e6df"),
    F("tallUnit",    "kitchen", "Tall pantry unit",  [2, 2, 7], "wardrobe", 26000, "#e9e6df"),
    F("fridge",      "kitchen", "Refrigerator",      [2.5, 2.4, 6], "fridge", 45000, "#d9dcde"),
    F("wc",          "bath",    "WC",                [1.5, 2.3, 2.6], "wc", 12000, "#f7f7f5"),
    F("basin",       "bath",    "Wash basin",        [2, 1.5, 2.8], "basin", 8000, "#f7f7f5"),
    F("shower",      "bath",    "Shower area",       [3, 3, 7], "shower", 18000, "#cfe6ee"),
    F("washer",      "bath",    "Washing machine",   [2, 2, 2.8], "washer", 32000, "#f1f1f1"),
    F("studyDesk",   "office",  "Study desk",        [4, 2, 2.5], "desk", 14000, "#8a6a4a"),
    F("officeChair", "office",  "Office chair",      [2, 2, 3.5], "chair", 9000, "#2f3438"),
    F("bookshelf",   "office",  "Bookshelf",         [3, 1.2, 6], "shelf", 15000, "#8a6a4a"),
    F("poojaUnit",   "pooja",   "Pooja unit (mandir)", [3, 1.5, 6], "pooja", 35000, "#c89b5b"),
    F("plant",       "decor",   "Indoor plant",      [1.4, 1.4, 3.5], "plant", 2500, "#4f7d52"),
    F("swing",       "outdoor", "Jhula / swing",     [4, 2.5, 7], "swing", 22000, "#7b5236"),
    F("outChair",    "outdoor", "Patio chair",       [2, 2, 2.8], "armchair", 5000, "#a88663"),
    F("car",         "outdoor", "Car",               [6, 14, 5], "car", 0, "#7a8894"),
    F("bike",        "outdoor", "Two-wheeler",       [2.2, 6, 3.5], "bike", 0, "#3b4a5c"),
    F("tree",        "outdoor", "Tree",              [6, 6, 16], "tree", 3500, "#4c7a43"),
    F("palm",        "outdoor", "Palm",              [5, 5, 14], "palm", 4500, "#5b8a45"),
    F("shrub",       "outdoor", "Shrub",             [2.5, 2.5, 2.5], "shrub", 800, "#56884a")
  ];
  C.FUR = Object.fromEntries(C.FURNITURE.map((f) => [f.id, f]));
  C.FURNITURE_CATS = { bedroom: "Bedroom", living: "Living", dining: "Dining", kitchen: "Kitchen", bath: "Bath", office: "Study", pooja: "Pooja", decor: "Decor", outdoor: "Outdoor" };

  C.PLOT_PRESETS = [
    { label: "20 × 30", w: 20, d: 30 },
    { label: "30 × 40", w: 30, d: 40 },
    { label: "30 × 50", w: 30, d: 50 },
    { label: "40 × 60", w: 40, d: 60 },
    { label: "50 × 80", w: 50, d: 80 },
    { label: "60 × 90", w: 60, d: 90 }
  ];

  C.FACINGS = {
    N: { label: "North facing", bearing: 0 },
    E: { label: "East facing", bearing: 90 },
    S: { label: "South facing", bearing: 180 },
    W: { label: "West facing", bearing: 270 }
  };

  C.ROOF_TYPES = { flat: "Flat RCC with parapet", gable: "Gable (sloped)", hip: "Hip (4-sided slope)" };
  C.GATE_STYLES = { sliding: { label: "Sliding gate", price: 65000 }, swing: { label: "Swing gate (2 leaves)", price: 48000 }, none: { label: "No gate", price: 0 } };
  C.GRADES = { basic: "Basic", standard: "Standard", premium: "Premium" };

  HD.catalog = C;
})(window.HD);
