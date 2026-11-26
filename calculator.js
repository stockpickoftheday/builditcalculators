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

  /* ---------- power station ---------- */
  /* A portable power station gives back less than the Wh on its label:
     the inverter and conversion lose about 15%, so we use 85% of the
     rated capacity. In the cold, lithium batteries give up about
     another 20% of usable capacity. Daily use = sum of running watts
     x hours per day over the devices ticked. Days of backup = usable
     energy / daily use. Per-device hours = usable energy / watts. */
  function powerStationCalc(wh, devices, cold) {
    var usable = num(wh) * 0.85;
    if (cold) usable *= 0.8;
    var daily = 0;
    var perDevice = [];
    devices.forEach(function (d) {
      if (!d.checked) return;
      var watts = num(d.watts);
      var use = watts * num(d.hours);
      daily += use;
      perDevice.push({ name: d.name, watts: watts, hours: watts > 0 ? usable / watts : 0 });
    });
    return {
      usable: usable,
      daily: daily,
      days: daily > 0 ? usable / daily : 0,
      perDevice: perDevice
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
    powerStationCalc: powerStationCalc,
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

  /* ---------- unit system: Imperial (US) / Metric ---------- */
  /* The pure functions above all work in US customary units. When the
     Metric toggle is on, metric inputs are converted to imperial at the
     boundary, the same pure functions run, and results are converted
     back to metric for display. Factors are "imperial per one metric". */
  var FT_PER_M = 3.28084;     // 1 m = 3.28084 ft
  var IN_PER_CM = 0.393701;   // 1 cm = 0.393701 in
  var YD_PER_M3 = 1.30795;    // 1 m3 = 1.30795 yd3
  var GAL_PER_L = 0.264172;   // 1 L = 0.264172 gal
  var SQFT_PER_M2 = 10.7639;  // 1 m2 = 10.7639 sq ft
  var CUFT_PER_L = 0.0353147; // 1 L = 0.0353147 cu ft
  var LB_PER_KG = 2.20462;    // 1 kg = 2.20462 lb
  var TON_PER_TONNE = 1.10231;// 1 tonne = 1.10231 US tons
  var M3_PER_CUFT = 0.0283168;// 1 cu ft = 0.0283168 m3

  function isMetric() {
    var sel = document.querySelector('input[name="units"]:checked');
    return !!(sel && sel.value === 'metric');
  }

  /* Read an input and return its value in imperial units.
     `factor` converts one metric unit to imperial; `impFallback` is the
     fallback in imperial units. Works for number inputs and selects. */
  function ival(id, impFallback, factor) {
    var metric = isMetric();
    var fb = metric ? impFallback / factor : impFallback;
    var v = val(id, fb);
    return metric ? v * factor : v;
  }

  /* Metric option sets for the selects whose choices are sizes.
     Imperial options stay in the HTML; these replace them in Metric. */
  var METRIC_SELECT_OPTIONS = {
    'mulch-bag': [[60, '60 litre bags (most common)'], [40, '40 litre bags'], [80, '80 litre bags']],
    'fence-spacing': [[2.4, '2.4 m — standard'], [1.8, '1.8 m — stronger, for wind or heavy boards']],
    'fence-picket': [[14, '150 mm pickets (actually 14 cm wide)'], [9, '100 mm pickets (actually 9 cm wide)']],
    'deck-board': [[14, '140 mm boards (actually 14 cm wide)'], [9, '90 mm boards (actually 9 cm wide)']],
    'deck-joist': [[40, '40 cm on center — standard'], [30, '30 cm on center — stiffer, for diagonal boards']],
    'dry-sheet': [[2.4, '1.2 × 2.4 m (2.9 m²)'], [3.0, '1.2 × 3.0 m (3.6 m²)'], [3.6, '1.2 × 3.6 m (4.3 m²)']]
  };
  var _impOptionsCache = {};

  /* Swap every [data-imp]/[data-met] label or hint, and every sized
     select, between Imperial and Metric text. */
  function applyUnits() {
    var metric = isMetric();
    var els = document.querySelectorAll('[data-imp]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = metric ? els[i].getAttribute('data-met') : els[i].getAttribute('data-imp');
    }
    Object.keys(METRIC_SELECT_OPTIONS).forEach(function (id) {
      var sel = $(id);
      if (!sel) return;
      if (!_impOptionsCache[id]) {
        _impOptionsCache[id] = [];
        for (var j = 0; j < sel.options.length; j++) {
          _impOptionsCache[id].push([sel.options[j].value, sel.options[j].text]);
        }
      }
      var opts = metric ? METRIC_SELECT_OPTIONS[id] : _impOptionsCache[id];
      var idx = sel.selectedIndex;
      sel.innerHTML = '';
      opts.forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o[0];
        opt.text = o[1];
        sel.appendChild(opt);
      });
      sel.selectedIndex = Math.min(idx < 0 ? 0 : idx, opts.length - 1);
    });
  }

  /* Convert the number inputs' values when the toggle flips, so the
     physical project stays the same size. data-dim names the dimension;
     cost inputs (data-dim starting "cost-") convert the opposite way
     because the price is per unit. Values are rounded to 2 decimals. */
  var DIM_FACTOR = {
    'length': FT_PER_M,
    'inch': IN_PER_CM,
    'area': SQFT_PER_M2,
    'cuyd': YD_PER_M3,
    'gal': GAL_PER_L,
    'cost-cuyd': YD_PER_M3,
    'cost-gal': GAL_PER_L,
    'cost-ft': FT_PER_M
  };
  function convertInputValues(toMetric) {
    var inputs = document.querySelectorAll('input[data-dim]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var dim = el.getAttribute('data-dim');
      var f = DIM_FACTOR[dim];
      if (!f) continue;
      var v = parseFloat(el.value);
      if (isNaN(v)) continue;
      var isCost = dim.indexOf('cost-') === 0;
      var nv = isCost
        ? (toMetric ? v * f : v / f)
        : (toMetric ? v / f : v * f);
      el.value = Math.round(nv * 100) / 100;
    }
  }

  /* Wire the units radios: convert the typed values, swap the labels,
     then re-run this page's calculation. */
  function wireUnits(update) {
    var radios = document.querySelectorAll('input[name="units"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () {
        var toMetric = isMetric();
        convertInputValues(toMetric);
        applyUnits();
        update();
      });
    }
  }

  /* Total-cost row: qty is the main quantity in display units, price is
     the cost per that unit. Hidden when the price is empty or 0. */
  function showCost(rowId, totalId, qty, price) {
    var p = num(price, 0);
    if (p > 0 && qty > 0) {
      setText(totalId, money0(qty * p));
      show(rowId, true);
    } else {
      show(rowId, false);
    }
  }

  /* --- concrete page + featured calculator on the home page --- */
  function updateConcrete() {
    var metric = isMetric();
    var mode = ($('conc-mode') && $('conc-mode').value) || 'slab';
    show('conc-slab-fields', mode === 'slab');
    show('conc-post-fields', mode === 'post');
    var waste = val('conc-waste', 10);
    var r, qty, qtyUnit;
    if (mode === 'slab') {
      r = concreteSlab(ival('conc-length', 10, FT_PER_M), ival('conc-width', 10, FT_PER_M), ival('conc-depth', 4, IN_PER_CM), waste);
      qty = metric ? r.cuYdWaste / YD_PER_M3 : r.cuYdWaste;
      qtyUnit = metric ? 'm³' : 'yd³';
      setText('conc-big', fmt(qty) + ' ' + qtyUnit);
      setText('conc-cuft', fmt(metric ? r.cuFtWaste * M3_PER_CUFT : r.cuFtWaste) + (metric ? ' m³' : ' cu ft') + ' (with ' + waste + '% waste)');
      setText('conc-net', fmt(metric ? r.cuYd / YD_PER_M3 : r.cuYd) + ' ' + qtyUnit + ' before waste');
    } else {
      r = concretePostHoles(ival('conc-hole-dia', 12, IN_PER_CM), ival('conc-hole-depth', 24, IN_PER_CM), val('conc-holes', 4));
      qty = metric ? r.cuYd / YD_PER_M3 : r.cuYd;
      qtyUnit = metric ? 'm³' : 'yd³';
      setText('conc-big', fmt(qty) + ' ' + qtyUnit);
      setText('conc-cuft', fmt(metric ? r.cuFt * M3_PER_CUFT : r.cuFt) + (metric ? ' m³' : ' cu ft') + ' total (' + fmt(metric ? r.cuFtPerHole * M3_PER_CUFT : r.cuFtPerHole) + (metric ? ' m³' : ' cu ft') + ' per hole)');
      setText('conc-net', val('conc-holes', 4) + ' holes');
    }
    setText('conc-bags80', fmtInt(r.bags80) + ' bags');
    setText('conc-bags60', fmtInt(r.bags60) + ' bags');
    setText('conc-bags40', fmtInt(r.bags40) + ' bags');
    showCost('conc-cost-row', 'conc-cost-total', qty, val('conc-cost', 0));
  }

  /* --- paint page --- */
  function updatePaint() {
    var metric = isMetric();
    var r = paintRoom(
      ival('paint-length', 12, FT_PER_M), ival('paint-width', 12, FT_PER_M), ival('paint-height', 8, FT_PER_M),
      val('paint-doors', 1), val('paint-windows', 2), val('paint-coats', 2),
      checked('paint-ceiling')
    );
    var gal = metric ? r.gallonsToBuy / GAL_PER_L : r.gallonsToBuy;
    setText('paint-big', fmt(gal) + (metric ? ' L' : ' gal'));
    setText('paint-area', fmtInt(metric ? r.paintable / SQFT_PER_M2 : r.paintable) + (metric ? ' m² to paint' : ' sq ft to paint'));
    setText('paint-exact', fmt(metric ? r.gallons / GAL_PER_L : r.gallons) + (metric ? ' litres exactly' : ' gallons exactly'));
    setText('paint-whole', fmtInt(metric ? Math.ceil(r.gallons / GAL_PER_L) : r.wholeGallons) + (metric ? ' whole litres' : ' whole gallons'));
    showCost('paint-cost-row', 'paint-cost-total', gal, val('paint-cost', 0));
  }

  /* --- mulch page --- */
  function updateMulch() {
    var metric = isMetric();
    var area = ival('mulch-length', 20, FT_PER_M) * ival('mulch-width', 10, FT_PER_M);
    var r = mulchCalc(area, ival('mulch-depth', 3, IN_PER_CM), ival('mulch-bag', 2, CUFT_PER_L));
    var qty = metric ? r.cuYd / YD_PER_M3 : r.cuYd;
    setText('mulch-big', fmt(qty) + (metric ? ' m³' : ' yd³'));
    setText('mulch-cuft', fmt(metric ? r.cuFt * M3_PER_CUFT : r.cuFt) + (metric ? ' m³' : ' cu ft'));
    setText('mulch-bags', fmtInt(r.bags) + ' bags');
    setText('mulch-area', fmtInt(metric ? area / SQFT_PER_M2 : area) + (metric ? ' m² at ' : ' sq ft at ') + val('mulch-depth', 3) + (metric ? ' cm deep' : ' in deep'));
    showCost('mulch-cost-row', 'mulch-cost-total', qty, val('mulch-cost', 0));
  }

  /* --- topsoil / gravel page --- */
  function updateTopsoil() {
    var metric = isMetric();
    var area = ival('top-length', 10, FT_PER_M) * ival('top-width', 10, FT_PER_M);
    var material = ($('top-material') && $('top-material').value) || 'topsoil';
    var r = bulkCalc(area, ival('top-depth', 6, IN_PER_CM), material);
    var label = { topsoil: 'Topsoil', gravel: 'Gravel', sand: 'Sand', mulch: 'Mulch' }[material] || 'Material';
    var qty = metric ? r.cuYd / YD_PER_M3 : r.cuYd;
    setText('top-big', fmt(qty) + (metric ? ' m³' : ' yd³'));
    setText('top-weight', fmtInt(metric ? r.lb / LB_PER_KG : r.lb) + (metric ? ' kg (' : ' lb (') + fmt(metric ? r.tons / TON_PER_TONNE : r.tons) + (metric ? ' tonnes)' : ' tons)'));
    setText('top-cuft', fmt(metric ? r.cuFt * M3_PER_CUFT : r.cuFt) + (metric ? ' m³ of ' : ' cu ft of ') + label.toLowerCase());
    setText('top-area', fmtInt(metric ? area / SQFT_PER_M2 : area) + (metric ? ' m² at ' : ' sq ft at ') + val('top-depth', 6) + (metric ? ' cm deep' : ' in deep'));
    showCost('top-cost-row', 'top-cost-total', qty, val('top-cost', 0));
  }

  /* --- tile page --- */
  function updateTile() {
    var metric = isMetric();
    var area = ival('tile-length', 10, FT_PER_M) * ival('tile-width', 12, FT_PER_M);
    var r = tileCalc(area, ival('tile-w', 12, IN_PER_CM), ival('tile-l', 12, IN_PER_CM), val('tile-waste', 10), val('tile-per-box', 10));
    setText('tile-big', fmtInt(r.boxes) + ' boxes');
    setText('tile-tiles', fmtInt(r.tilesWaste) + ' tiles (with waste)');
    setText('tile-net', fmtInt(r.tiles) + ' tiles before waste');
    setText('tile-area', fmtInt(metric ? area / SQFT_PER_M2 : area) + (metric ? ' m² floor' : ' sq ft floor'));
    showCost('tile-cost-row', 'tile-cost-total', r.boxes, val('tile-cost', 0));
  }

  /* --- drywall page --- */
  function updateDrywall() {
    var metric = isMetric();
    var room = drywallRoom(
      ival('dry-length', 12, FT_PER_M), ival('dry-width', 12, FT_PER_M), ival('dry-height', 8, FT_PER_M),
      val('dry-doors', 1), val('dry-windows', 2), checked('dry-ceiling')
    );
    var sheetW = metric ? 1.2 * FT_PER_M : 4;
    var sheetL = ival('dry-sheet', 8, FT_PER_M);
    var r = drywallCalc(room.wallArea, room.ceilingArea, sheetW, sheetL, val('dry-waste', 10));
    setText('dry-big', fmtInt(r.sheets) + ' sheets');
    setText('dry-area', fmtInt(metric ? r.totalArea / SQFT_PER_M2 : r.totalArea) + (metric ? ' m² of board' : ' sq ft of board'));
    setText('dry-screws', fmtInt(r.screws) + ' screws');
    setText('dry-compound', fmtInt(metric ? r.compoundGal / GAL_PER_L : r.compoundGal) + (metric ? ' litres' : ' gallons'));
    setText('dry-tape', fmtInt(metric ? r.tapeFt / FT_PER_M : r.tapeFt) + (metric ? ' m of tape' : ' ft of tape'));
    showCost('dry-cost-row', 'dry-cost-total', r.sheets, val('dry-cost', 0));
  }

  /* --- fence page --- */
  function updateFence() {
    var metric = isMetric();
    var lengthFt = ival('fence-length', 100, FT_PER_M);
    var r = fenceCalc(
      lengthFt, ival('fence-height', 6, FT_PER_M), ival('fence-spacing', 8, FT_PER_M),
      ival('fence-picket', 5.5, IN_PER_CM), ival('fence-gap', 0, IN_PER_CM), val('fence-waste', 10)
    );
    setText('fence-big', fmtInt(r.posts) + ' posts');
    setText('fence-pickets', fmtInt(r.pickets) + ' pickets');
    setText('fence-rails', fmtInt(r.rails) + ' rails (' + r.railsPerSection + ' per section)');
    setText('fence-concrete', fmtInt(r.concreteBags80) + ' × 80 lb bags');
    setText('fence-sections', fmtInt(r.sections) + ' sections');
    var lenDisplay = metric ? lengthFt / FT_PER_M : lengthFt;
    showCost('fence-cost-row', 'fence-cost-total', lenDisplay, val('fence-cost', 0));
  }

  /* --- deck page --- */
  function updateDeck() {
    var metric = isMetric();
    var r = deckCalc(
      ival('deck-length', 16, FT_PER_M), ival('deck-width', 12, FT_PER_M),
      ival('deck-board', 5.5, IN_PER_CM), ival('deck-gap', 0.125, IN_PER_CM), ival('deck-joist', 16, IN_PER_CM)
    );
    var linDisplay = metric ? Math.ceil(r.linearFt / FT_PER_M) : Math.ceil(r.linearFt);
    setText('deck-big', fmtInt(linDisplay) + (metric ? ' m' : ' ft'));
    setText('deck-area', fmtInt(metric ? r.area / SQFT_PER_M2 : r.area) + (metric ? ' m² deck' : ' sq ft deck'));
    setText('deck-joists', fmtInt(r.joistCount) + ' joists (' + fmtInt(metric ? r.joistLinearFt / FT_PER_M : r.joistLinearFt) + (metric ? ' m' : ' linear ft') + ')');
    setText('deck-screws', fmtInt(r.screws) + ' screws');
    showCost('deck-cost-row', 'deck-cost-total', linDisplay, val('deck-cost', 0));
  }

  /* --- flooring page --- */
  var FLOOR_COVERAGE = { laminate: 20, vinyl: 24, hardwood: 20, engineered: 22 };
  var FLOOR_COVERAGE_M = { laminate: 1.86, vinyl: 2.23, hardwood: 1.86, engineered: 2.04 };
  function updateFlooring() {
    var metric = isMetric();
    var area = ival('floor-length', 12, FT_PER_M) * ival('floor-width', 15, FT_PER_M);
    var r = flooringCalc(area, ival('floor-per-box', 20, SQFT_PER_M2), val('floor-waste', 10));
    var orderDisplay = metric ? r.order / SQFT_PER_M2 : r.order;
    var orderText = (orderDisplay % 1 === 0 ? fmtInt(orderDisplay) : fmt(orderDisplay)) + (metric ? ' m²' : ' sq ft');
    setText('floor-big', fmtInt(r.boxes) + ' boxes');
    setText('floor-area', orderText + ' to order');
    setText('floor-order', orderText);
    setText('floor-underlayment', fmtInt(r.underlayment) + ' rolls (' + (metric ? '9.3 m²' : '100 sq ft') + ' each)');
    showCost('floor-cost-row', 'floor-cost-total', r.boxes, val('floor-cost', 0));
  }

  /* --- power station page --- */
  /* Device list: key + display name. Watts and hours are read from the
     page inputs (ps-w-<key>, ps-h-<key>), so the buyer can change them. */
  var PS_DEVICES = [
    { key: 'phone', name: 'Phone charger' },
    { key: 'laptop', name: 'Laptop' },
    { key: 'router', name: 'Wi-Fi router' },
    { key: 'light', name: 'LED light' },
    { key: 'fan', name: 'Small fan' },
    { key: 'minifridge', name: 'Mini fridge' },
    { key: 'fridge', name: 'Full-size fridge' },
    { key: 'tv', name: 'TV' },
    { key: 'cpap', name: 'CPAP machine' },
    { key: 'microwave', name: 'Microwave' },
    { key: 'heater', name: 'Space heater' },
    { key: 'kettle', name: 'Kettle' }
  ];
  function updatePowerStation() {
    var devices = PS_DEVICES.map(function (d) {
      return {
        name: d.name,
        watts: val('ps-w-' + d.key, 0),
        hours: val('ps-h-' + d.key, 0),
        checked: checked('ps-on-' + d.key)
      };
    });
    var r = powerStationCalc(val('ps-wh', 1024), devices, checked('ps-cold'));
    var body = $('ps-per-device');
    if (r.daily <= 0) {
      setText('ps-big', '—');
      setText('ps-big-sub', 'Tick at least one device above to see how long your station lasts.');
      setText('ps-usable', '—');
      setText('ps-daily', '—');
      setText('ps-needed', '—');
      if (body) body.innerHTML = '<tr><td colspan="2">No devices ticked yet.</td></tr>';
      return;
    }
    var days = r.days;
    setText('ps-big', fmt(days, 1) + ' days');
    setText('ps-big-sub', 'about ' + Math.round(days * 24) + ' hours');
    setText('ps-usable', fmtInt(r.usable) + ' Wh');
    setText('ps-daily', fmtInt(r.daily) + ' Wh per day');
    var want = val('ps-days', 1);
    setText('ps-needed', String(Math.ceil(r.daily * want / 0.85)) + ' Wh');
    if (body) {
      var html = '';
      r.perDevice.forEach(function (d) {
        html += '<tr><td>' + d.name + '</td><td>' + fmt(d.hours, 1) + ' hours</td></tr>';
      });
      body.innerHTML = html;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* Keep the current page's nav pill visible in the scrolling nav. */
    var cur = document.querySelector('nav.main a.current');
    if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    applyUnits();
    if ($('conc-length')) {
      wire(['conc-mode', 'conc-length', 'conc-width', 'conc-depth', 'conc-hole-dia', 'conc-hole-depth', 'conc-holes', 'conc-waste', 'conc-cost'], updateConcrete);
      wireUnits(updateConcrete);
    }
    if ($('paint-length')) {
      wire(['paint-length', 'paint-width', 'paint-height', 'paint-doors', 'paint-windows', 'paint-coats', 'paint-ceiling', 'paint-cost'], updatePaint);
      wireUnits(updatePaint);
    }
    if ($('mulch-length')) {
      wire(['mulch-length', 'mulch-width', 'mulch-depth', 'mulch-bag', 'mulch-cost'], updateMulch);
      wireUnits(updateMulch);
    }
    if ($('top-length')) {
      wire(['top-length', 'top-width', 'top-depth', 'top-material', 'top-cost'], updateTopsoil);
      wireUnits(updateTopsoil);
    }
    if ($('tile-length')) {
      wire(['tile-length', 'tile-width', 'tile-w', 'tile-l', 'tile-waste', 'tile-per-box', 'tile-cost'], updateTile);
      wireUnits(updateTile);
    }
    if ($('dry-length')) {
      wire(['dry-length', 'dry-width', 'dry-height', 'dry-doors', 'dry-windows', 'dry-ceiling', 'dry-sheet', 'dry-waste', 'dry-cost'], updateDrywall);
      wireUnits(updateDrywall);
    }
    if ($('fence-length')) {
      wire(['fence-length', 'fence-height', 'fence-spacing', 'fence-picket', 'fence-gap', 'fence-waste', 'fence-cost'], updateFence);
      wireUnits(updateFence);
    }
    if ($('deck-length')) {
      wire(['deck-length', 'deck-width', 'deck-board', 'deck-gap', 'deck-joist', 'deck-cost'], updateDeck);
      wireUnits(updateDeck);
    }
    if ($('floor-length')) {
      wire(['floor-length', 'floor-width', 'floor-type', 'floor-per-box', 'floor-waste', 'floor-cost'], updateFlooring);
      wireUnits(updateFlooring);
      var floorType = $('floor-type');
      if (floorType) floorType.addEventListener('change', function () {
        var c = isMetric() ? FLOOR_COVERAGE_M[floorType.value] : FLOOR_COVERAGE[floorType.value];
        if (c) { var pb = $('floor-per-box'); if (pb) pb.value = c; }
        updateFlooring();
      });
    }
    if ($('ps-wh')) {
      var psInputs = ['ps-wh', 'ps-cold', 'ps-days'];
      PS_DEVICES.forEach(function (d) {
        psInputs.push('ps-on-' + d.key, 'ps-w-' + d.key, 'ps-h-' + d.key);
      });
      wire(psInputs, updatePowerStation);
    }
  });
})();
