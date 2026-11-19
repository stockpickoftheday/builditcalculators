/* Home and Garden Calculators (US) — calculator logic.
   Pure functions first (testable in Node), DOM wiring at the bottom.
   All figures in US customary units. Formulas verified by web search,
   November 2026 — see the notes on each function. */
(function () {
  'use strict';

  /* ---------- helpers ---------- */

  function num(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n) || n < 0) return fallback === undefined ? 0 : fallback;
    return n;
  }

  function fmt(n, decimals) {
    if (decimals === undefined) decimals = 2;
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtInt(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  /* ---------- concrete ---------- */
  /* One cubic yard = 27 cubic feet. Bag yields are the standard
     manufacturer figures (Quikrete No. 1101 data sheet, confirmed by
     several calculator sites, Nov 2026):
     80 lb bag = 0.60 cu ft (45 per yard), 60 lb = 0.45 (60 per yard),
     40 lb = 0.30 (90 per yard). */
  var BAG_YIELD = { 40: 0.30, 60: 0.45, 80: 0.60 };

  /* Slab: length x width x depth. Returns net volume plus the volume
     with the waste allowance added. */
  function concreteSlab(lengthFt, widthFt, depthIn, wastePct) {
    var cuFt = num(lengthFt) * num(widthFt) * (num(depthIn) / 12);
    var cuFtWaste = cuFt * (1 + num(wastePct, 10) / 100);
    return {
      cuFt: cuFt,
      cuYd: cuFt / 27,
      cuFtWaste: cuFtWaste,
      cuYdWaste: cuFtWaste / 27,
      bags40: Math.ceil(cuFtWaste / BAG_YIELD[40]),
      bags60: Math.ceil(cuFtWaste / BAG_YIELD[60]),
      bags80: Math.ceil(cuFtWaste / BAG_YIELD[80])
    };
  }

  /* Round post holes: cylinder volume. diameterIn and depthIn in inches. */
  function concretePostHoles(diameterIn, depthIn, holes) {
    var radiusFt = (num(diameterIn) / 2) / 12;
    var depthFt = num(depthIn) / 12;
    var oneHoleCuFt = Math.PI * radiusFt * radiusFt * depthFt;
    var cuFt = oneHoleCuFt * num(holes);
    return {
      cuFtPerHole: oneHoleCuFt,
      cuFt: cuFt,
      cuYd: cuFt / 27,
      bags80: Math.ceil(cuFt / BAG_YIELD[80]),
      bags60: Math.ceil(cuFt / BAG_YIELD[60]),
      bags40: Math.ceil(cuFt / BAG_YIELD[40])
    };
  }

  /* ---------- paint ---------- */
  /* One gallon covers about 350–400 sq ft per coat on smooth, primed
     drywall. We use 350 as the planning number (the safe end of the
     range; manufacturer labels assume perfect conditions). A standard
     interior door is 3 ft x 7 ft = 21 sq ft; a typical window is
     3 ft x 5 ft = 15 sq ft. */
  var PAINT_COVERAGE = 350; // sq ft per gallon, one coat
  var DOOR_SQFT = 21;
  var WINDOW_SQFT = 15;

  function paintRoom(lengthFt, widthFt, heightFt, doors, windows, coats, includeCeiling) {
    var wallArea = 2 * (num(lengthFt) + num(widthFt)) * num(heightFt);
    var openings = num(doors) * DOOR_SQFT + num(windows) * WINDOW_SQFT;
    var paintable = Math.max(0, wallArea - openings);
    if (includeCeiling) paintable += num(lengthFt) * num(widthFt);
    var gallons = paintable * num(coats, 2) / PAINT_COVERAGE;
    return {
      wallArea: wallArea,
      paintable: paintable,
      gallons: gallons,
      gallonsToBuy: Math.ceil(gallons * 4) / 4, // round up to the nearest quart
      wholeGallons: Math.ceil(gallons)
    };
  }

  /* Paint straight from an area (for walls already measured). */
  function paintArea(areaSqFt, coats) {
    var gallons = num(areaSqFt) * num(coats, 2) / PAINT_COVERAGE;
    return {
      gallons: gallons,
      gallonsToBuy: Math.ceil(gallons * 4) / 4,
      wholeGallons: Math.ceil(gallons)
    };
  }

  /* ---------- mulch / topsoil / gravel ---------- */
  /* Cubic yards = area (sq ft) x depth (in) / 324. One cubic yard
     covers 108 sq ft at 3 in deep, 162 at 2 in, 81 at 4 in.
     A 2 cu ft bag is 13.5 bags per yard. (Texas A&M AgriLife
     Extension formula, confirmed by many calculator sites.) */
  function mulchCalc(areaSqFt, depthIn, bagCuFt) {
    var cuYd = num(areaSqFt) * num(depthIn) / 324;
    var bagSize = num(bagCuFt, 2) || 2;
    return {
      cuFt: cuYd * 27,
      cuYd: cuYd,
      bags: Math.ceil(cuYd * 27 / bagSize)
    };
  }

  /* Weight per cubic yard, dry, planning figures (ranges vary with
     moisture — the page states the range):
     topsoil 2,000 lb (1.0 ton), gravel 2,800 lb (1.4 tons),
     sand 2,700 lb (1.35 tons), mulch 500 lb (0.25 tons). */
  var MATERIAL_LB_PER_YD = {
    topsoil: 2000,
    gravel: 2800,
    sand: 2700,
    mulch: 500
  };

  function bulkCalc(areaSqFt, depthIn, material) {
    var cuFt = num(areaSqFt) * (num(depthIn) / 12);
    var cuYd = cuFt / 27;
    var lbPerYd = MATERIAL_LB_PER_YD[material] || MATERIAL_LB_PER_YD.topsoil;
    var lb = cuYd * lbPerYd;
    return {
      cuFt: cuFt,
      cuYd: cuYd,
      lb: lb,
      tons: lb / 2000,
      lbPerYd: lbPerYd
    };
  }

  /* ---------- tile ---------- */
  /* Tiles needed = floor area / one tile's area, plus waste (10%
     is the standard allowance for straight-lay tile). */
  function tileCalc(areaSqFt, tileWidthIn, tileLengthIn, wastePct, tilesPerBox) {
    var tileSqFt = (num(tileWidthIn) / 12) * (num(tileLengthIn) / 12);
    var tiles = tileSqFt > 0 ? Math.ceil(num(areaSqFt) / tileSqFt) : 0;
    var tilesWaste = Math.ceil(tiles * (1 + num(wastePct, 10) / 100));
    var perBox = num(tilesPerBox, 10) || 10;
    return {
      tiles: tiles,
      tilesWaste: tilesWaste,
      boxes: Math.ceil(tilesWaste / perBox)
    };
  }

  /* ---------- drywall ---------- */
  /* A 4x8 sheet covers 32 sq ft. Screws: about 32 per wall sheet
     (1 per sq ft). Joint compound: about 1 gallon per 100 sq ft for
     a three-coat finish. Paper tape: about 0.37 linear ft per sq ft
     of board. (USG / Gypsum Construction Handbook estimating guides,
     confirmed by several calculator sites, Nov 2026.) */
  function drywallCalc(wallAreaSqFt, ceilingAreaSqFt, sheetWidthFt, sheetLengthFt, wastePct) {
    var total = num(wallAreaSqFt) + num(ceilingAreaSqFt);
    var sheetSqFt = num(sheetWidthFt, 4) * num(sheetLengthFt, 8);
    var sheets = sheetSqFt > 0 ? Math.ceil(total * (1 + num(wastePct, 10) / 100) / sheetSqFt) : 0;
    return {
      totalArea: total,
      sheets: sheets,
      screws: sheets * 32,
      compoundGal: Math.ceil(total / 100),
      tapeFt: Math.round(total * 0.37)
    };
  }

  /* Room helper: wall area from room dimensions minus openings. */
  function drywallRoom(lengthFt, widthFt, heightFt, doors, windows, includeCeiling) {
    var wallArea = 2 * (num(lengthFt) + num(widthFt)) * num(heightFt)
      - num(doors) * DOOR_SQFT - num(windows) * WINDOW_SQFT;
    wallArea = Math.max(0, wallArea);
    var ceilingArea = includeCeiling ? num(lengthFt) * num(widthFt) : 0;
    return { wallArea: wallArea, ceilingArea: ceilingArea };
  }

  /* ---------- fence ---------- */
  /* Posts: 8 ft on center is standard (matches 8 ft rail stock);
     6 ft in high-wind or heavy-board fences. Posts = sections + 1.
     A nominal 1x6 picket is actually 5.5 in wide; 2.2 pickets per
     foot with no gap. Rails: 2 per section under 5 ft, 3 for 5–7 ft,
     4 for 8 ft. One 80 lb bag of concrete per post is the usual
     rule for a 4x4 post in a 10–12 in hole, 24 in deep. */
  function fenceCalc(lengthFt, heightFt, spacingFt, picketWidthIn, gapIn, wastePct) {
    var length = num(lengthFt);
    var spacing = num(spacingFt, 8) || 8;
    var sections = Math.ceil(length / spacing);
    var posts = sections + 1;
    var picketCoverageIn = num(picketWidthIn, 5.5) + num(gapIn, 0);
    var pickets = picketCoverageIn > 0
      ? Math.ceil(length * 12 / picketCoverageIn * (1 + num(wastePct, 10) / 100))
      : 0;
    var height = num(heightFt, 6);
    var railsPerSection = height < 5 ? 2 : (height <= 7 ? 3 : 4);
    return {
      sections: sections,
      posts: posts,
      pickets: pickets,
      railsPerSection: railsPerSection,
      rails: sections * railsPerSection,
      concreteBags80: posts // one 80 lb bag per post
    };
  }

  /* ---------- deck ---------- */
  /* A 5/4x6 deck board is actually 5.5 in wide. With a 1/8 in gap
     each board covers 5.625 in of deck width, so one square foot of
     deck takes 12 / 5.625 = 2.13 linear feet of board.
     Joists run every 16 in on center. Screws: about 350 per
     100 sq ft (two screws per board at every joist) is the common
     rule of thumb — 3.5 per sq ft. */
  function deckCalc(lengthFt, widthFt, boardWidthIn, gapIn, joistSpacingIn) {
    var length = num(lengthFt);
    var width = num(widthFt);
    var area = length * width;
    var coverageIn = num(boardWidthIn, 5.5) + num(gapIn, 0.125);
    var linearFt = coverageIn > 0 ? area * 12 / coverageIn : 0;
    var joistSpacing = num(joistSpacingIn, 16) || 16;
    var joistCount = Math.floor(length * 12 / joistSpacing) + 1;
    return {
      area: area,
      linearFt: linearFt,
      joistCount: joistCount,
      joistLinearFt: joistCount * width,
      screws: Math.round(area * 3.5)
    };
  }

  /* ---------- flooring ---------- */
  /* Flooring is sold by the box: order = area + waste, boxes =
     ceil(order / sq ft per box). Box coverage varies by brand —
     laminate ~20 sq ft, vinyl plank ~24, hardwood ~20, engineered
     ~22 (several flooring calculators, Nov 2026). Underlayment
     rolls usually cover 100 sq ft. Waste: 10% straight lay,
     15% diagonal or lots of corners, 20% herringbone. */
  function flooringCalc(areaSqFt, boxSqFt, wastePct) {
    var area = num(areaSqFt);
    var order = Math.round(area * (1 + num(wastePct, 10) / 100) * 100) / 100;
    var perBox = num(boxSqFt, 20) || 20;
    return {
      area: area,
      order: order,
      boxes: Math.ceil(order / perBox),
      underlayment: Math.ceil(order / 100)
    };
  }

  /* ---------- shared exports (Node tests) ---------- */
  var api = {
    concreteSlab: concreteSlab,
    concretePostHoles: concretePostHoles,
    paintRoom: paintRoom,
    paintArea: paintArea,
    mulchCalc: mulchCalc,
    bulkCalc: bulkCalc,
    tileCalc: tileCalc,
    drywallCalc: drywallCalc,
    drywallRoom: drywallRoom,
    fenceCalc: fenceCalc,
    deckCalc: deckCalc,
    flooringCalc: flooringCalc,
    BAG_YIELD: BAG_YIELD,
    PAINT_COVERAGE: PAINT_COVERAGE,
    MATERIAL_LB_PER_YD: MATERIAL_LB_PER_YD
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /* ---------- DOM wiring (browser only) ---------- */

  if (typeof document === 'undefined') return;

  function $(id) { return document.getElementById(id); }
  function val(id, fallback) {
    var el = $(id);
    if (!el) return fallback;
    var n = parseFloat(el.value);
    return isNaN(n) ? fallback : n;
  }
  function checked(id) {
    var el = $(id);
    return el ? el.checked : false;
  }
  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }
  function show(id, visible) {
    var el = $(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  function wire(inputs, update) {
    inputs.forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', update);
      if (el) el.addEventListener('change', update);
    });
    update();
  }

  function money0(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  /* --- concrete page + featured calculator on the home page --- */
  function updateConcrete() {
    var mode = ($('conc-mode') && $('conc-mode').value) || 'slab';
    show('conc-slab-fields', mode === 'slab');
    show('conc-post-fields', mode === 'post');
    var waste = val('conc-waste', 10);
    var r;
    if (mode === 'slab') {
      r = concreteSlab(val('conc-length', 10), val('conc-width', 10), val('conc-depth', 4), waste);
      setText('conc-big', fmt(r.cuYdWaste) + ' yd³');
      setText('conc-cuft', fmt(r.cuFtWaste) + ' cu ft (with ' + waste + '% waste)');
      setText('conc-net', fmt(r.cuYd) + ' yd³ before waste');
    } else {
      r = concretePostHoles(val('conc-hole-dia', 12), val('conc-hole-depth', 24), val('conc-holes', 4));
      setText('conc-big', fmt(r.cuYd) + ' yd³');
      setText('conc-cuft', fmt(r.cuFt) + ' cu ft total (' + fmt(r.cuFtPerHole) + ' cu ft per hole)');
      setText('conc-net', val('conc-holes', 4) + ' holes');
    }
    setText('conc-bags80', fmtInt(r.bags80) + ' bags');
    setText('conc-bags60', fmtInt(r.bags60) + ' bags');
    setText('conc-bags40', fmtInt(r.bags40) + ' bags');
    setText('conc-sticky', fmt(r.cuYdWaste !== undefined ? r.cuYdWaste : r.cuYd) + ' yd³');
    show('conc-sticky-bar', true);
  }

  /* --- paint page --- */
  function updatePaint() {
    var r = paintRoom(
      val('paint-length', 12), val('paint-width', 12), val('paint-height', 8),
      val('paint-doors', 1), val('paint-windows', 2), val('paint-coats', 2),
      checked('paint-ceiling')
    );
    setText('paint-big', fmt(r.gallonsToBuy) + ' gal');
    setText('paint-area', fmtInt(r.paintable) + ' sq ft to paint');
    setText('paint-exact', fmt(r.gallons) + ' gallons exactly');
    setText('paint-whole', fmtInt(r.wholeGallons) + ' whole gallons');
    setText('paint-sticky', fmt(r.gallonsToBuy) + ' gal');
    show('paint-sticky-bar', true);
  }

  /* --- mulch page --- */
  function updateMulch() {
    var area = val('mulch-length', 20) * val('mulch-width', 10);
    var r = mulchCalc(area, val('mulch-depth', 3), val('mulch-bag', 2));
    setText('mulch-big', fmt(r.cuYd) + ' yd³');
    setText('mulch-cuft', fmt(r.cuFt) + ' cu ft');
    setText('mulch-bags', fmtInt(r.bags) + ' bags');
    setText('mulch-area', fmtInt(area) + ' sq ft at ' + val('mulch-depth', 3) + ' in deep');
    setText('mulch-sticky', fmt(r.cuYd) + ' yd³');
    show('mulch-sticky-bar', true);
  }

  /* --- topsoil / gravel page --- */
  function updateTopsoil() {
    var area = val('top-length', 10) * val('top-width', 10);
    var material = ($('top-material') && $('top-material').value) || 'topsoil';
    var r = bulkCalc(area, val('top-depth', 6), material);
    var label = { topsoil: 'Topsoil', gravel: 'Gravel', sand: 'Sand', mulch: 'Mulch' }[material] || 'Material';
    setText('top-big', fmt(r.cuYd) + ' yd³');
    setText('top-weight', fmtInt(r.lb) + ' lb (' + fmt(r.tons) + ' tons)');
    setText('top-cuft', fmt(r.cuFt) + ' cu ft of ' + label.toLowerCase());
    setText('top-area', fmtInt(area) + ' sq ft at ' + val('top-depth', 6) + ' in deep');
    setText('top-sticky', fmt(r.cuYd) + ' yd³ · ' + fmt(r.tons) + ' tons');
    show('top-sticky-bar', true);
  }

  /* --- tile page --- */
  function updateTile() {
    var area = val('tile-length', 10) * val('tile-width', 12);
    var r = tileCalc(area, val('tile-w', 12), val('tile-l', 12), val('tile-waste', 10), val('tile-per-box', 10));
    setText('tile-big', fmtInt(r.boxes) + ' boxes');
    setText('tile-tiles', fmtInt(r.tilesWaste) + ' tiles (with waste)');
    setText('tile-net', fmtInt(r.tiles) + ' tiles before waste');
    setText('tile-area', fmtInt(area) + ' sq ft floor');
    setText('tile-sticky', fmtInt(r.boxes) + ' boxes');
    show('tile-sticky-bar', true);
  }

  /* --- drywall page --- */
  function updateDrywall() {
    var room = drywallRoom(
      val('dry-length', 12), val('dry-width', 12), val('dry-height', 8),
      val('dry-doors', 1), val('dry-windows', 2), checked('dry-ceiling')
    );
    var sheetW = 4;
    var sheetL = parseFloat(($('dry-sheet') && $('dry-sheet').value) || '8');
    var r = drywallCalc(room.wallArea, room.ceilingArea, sheetW, sheetL, val('dry-waste', 10));
    setText('dry-big', fmtInt(r.sheets) + ' sheets');
    setText('dry-area', fmtInt(r.totalArea) + ' sq ft of board');
    setText('dry-screws', fmtInt(r.screws) + ' screws');
    setText('dry-compound', fmtInt(r.compoundGal) + ' gallons');
    setText('dry-tape', fmtInt(r.tapeFt) + ' ft of tape');
    setText('dry-sticky', fmtInt(r.sheets) + ' sheets');
    show('dry-sticky-bar', true);
  }

  /* --- fence page --- */
  function updateFence() {
    var r = fenceCalc(
      val('fence-length', 100), val('fence-height', 6), val('fence-spacing', 8),
      val('fence-picket', 5.5), val('fence-gap', 0), val('fence-waste', 10)
    );
    setText('fence-big', fmtInt(r.posts) + ' posts');
    setText('fence-pickets', fmtInt(r.pickets) + ' pickets');
    setText('fence-rails', fmtInt(r.rails) + ' rails (' + r.railsPerSection + ' per section)');
    setText('fence-concrete', fmtInt(r.concreteBags80) + ' × 80 lb bags');
    setText('fence-sections', fmtInt(r.sections) + ' sections');
    setText('fence-sticky', fmtInt(r.posts) + ' posts · ' + fmtInt(r.pickets) + ' pickets');
    show('fence-sticky-bar', true);
  }

  /* --- deck page --- */
  function updateDeck() {
    var r = deckCalc(
      val('deck-length', 16), val('deck-width', 12),
      val('deck-board', 5.5), val('deck-gap', 0.125), val('deck-joist', 16)
    );
    setText('deck-big', fmtInt(Math.ceil(r.linearFt)) + ' ft');
    setText('deck-area', fmtInt(r.area) + ' sq ft deck');
    setText('deck-joists', fmtInt(r.joistCount) + ' joists (' + fmtInt(r.joistLinearFt) + ' linear ft)');
    setText('deck-screws', fmtInt(r.screws) + ' screws');
    setText('deck-sticky', fmtInt(Math.ceil(r.linearFt)) + ' ft of decking');
    show('deck-sticky-bar', true);
  }

  /* --- flooring page --- */
  var FLOOR_COVERAGE = { laminate: 20, vinyl: 24, hardwood: 20, engineered: 22 };
  function updateFlooring() {
    var area = val('floor-length', 12) * val('floor-width', 15);
    var r = flooringCalc(area, val('floor-per-box', 20), val('floor-waste', 10));
    var orderText = (r.order % 1 === 0 ? fmtInt(r.order) : fmt(r.order)) + ' sq ft';
    setText('floor-big', fmtInt(r.boxes) + ' boxes');
    setText('floor-area', orderText + ' to order');
    setText('floor-order', orderText);
    setText('floor-underlayment', fmtInt(r.underlayment) + ' rolls (100 sq ft each)');
    setText('floor-sticky', fmtInt(r.boxes) + ' boxes');
    show('floor-sticky-bar', true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* Keep the current page's nav pill visible in the scrolling nav. */
    var cur = document.querySelector('nav.main a.current');
    if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    if ($('conc-length')) {
      wire(['conc-mode', 'conc-length', 'conc-width', 'conc-depth', 'conc-hole-dia', 'conc-hole-depth', 'conc-holes', 'conc-waste'], updateConcrete);
    }
    if ($('paint-length')) {
      wire(['paint-length', 'paint-width', 'paint-height', 'paint-doors', 'paint-windows', 'paint-coats', 'paint-ceiling'], updatePaint);
    }
    if ($('mulch-length')) {
      wire(['mulch-length', 'mulch-width', 'mulch-depth', 'mulch-bag'], updateMulch);
    }
    if ($('top-length')) {
      wire(['top-length', 'top-width', 'top-depth', 'top-material'], updateTopsoil);
    }
    if ($('tile-length')) {
      wire(['tile-length', 'tile-width', 'tile-w', 'tile-l', 'tile-waste', 'tile-per-box'], updateTile);
    }
    if ($('dry-length')) {
      wire(['dry-length', 'dry-width', 'dry-height', 'dry-doors', 'dry-windows', 'dry-ceiling', 'dry-sheet', 'dry-waste'], updateDrywall);
    }
    if ($('fence-length')) {
      wire(['fence-length', 'fence-height', 'fence-spacing', 'fence-picket', 'fence-gap', 'fence-waste'], updateFence);
    }
    if ($('deck-length')) {
      wire(['deck-length', 'deck-width', 'deck-board', 'deck-gap', 'deck-joist'], updateDeck);
    }
    if ($('floor-length')) {
      wire(['floor-length', 'floor-width', 'floor-type', 'floor-per-box', 'floor-waste'], updateFlooring);
      var floorType = $('floor-type');
      if (floorType) floorType.addEventListener('change', function () {
        var c = FLOOR_COVERAGE[floorType.value];
        if (c) { var pb = $('floor-per-box'); if (pb) pb.value = c; }
        updateFlooring();
      });
    }
  });
})();
