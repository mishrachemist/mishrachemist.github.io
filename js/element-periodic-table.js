/* ===================== ELEMENT: periodic table posters (7 designs, print-quality download) ===================== */
(function periodicTable() {
  const $ = id => document.getElementById(id);
  if (!$("ptStage")) return;
  // [Z, symbol, name, IUPAC/CIAAW abridged standard atomic weight ("" = none), category, column, row, state at 25 °C, electron configuration]
  const PT = [[1,"H","Hydrogen","1.0080","nm",1,1,"g","1s1"],[2,"He","Helium","4.0026","ng",18,1,"g","1s2"],[3,"Li","Lithium","6.94","am",1,2,"s","[He] 2s1"],[4,"Be","Beryllium","9.0122","ae",2,2,"s","[He] 2s2"],[5,"B","Boron","10.81","md",13,2,"s","[He] 2s2 2p1"],[6,"C","Carbon","12.011","nm",14,2,"s","[He] 2s2 2p2"],[7,"N","Nitrogen","14.007","nm",15,2,"g","[He] 2s2 2p3"],[8,"O","Oxygen","15.999","nm",16,2,"g","[He] 2s2 2p4"],[9,"F","Fluorine","18.998","nm",17,2,"g","[He] 2s2 2p5"],[10,"Ne","Neon","20.180","ng",18,2,"g","[He] 2s2 2p6"],[11,"Na","Sodium","22.990","am",1,3,"s","[Ne] 3s1"],[12,"Mg","Magnesium","24.305","ae",2,3,"s","[Ne] 3s2"],[13,"Al","Aluminium","26.982","pt",13,3,"s","[Ne] 3s2 3p1"],[14,"Si","Silicon","28.085","md",14,3,"s","[Ne] 3s2 3p2"],[15,"P","Phosphorus","30.974","nm",15,3,"s","[Ne] 3s2 3p3"],[16,"S","Sulfur","32.06","nm",16,3,"s","[Ne] 3s2 3p4"],[17,"Cl","Chlorine","35.45","nm",17,3,"g","[Ne] 3s2 3p5"],[18,"Ar","Argon","39.95","ng",18,3,"g","[Ne] 3s2 3p6"],[19,"K","Potassium","39.098","am",1,4,"s","[Ar] 4s1"],[20,"Ca","Calcium","40.078","ae",2,4,"s","[Ar] 4s2"],[21,"Sc","Scandium","44.956","tm",3,4,"s","[Ar] 3d1 4s2"],[22,"Ti","Titanium","47.867","tm",4,4,"s","[Ar] 3d2 4s2"],[23,"V","Vanadium","50.942","tm",5,4,"s","[Ar] 3d3 4s2"],[24,"Cr","Chromium","51.996","tm",6,4,"s","[Ar] 3d5 4s1"],[25,"Mn","Manganese","54.938","tm",7,4,"s","[Ar] 3d5 4s2"],[26,"Fe","Iron","55.845","tm",8,4,"s","[Ar] 3d6 4s2"],[27,"Co","Cobalt","58.933","tm",9,4,"s","[Ar] 3d7 4s2"],[28,"Ni","Nickel","58.693","tm",10,4,"s","[Ar] 3d8 4s2"],[29,"Cu","Copper","63.546","tm",11,4,"s","[Ar] 3d10 4s1"],[30,"Zn","Zinc","65.38","tm",12,4,"s","[Ar] 3d10 4s2"],[31,"Ga","Gallium","69.723","pt",13,4,"s","[Ar] 3d10 4s2 4p1"],[32,"Ge","Germanium","72.630","md",14,4,"s","[Ar] 3d10 4s2 4p2"],[33,"As","Arsenic","74.922","md",15,4,"s","[Ar] 3d10 4s2 4p3"],[34,"Se","Selenium","78.971","nm",16,4,"s","[Ar] 3d10 4s2 4p4"],[35,"Br","Bromine","79.904","nm",17,4,"l","[Ar] 3d10 4s2 4p5"],[36,"Kr","Krypton","83.798","ng",18,4,"g","[Ar] 3d10 4s2 4p6"],[37,"Rb","Rubidium","85.468","am",1,5,"s","[Kr] 5s1"],[38,"Sr","Strontium","87.62","ae",2,5,"s","[Kr] 5s2"],[39,"Y","Yttrium","88.906","tm",3,5,"s","[Kr] 4d1 5s2"],[40,"Zr","Zirconium","91.222","tm",4,5,"s","[Kr] 4d2 5s2"],[41,"Nb","Niobium","92.906","tm",5,5,"s","[Kr] 4d4 5s1"],[42,"Mo","Molybdenum","95.95","tm",6,5,"s","[Kr] 4d5 5s1"],[43,"Tc","Technetium","","tm",7,5,"s","[Kr] 4d5 5s2"],[44,"Ru","Ruthenium","101.07","tm",8,5,"s","[Kr] 4d7 5s1"],[45,"Rh","Rhodium","102.91","tm",9,5,"s","[Kr] 4d8 5s1"],[46,"Pd","Palladium","106.42","tm",10,5,"s","[Kr] 4d10"],[47,"Ag","Silver","107.87","tm",11,5,"s","[Kr] 4d10 5s1"],[48,"Cd","Cadmium","112.41","tm",12,5,"s","[Kr] 4d10 5s2"],[49,"In","Indium","114.82","pt",13,5,"s","[Kr] 4d10 5s2 5p1"],[50,"Sn","Tin","118.71","pt",14,5,"s","[Kr] 4d10 5s2 5p2"],[51,"Sb","Antimony","121.76","md",15,5,"s","[Kr] 4d10 5s2 5p3"],[52,"Te","Tellurium","127.60","md",16,5,"s","[Kr] 4d10 5s2 5p4"],[53,"I","Iodine","126.90","nm",17,5,"s","[Kr] 4d10 5s2 5p5"],[54,"Xe","Xenon","131.29","ng",18,5,"g","[Kr] 4d10 5s2 5p6"],[55,"Cs","Caesium","132.91","am",1,6,"s","[Xe] 6s1"],[56,"Ba","Barium","137.33","ae",2,6,"s","[Xe] 6s2"],[57,"La","Lanthanum","138.91","ln",3,9,"s","[Xe] 5d16s2"],[58,"Ce","Cerium","140.12","ln",4,9,"s","[Xe] 4f1 5d1 6s2"],[59,"Pr","Praseodymium","140.91","ln",5,9,"s","[Xe] 4f3 6s2"],[60,"Nd","Neodymium","144.24","ln",6,9,"s","[Xe] 4f4 6s2"],[61,"Pm","Promethium","","ln",7,9,"s","[Xe] 4f5 6s2"],[62,"Sm","Samarium","150.36","ln",8,9,"s","[Xe] 4f6 6s2"],[63,"Eu","Europium","151.96","ln",9,9,"s","[Xe] 4f7 6s2"],[64,"Gd","Gadolinium","157.25","ln",10,9,"s","[Xe] 4f7 5d1 6s2"],[65,"Tb","Terbium","158.93","ln",11,9,"s","[Xe] 4f9 6s2"],[66,"Dy","Dysprosium","162.50","ln",12,9,"s","[Xe] 4f10 6s2"],[67,"Ho","Holmium","164.93","ln",13,9,"s","[Xe] 4f11 6s2"],[68,"Er","Erbium","167.26","ln",14,9,"s","[Xe] 4f12 6s2"],[69,"Tm","Thulium","168.93","ln",15,9,"s","[Xe] 4f13 6s2"],[70,"Yb","Ytterbium","173.05","ln",16,9,"s","[Xe] 4f14 6s2"],[71,"Lu","Lutetium","174.97","ln",17,9,"s","[Xe] 4f14 5d1 6s2"],[72,"Hf","Hafnium","178.49","tm",4,6,"s","[Xe] 4f14 5d2 6s2"],[73,"Ta","Tantalum","180.95","tm",5,6,"s","[Xe] 4f14 5d3 6s2"],[74,"W","Tungsten","183.84","tm",6,6,"s","[Xe] 4f14 5d4 6s2"],[75,"Re","Rhenium","186.21","tm",7,6,"s","[Xe] 4f14 5d5 6s2"],[76,"Os","Osmium","190.23","tm",8,6,"s","[Xe] 4f14 5d6 6s2"],[77,"Ir","Iridium","192.22","tm",9,6,"s","[Xe] 4f14 5d7 6s2"],[78,"Pt","Platinum","195.08","tm",10,6,"s","[Xe] 4f14 5d9 6s1"],[79,"Au","Gold","196.97","tm",11,6,"s","[Xe] 4f14 5d10 6s1"],[80,"Hg","Mercury","200.59","tm",12,6,"l","[Xe] 4f14 5d10 6s2"],[81,"Tl","Thallium","204.38","pt",13,6,"s","[Xe] 4f14 5d10 6s2 6p1"],[82,"Pb","Lead","207.2","pt",14,6,"s","[Xe] 4f14 5d10 6s2 6p2"],[83,"Bi","Bismuth","208.98","pt",15,6,"s","[Xe] 4f14 5d10 6s2 6p3"],[84,"Po","Polonium","","pt",16,6,"s","[Xe] 4f14 5d10 6s2 6p4"],[85,"At","Astatine","","md",17,6,"s","[Xe] 4f14 5d10 6s2 6p5"],[86,"Rn","Radon","","ng",18,6,"g","[Xe] 4f14 5d10 6s2 6p6"],[87,"Fr","Francium","","am",1,7,"s","[Rn] 7s1"],[88,"Ra","Radium","","ae",2,7,"s","[Rn] 7s2"],[89,"Ac","Actinium","","an",3,10,"s","[Rn] 6d1 7s2"],[90,"Th","Thorium","232.04","an",4,10,"s","[Rn] 6d2 7s2"],[91,"Pa","Protactinium","231.04","an",5,10,"s","[Rn] 5f2 6d1 7s2"],[92,"U","Uranium","238.03","an",6,10,"s","[Rn] 5f3 6d1 7s2"],[93,"Np","Neptunium","","an",7,10,"s","[Rn] 5f4 6d1 7s2"],[94,"Pu","Plutonium","","an",8,10,"s","[Rn] 5f6 7s2"],[95,"Am","Americium","","an",9,10,"s","[Rn] 5f7 7s2"],[96,"Cm","Curium","","an",10,10,"s","[Rn] 5f7 6d1 7s2"],[97,"Bk","Berkelium","","an",11,10,"s","[Rn] 5f9 7s2"],[98,"Cf","Californium","","an",12,10,"s","[Rn] 5f10 7s2"],[99,"Es","Einsteinium","","an",13,10,"s","[Rn] 5f11 7s2"],[100,"Fm","Fermium","","an",14,10,"s","[Rn] 5f12 7s2"],[101,"Md","Mendelevium","","an",15,10,"s","[Rn] 5f13 7s2"],[102,"No","Nobelium","","an",16,10,"s","[Rn] 5f14 7s2"],[103,"Lr","Lawrencium","","an",17,10,"s","[Rn] 5f14 7s2 7p1"],[104,"Rf","Rutherfordium","","tm",4,7,"","[Rn] 5f14 6d2 7s2"],[105,"Db","Dubnium","","tm",5,7,"","[Rn] 5f14 6d3 7s2"],[106,"Sg","Seaborgium","","tm",6,7,"","[Rn] 5f14 6d4 7s2"],[107,"Bh","Bohrium","","tm",7,7,"","[Rn] 5f14 6d5 7s2"],[108,"Hs","Hassium","","tm",8,7,"","[Rn] 5f14 6d6 7s2"],[109,"Mt","Meitnerium","","uk",9,7,"","[Rn] 5f14 6d7 7s2"],[110,"Ds","Darmstadtium","","uk",10,7,"","[Rn] 5f14 6d9 7s1"],[111,"Rg","Roentgenium","","uk",11,7,"","[Rn] 5f14 6d10 7s1"],[112,"Cn","Copernicium","","tm",12,7,"","[Rn] 5f14 6d10 7s2"],[113,"Nh","Nihonium","","uk",13,7,"","[Rn] 5f14 6d10 7s2 7p1"],[114,"Fl","Flerovium","","pt",14,7,"","[Rn] 5f14 6d10 7s2 7p2"],[115,"Mc","Moscovium","","uk",15,7,"","[Rn] 5f14 6d10 7s2 7p3"],[116,"Lv","Livermorium","","uk",16,7,"","[Rn] 5f14 6d10 7s2 7p4"],[117,"Ts","Tennessine","","uk",17,7,"","[Rn] 5f14 6d10 7s2 7p5"],[118,"Og","Oganesson","","uk",18,7,"","[Rn] 5f14 6d10 7s2 7p6"]];
  const CAT = { am: "Alkali metal", ae: "Alkaline earth metal", tm: "Transition metal", pt: "Post-transition metal", md: "Metalloid",
    nm: "Nonmetal", ng: "Noble gas", ln: "Lanthanide", an: "Actinide", uk: "Unknown properties" };
  const CAT_ORDER = ["am", "ae", "tm", "pt", "md", "nm", "ng", "ln", "an", "uk"];
  const STEEL = new Set(["C", "Si", "Mn", "P", "S", "Cr", "Ni", "Mo", "Cu", "Al", "V", "Ti", "Nb", "B", "N", "W", "Co", "Sn", "As", "Pb", "Fe"]);
  const blockOf = e => e[6] >= 9 ? "f" : (e[5] <= 2 || e[0] === 2) ? "s" : e[5] >= 13 ? "p" : "d";
  const conf = e => e[0] > 103 ? "" : String(e[8] || "").replace(/(\d[spdf]\d+)(?=\d[spdf])/g, "$1 ");

  // ---------- geometry (poster units; 3600 x 2250 = 16:10) ----------
  const W = 3600, H = 2250, P = 188, C = 180, GL = 140, GT = 360;
  const cellXY = e => {
    const x = GL + (e[5] - 1) * P;
    const y = e[6] <= 7 ? GT + (e[6] - 1) * P : GT + 7 * P + 44 + (e[6] - 9) * P;
    return [x, y];
  };
  const groupTopRow = g => g === 1 || g === 18 ? 1 : g === 2 || g >= 13 ? 2 : 4;

  // ---------- tiny scene graph with SVG and canvas back-ends ----------
  const mctx = document.createElement("canvas").getContext("2d");
  const FAM = { P: "Poppins, 'Segoe UI', Arial, sans-serif", B: "'Baloo 2', Poppins, Arial, sans-serif" };
  const textW = (s, size, weight, fam) => { mctx.font = `${weight} ${size}px ${FAM[fam || "P"]}`; return mctx.measureText(s).width; };
  const fitSize = (s, size, weight, maxW, fam) => { let z = size; while (z > 8 && textW(s, z, weight, fam) > maxW) z -= 1; return z; };

  function toSVG(sc, uid) {
    const defs = [], glows = {};
    let gi = 0;
    const paint = p => {
      if (!p || typeof p === "string") return p || "none";
      const id = `${uid}g${gi++}`;
      const stops = p.stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ""}/>`).join("");
      defs.push(p.lin ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${p.lin[0]}" y1="${p.lin[1]}" x2="${p.lin[2]}" y2="${p.lin[3]}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${p.rad[0]}" cy="${p.rad[1]}" r="${p.rad[2]}">${stops}</radialGradient>`);
      return `url(#${id})`;
    };
    const glow = g => {
      if (!g) return "";
      const k = g.c + "|" + g.b;
      if (!glows[k]) { glows[k] = `${uid}f${Object.keys(glows).length}`;
        defs.push(`<filter id="${glows[k]}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceGraphic" stdDeviation="${g.b / 2}" result="b"/><feFlood flood-color="${g.c}"/><feComposite in2="b" operator="in" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`); }
      return ` filter="url(#${glows[k]})"`;
    };
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const body = sc.map(o => {
      const op = o.op != null ? ` opacity="${o.op}"` : "";
      if (o.t === "rect") return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.r || 0}" fill="${paint(o.fill)}"${o.stroke ? ` stroke="${paint(o.stroke)}" stroke-width="${o.sw || 1}"` : ""}${op}${glow(o.glow)}/>`;
      if (o.t === "circle") return `<circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="${paint(o.fill)}"${o.stroke ? ` stroke="${paint(o.stroke)}" stroke-width="${o.sw || 1}"` : ""}${op}${glow(o.glow)}/>`;
      if (o.t === "line") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${paint(o.stroke)}" stroke-width="${o.sw || 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${op}/>`;
      if (o.t === "text") return `<text x="${o.x}" y="${o.y}" font-family="${esc(FAM[o.fam || "P"])}" font-size="${o.size}" font-weight="${o.weight || 400}" fill="${paint(o.fill)}" text-anchor="${o.anchor || "start"}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}${op}${glow(o.glow)}>${esc(o.s)}</text>`;
      return "";
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join("")}</defs>${body}</svg>`;
  }
  function toCanvas(sc, scale) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const g = cv.getContext("2d");
    if (!g) return null;
    g.scale(scale, scale);
    const paint = p => {
      if (!p || typeof p === "string") return p || "transparent";
      const gr = p.lin ? g.createLinearGradient(...p.lin) : g.createRadialGradient(p.rad[0], p.rad[1], 0, p.rad[0], p.rad[1], p.rad[2]);
      p.stops.forEach(([o, c, a]) => gr.addColorStop(o, a != null ? hexA(c, a) : c));
      return gr;
    };
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r || 0); else g.rect(x, y, w, h); };
    sc.forEach(o => {
      g.save();
      g.globalAlpha = o.op != null ? o.op : 1;
      if (o.glow) { g.shadowColor = o.glow.c; g.shadowBlur = o.glow.b * scale; }
      if (o.t === "rect") { rr(o.x, o.y, o.w, o.h, o.r); if (o.fill && o.fill !== "none") { g.fillStyle = paint(o.fill); g.fill(); } if (o.stroke) { g.shadowBlur = o.glow ? g.shadowBlur : 0; g.strokeStyle = paint(o.stroke); g.lineWidth = o.sw || 1; g.stroke(); } }
      else if (o.t === "circle") { g.beginPath(); g.arc(o.cx, o.cy, o.r, 0, Math.PI * 2); if (o.fill && o.fill !== "none") { g.fillStyle = paint(o.fill); g.fill(); } if (o.stroke) { g.strokeStyle = paint(o.stroke); g.lineWidth = o.sw || 1; g.stroke(); } }
      else if (o.t === "line") { g.beginPath(); if (o.dash) g.setLineDash(String(o.dash).split(/[ ,]+/).map(Number)); g.moveTo(o.x1, o.y1); g.lineTo(o.x2, o.y2); g.strokeStyle = paint(o.stroke); g.lineWidth = o.sw || 1; g.stroke(); }
      else if (o.t === "text") { g.font = `${o.weight || 400} ${o.size}px ${FAM[o.fam || "P"]}`; g.textAlign = o.anchor === "middle" ? "center" : o.anchor === "end" ? "right" : "left";
        g.textBaseline = "alphabetic"; if ("letterSpacing" in g) g.letterSpacing = (o.ls || 0) + "px"; g.fillStyle = paint(o.fill); g.fillText(o.s, o.x, o.y); }
      g.restore();
    });
    return cv;
  }
  function hexA(c, a) { const h = c.replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

  // ---------- shared poster pieces ----------
  function common(sc, o) {
    // group numbers and period numbers
    for (let gN = 1; gN <= 18; gN++) {
      const x = GL + (gN - 1) * P + C / 2, y = GT + (groupTopRow(gN) - 1) * P - 18;
      sc.push({ t: "text", x, y, s: String(gN), size: 34, weight: 700, fill: o.label, anchor: "middle" });
    }
    for (let p = 1; p <= 7; p++) sc.push({ t: "text", x: GL - 34, y: GT + (p - 1) * P + C / 2 + 12, s: String(p), size: 34, weight: 700, fill: o.label, anchor: "middle" });
    const fy = GT + 7 * P + 44;
    sc.push({ t: "text", x: GL + 2 * P - 22, y: fy + C / 2 + 12, s: "Lanthanides", size: 30, weight: 700, fill: o.label, anchor: "end" });
    sc.push({ t: "text", x: GL + 2 * P - 22, y: fy + P + C / 2 + 12, s: "Actinides", size: 30, weight: 700, fill: o.label, anchor: "end" });
  }
  function title(sc, o) {
    sc.push({ t: "text", x: W / 2, y: 150, s: o.title || "PERIODIC TABLE OF THE ELEMENTS", size: 112, weight: 800, fill: o.titleFill, anchor: "middle", ls: 6, fam: o.titleFam || "P", glow: o.titleGlow });
    sc.push({ t: "text", x: W / 2, y: 232, s: o.sub || coTag("QAD - SMS LABORATORY").toUpperCase(), size: 44, weight: 600, fill: o.subFill, anchor: "middle", ls: 10 });
  }
  function footer(sc, o) {
    sc.push({ t: "text", x: GL, y: H - 58, s: "Atomic weights: IUPAC / CIAAW abridged standard atomic weights. Elements with no standard atomic weight are shown without one.", size: 26, weight: 500, fill: o.foot });
    sc.push({ t: "text", x: W - 94, y: H - 58, s: o.footRight || ("Moltrix" + (COMPANY.name ? "  ·  " + COMPANY.name : "")), size: 26, weight: 600, fill: o.foot, anchor: "end" });
  }
  function placeholders(sc, o) {
    [["57 – 71", 6, "ln"], ["89 – 103", 7, "an"]].forEach(([t, row, k]) => {
      const x = GL + 2 * P, y = GT + (row - 1) * P;
      sc.push({ t: "rect", x, y, w: C, h: C, r: o.r, fill: o.phFill ? o.phFill(k) : "none", stroke: o.phStroke ? o.phStroke(k) : o.label, sw: 3, op: 0.9 });
      sc.push({ t: "text", x: x + C / 2, y: y + C / 2 + 14, s: t, size: 38, weight: 700, fill: o.phText || o.label, anchor: "middle" });
    });
  }
  // area above the transition metals (rows 1-3, columns 3-12)
  const KEY = { x: GL + 2 * P, y: GT, w: 10 * P - 8, h: 3 * P - 8 };
  const LEG_X = KEY.x + 880;
  function legend(sc, o, items, rowH) {   // items: [[colour, label, ring?], ...] in 2 columns, right part of the key area
    const x0 = LEG_X, y0 = KEY.y + 30, colW = 500, rh = rowH || 88;
    items.forEach(([col, lab, ring], i) => {
      const cx = x0 + (i % 2) * colW, cy = y0 + Math.floor(i / 2) * rh;
      sc.push({ t: "rect", x: cx, y: cy, w: 56, h: 56, r: o.lr != null ? o.lr : 12, fill: ring ? "none" : col, stroke: ring ? col : o.legStroke, sw: ring ? 6 : 2 });
      sc.push({ t: "text", x: cx + 74, y: cy + 40, s: lab, size: fitSize(lab, 34, 600, colW - 84), weight: 600, fill: o.legText });
    });
  }
  function keyTile(sc, o, draw) {   // enlarged example tile (Fe) with field names
    const e = PT[25], x = KEY.x + 40, y = KEY.y + 30, s = 2.5;
    draw(sc, e, x, y, s, true);
    const lab = (txt, yy) => sc.push({ t: "text", x: x + C * s + 28, y: yy, s: txt, size: 30, weight: 600, fill: o.legText, op: 0.85 });
    lab("Atomic number", y + 64); lab("Symbol", y + C * s * 0.52); lab("Name", y + C * s * 0.74); lab("Atomic weight", y + C * s * 0.92);
  }

  // ---------- the five designs ----------
  const D = [];

  // 1. Classic colour
  D.push({ id: "classic", name: "Classic Colour", build() {
    const col = { am: "#ffb3a7", ae: "#ffd59a", tm: "#ffe9a8", pt: "#c9e4b5", md: "#a8dcd1", nm: "#a9d4f5", ng: "#d3c4f3", ln: "#f8c6e0", an: "#f5b3c8", uk: "#e3e3e3" };
    const edge = { am: "#e2675a", ae: "#e09a2e", tm: "#c9a227", pt: "#6aa84f", md: "#3c9e8d", nm: "#3d8fd1", ng: "#7d63c7", ln: "#d0679d", an: "#c94d75", uk: "#9a9a9a" };
    const sc = [{ t: "rect", x: 0, y: 0, w: W, h: H, fill: "#ffffff" },
      { t: "rect", x: 0, y: 0, w: W, h: 290, fill: { lin: [0, 0, W, 0], stops: [[0, "#0b2545"], [1, "#1f4f8a"]] } },
      { t: "rect", x: 0, y: 290, w: W, h: 10, fill: "#c9a227" }];
    title(sc, { titleFill: "#ffffff", subFill: "#f1d27a" });
    const o = { label: "#33415c", r: 16, legText: "#1d2b45", legStroke: "#ffffff" };
    const tile = (sc, e, x, y, s = 1) => {
      const k = v => v * s;
      sc.push({ t: "rect", x, y, w: k(C), h: k(C), r: k(16), fill: col[e[4]], stroke: edge[e[4]], sw: k(3) });
      sc.push({ t: "text", x: x + k(16), y: y + k(38), s: String(e[0]), size: k(30), weight: 700, fill: "#1d2b45" });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(100), s: e[1], size: k(74), weight: 800, fill: "#0b2545", anchor: "middle" });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(142), s: e[2], size: k(fitSize(e[2], 24, 600, C - 18)), weight: 600, fill: "#1d2b45", anchor: "middle" });
      if (e[3]) sc.push({ t: "text", x: x + k(C / 2), y: y + k(168), s: e[3], size: k(23), weight: 500, fill: "#33415c", anchor: "middle" });
    };
    common(sc, o); placeholders(sc, { ...o, phFill: k => col[k], phStroke: k => edge[k], phText: "#33415c" });
    PT.forEach(e => { const [x, y] = cellXY(e); tile(sc, e, x, y); });
    keyTile(sc, o, tile);
    legend(sc, o, CAT_ORDER.map(k => [col[k], CAT[k]]));
    footer(sc, { foot: "#5b6780" });
    return sc;
  } });

  // 2. Neon night
  D.push({ id: "neon", name: "Neon Night", build() {
    const neon = { am: "#ff4d6d", ae: "#ff9f1c", tm: "#ffd60a", pt: "#7bf1a8", md: "#2ec4b6", nm: "#4cc9f0", ng: "#b388ff", ln: "#ff6bd6", an: "#f72585", uk: "#9aa5b1" };
    const sc = [{ t: "rect", x: 0, y: 0, w: W, h: H, fill: { rad: [W / 2, H * 0.42, W * 0.75], stops: [[0, "#18204a"], [0.6, "#0a0e24"], [1, "#04050d"]] } }];
    for (let i = 0; i < 140; i++) { const x = (i * 977) % W, y = (i * 613) % H; sc.push({ t: "circle", cx: x, cy: y, r: (i % 3) + 1.2, fill: "#ffffff", op: 0.18 + (i % 5) * 0.05 }); }
    title(sc, { titleFill: { lin: [W / 2 - 1300, 0, W / 2 + 1300, 0], stops: [[0, "#4cc9f0"], [0.5, "#b388ff"], [1, "#ff4d6d"]] }, subFill: "#9fb4ff", titleGlow: { c: "rgba(140,120,255,.8)", b: 26 } });
    const o = { label: "#8ea2d8", r: 20, legText: "#dfe6ff", legStroke: "transparent", lr: 31 };
    const tile = (sc, e, x, y, s = 1) => {
      const k = v => v * s, c = neon[e[4]];
      sc.push({ t: "rect", x, y, w: k(C), h: k(C), r: k(20), fill: hexA(c, 0.08), stroke: c, sw: k(3.5), glow: { c, b: k(16) } });
      sc.push({ t: "text", x: x + k(18), y: y + k(38), s: String(e[0]), size: k(28), weight: 700, fill: c });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(102), s: e[1], size: k(76), weight: 800, fill: "#ffffff", anchor: "middle", glow: { c, b: k(14) } });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(144), s: e[2], size: k(fitSize(e[2], 23, 500, C - 18)), weight: 500, fill: "#dfe6ff", anchor: "middle" });
      if (e[3]) sc.push({ t: "text", x: x + k(C / 2), y: y + k(168), s: e[3], size: k(22), weight: 500, fill: c, anchor: "middle", op: 0.9 });
    };
    common(sc, o); placeholders(sc, { ...o, phStroke: k => neon[k], phText: "#dfe6ff" });
    PT.forEach(e => { const [x, y] = cellXY(e); tile(sc, e, x, y); });
    keyTile(sc, o, tile);
    legend(sc, o, CAT_ORDER.map(k => [neon[k], CAT[k], true]));
    footer(sc, { foot: "#7f8fbf" });
    return sc;
  } });

  // 3. Steel & gold (steel plant)
  D.push({ id: "steel", name: "Steel & Gold", build() {
    const band = { am: "#e4572e", ae: "#f3a712", tm: "#c9a227", pt: "#76b041", md: "#17bebb", nm: "#3a86ff", ng: "#8e7dbe", ln: "#d16ba5", an: "#b5446e", uk: "#8d99ae" };
    const sc = [{ t: "rect", x: 0, y: 0, w: W, h: H, fill: { lin: [0, 0, W, H], stops: [[0, "#2b3036"], [0.5, "#1b1f24"], [1, "#2d3238"]] } }];
    for (let i = 0; i < 60; i++) sc.push({ t: "line", x1: 0, y1: i * 40, x2: W, y2: i * 40 + 6, stroke: "#ffffff", sw: 1, op: 0.025 });
    title(sc, { titleFill: { lin: [0, 60, 0, 170], stops: [[0, "#fff1b8"], [0.5, "#e6b93a"], [1, "#a8780f"]] }, subFill: "#cfd6de" });
    sc.push({ t: "rect", x: W / 2 - 700, y: 262, w: 1400, h: 6, fill: { lin: [W / 2 - 700, 0, W / 2 + 700, 0], stops: [[0, "#c9a227", 0], [0.5, "#f1d27a"], [1, "#c9a227", 0]] } });
    const o = { label: "#c7b27a", r: 10, legText: "#e8e2cf", legStroke: "#5b626b", lr: 8 };
    const tile = (sc, e, x, y, s = 1) => {
      const k = v => v * s, st = STEEL.has(e[1]);
      sc.push({ t: "rect", x, y, w: k(C), h: k(C), r: k(10), fill: { lin: [x, y, x + k(C), y + k(C)], stops: [[0, "#4a5058"], [0.5, "#30353c"], [1, "#3b4148"]] },
        stroke: st ? { lin: [x, y, x + k(C), y + k(C)], stops: [[0, "#fff1b8"], [0.5, "#e6b93a"], [1, "#a8780f"]] } : "#565d66", sw: k(st ? 6 : 2) });
      sc.push({ t: "rect", x: x + k(st ? 6 : 2), y: y + k(st ? 6 : 2), w: k(C - (st ? 12 : 4)), h: k(12), r: k(4), fill: band[e[4]] });
      sc.push({ t: "text", x: x + k(16), y: y + k(52), s: String(e[0]), size: k(28), weight: 700, fill: "#cfd6de" });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(108), s: e[1], size: k(72), weight: 800, fill: st ? "#f3cf63" : "#f2f4f7", anchor: "middle" });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(148), s: e[2], size: k(fitSize(e[2], 23, 500, C - 18)), weight: 500, fill: "#cfd6de", anchor: "middle" });
      if (e[3]) sc.push({ t: "text", x: x + k(C / 2), y: y + k(170), s: e[3], size: k(21), weight: 500, fill: "#9aa4b0", anchor: "middle" });
    };
    common(sc, o); placeholders(sc, { ...o, phStroke: k => band[k], phText: "#e8e2cf" });
    PT.forEach(e => { const [x, y] = cellXY(e); tile(sc, e, x, y); });
    keyTile(sc, o, tile);
    legend(sc, o, CAT_ORDER.slice(0, 9).map(k => [band[k], CAT[k]]).concat([["#e6b93a", "Common in steel", true]]));
    footer(sc, { foot: "#9aa4b0" });
    return sc;
  } });

  // 4. Pastel blocks (s, p, d, f)
  D.push({ id: "pastel", name: "Pastel Blocks", build() {
    const bl = { s: ["#ffd6d6", "#e05c5c"], p: ["#d6ecff", "#3b82c4"], d: ["#fff0c2", "#c9932a"], f: ["#e3dcff", "#7a5cc7"] };
    const sc = [{ t: "rect", x: 0, y: 0, w: W, h: H, fill: "#fbf7f0" },
      { t: "circle", cx: 260, cy: 200, r: 420, fill: "#ffe3d3", op: 0.55 }, { t: "circle", cx: W - 220, cy: H - 160, r: 520, fill: "#dfeeff", op: 0.6 }];
    title(sc, { titleFill: "#2d2a45", subFill: "#8a7f9e", titleFam: "B" });
    const o = { label: "#8a7f9e", r: 30, legText: "#2d2a45", legStroke: "#fbf7f0", lr: 18 };
    const tile = (sc, e, x, y, s = 1) => {
      const k = v => v * s, [bg, ink] = bl[blockOf(e)];
      sc.push({ t: "rect", x: x + k(3), y: y + k(7), w: k(C), h: k(C), r: k(30), fill: ink, op: 0.18 });
      sc.push({ t: "rect", x, y, w: k(C), h: k(C), r: k(30), fill: bg });
      sc.push({ t: "text", x: x + k(C - 18), y: y + k(38), s: String(e[0]), size: k(28), weight: 700, fill: ink, anchor: "end" });
      sc.push({ t: "text", x: x + k(20), y: y + k(104), s: e[1], size: k(78), weight: 800, fill: "#2d2a45", fam: "B" });
      sc.push({ t: "text", x: x + k(20), y: y + k(142), s: e[2], size: k(fitSize(e[2], 23, 600, C - 30)), weight: 600, fill: ink });
      if (e[3]) sc.push({ t: "text", x: x + k(20), y: y + k(168), s: e[3], size: k(21), weight: 500, fill: "#6d6680" });
    };
    common(sc, o); placeholders(sc, { ...o, phFill: () => bl.f[0], phStroke: () => bl.f[1], phText: "#2d2a45" });
    PT.forEach(e => { const [x, y] = cellXY(e); tile(sc, e, x, y); });
    keyTile(sc, o, tile);
    legend(sc, o, [[bl.s[0], "s-block"], [bl.p[0], "p-block"], [bl.d[0], "d-block"], [bl.f[0], "f-block"]]);
    footer(sc, { foot: "#8a7f9e" });
    return sc;
  } });

  // 5. Detailed scientific (state of matter + electron configuration)
  D.push({ id: "detailed", name: "Detailed Scientific", build() {
    const col = { am: "#fde0dc", ae: "#fdeccf", tm: "#fff6cf", pt: "#e1f1d6", md: "#d3efe9", nm: "#dceefc", ng: "#e8e0fa", ln: "#fbe0ee", an: "#f9d7e1", uk: "#eeeeee" };
    const state = { s: "#1b1b1b", l: "#1565c0", g: "#c62828", "": "#8a8a8a" };
    const sc = [{ t: "rect", x: 0, y: 0, w: W, h: H, fill: "#ffffff" }, { t: "rect", x: 30, y: 30, w: W - 60, h: H - 60, r: 18, fill: "none", stroke: "#0b2545", sw: 4 }];
    title(sc, { titleFill: "#0b2545", subFill: "#c9a227" });
    const o = { label: "#0b2545", r: 6, legText: "#1b1b1b", legStroke: "#9aa5b1", lr: 6 };
    const tile = (sc, e, x, y, s = 1) => {
      const k = v => v * s;
      sc.push({ t: "rect", x, y, w: k(C), h: k(C), r: k(6), fill: col[e[4]], stroke: "#4a5568", sw: k(2) });
      sc.push({ t: "text", x: x + k(12), y: y + k(32), s: String(e[0]), size: k(26), weight: 700, fill: "#1b1b1b" });
      if (e[3]) sc.push({ t: "text", x: x + k(C - 10), y: y + k(32), s: e[3], size: k(fitSize(e[3], 20, 500, C - 60)), weight: 500, fill: "#333333", anchor: "end" });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(94), s: e[1], size: k(60), weight: 800, fill: state[e[7] || ""], anchor: "middle" });
      sc.push({ t: "text", x: x + k(C / 2), y: y + k(128), s: e[2], size: k(fitSize(e[2], 22, 600, C - 16)), weight: 600, fill: "#1b1b1b", anchor: "middle" });
      const cf = conf(e);
      if (cf) sc.push({ t: "text", x: x + k(C / 2), y: y + k(158), s: cf, size: k(fitSize(cf, 17, 500, C - 14)), weight: 500, fill: "#4a5568", anchor: "middle" });
    };
    common(sc, o); placeholders(sc, { ...o, phFill: k => col[k], phStroke: () => "#4a5568", phText: "#1b1b1b" });
    PT.forEach(e => { const [x, y] = cellXY(e); tile(sc, e, x, y); });
    const kx = KEY.x + 40, ky = KEY.y + 30, s = 2.5;
    tile(sc, PT[25], kx, ky, s);
    [["Atomic number", 60], ["Atomic weight", 60], ["Symbol", C * s * 0.5], ["Name", C * s * 0.71], ["Electron configuration", C * s * 0.89]].forEach(([t, yy], i) =>
      sc.push({ t: "text", x: kx + C * s + 28, y: ky + (i === 1 ? 104 : yy), s: t, size: 30, weight: 600, fill: "#1b1b1b", op: 0.85 }));
    legend(sc, o, CAT_ORDER.map(k => [col[k], CAT[k]]), 74);
    const sy = KEY.y + 455;
    sc.push({ t: "text", x: LEG_X, y: sy, s: "State at 25 °C:", size: 30, weight: 600, fill: "#1b1b1b" });
    [["Solid", "s"], ["Liquid", "l"], ["Gas", "g"], ["Unknown", ""]].forEach(([t, k], i) => sc.push({ t: "text", x: LEG_X + 250 + i * 190, y: sy, s: t, size: 34, weight: 800, fill: state[k] }));
    footer(sc, { foot: "#4a5568", footRight: "Electron configurations: Periodic-Table-JSON  ·  Moltrix" + (COMPANY.short ? ", " + COMPANY.short : "") });
    return sc;
  } });

  // 6 + 7. "The Periodic Table of the Elements, in Pictures / in Words" by Keith Enevoldsen (elements.wlonk.com),
  // CC BY-SA 4.0. Ready-made files next to index.html in the "pt" folder (vector SVG + high-resolution JPG).
  const ENEV_CREDIT = "© 2005–2016 Keith Enevoldsen, elements.wlonk.com - Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)";
  D.push({ id: "enev-pics", name: "In Pictures (K. Enevoldsen)", file: { thumb: "pt/thumb_pictures.jpg", preview: "pt/preview_pictures.jpg",
    jpg: "pt/Periodic_Table_Pictures.jpg", svg: "pt/Periodic_Table_Pictures.svg", w: 4400, h: 3400 } });
  D.push({ id: "enev-words", name: "In Words (K. Enevoldsen)", file: { thumb: "pt/thumb_words.jpg", preview: "pt/preview_words.jpg",
    jpg: "pt/Periodic_Table_Words.jpg", svg: "pt/Periodic_Table_Words.svg", w: 4400, h: 3400 } });

  // ---------- UI ----------
  let cur = 0;
  try { cur = Math.max(0, D.findIndex(d => d.id === localStorage.getItem("ptDesign"))); } catch (e) {}
  const cache = {};
  const sceneOf = i => cache[i] || (cache[i] = D[i].build());
  const img = (i, w) => { if (D[i].file) return w <= 600 ? D[i].file.thumb : D[i].file.preview;
    const cv = toCanvas(sceneOf(i), w / W); const u = cv ? cv.toDataURL("image/jpeg", 0.9) : ""; if (cv) cv.width = cv.height = 0; return u; };
  function drawThumbs() {
    $("ptThumbs").innerHTML = D.map((d, i) => `<button type="button" class="ptThumb${i === cur ? " sel" : ""}" data-i="${i}"><img alt="" src="${img(i, 480)}"><b>${i + 1}. ${d.name}</b></button>`).join("");
  }
  function show() {
    $("ptStage").innerHTML = `<img alt="${D[cur].name}" src="${img(cur, 2000)}">`;
    $("ptThumbs").querySelectorAll(".ptThumb").forEach(b => b.classList.toggle("sel", +b.dataset.i === cur));
    $("ptName").textContent = `${cur + 1}. ${D[cur].name}`;
    $("ptStatus").textContent = D[cur].file ? ENEV_CREDIT : "";
  }
  let started = false;
  async function start() {
    if (started) return; started = true;
    try { await Promise.all(["400", "500", "600", "700", "800"].map(w => document.fonts.load(`${w} 40px Poppins`)).concat(["700", "800"].map(w => document.fonts.load(`${w} 40px "Baloo 2"`)))); } catch (e) {}
    Object.keys(cache).forEach(k => delete cache[k]);   // re-measure names with the real fonts
    drawThumbs(); show();
    if (typeof enableReportZoom === "function") try { enableReportZoom($("ptStage")); } catch (e) {}
  }
  $("ptThumbs").addEventListener("click", e => { const b = e.target.closest(".ptThumb"); if (!b) return; cur = +b.dataset.i; try { localStorage.setItem("ptDesign", D[cur].id); } catch (x) {} show(); });
  const fname = ext => `Periodic_Table_${D[cur].name.replace(/\W+/g, "_").replace(/^_+|_+$/g, "")}.${ext}`;
  const save = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); };
  const saveUrl = (url, name) => { const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  $("ptSvgBtn").addEventListener("click", () => D[cur].file ? saveUrl(D[cur].file.svg, fname("svg")) : save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + toSVG(sceneOf(cur), "x")], { type: "image/svg+xml" }), fname("svg")));
  $("ptJpgBtn").addEventListener("click", async () => {
    const st = $("ptStatus"), btn = $("ptJpgBtn");
    if (D[cur].file) {   // ready-made print file
      const f = D[cur].file;
      saveUrl(f.jpg, fname("jpg"));
      st.textContent = `✅ ${f.w} × ${f.h} px JPG - prints sharp up to about ${Math.round(f.w / 150)} in wide at 150 dpi. For a bigger banner use the SVG (vector) file.\n${ENEV_CREDIT}`;
      return;
    }
    btn.disabled = true;
    try {
      for (const w of [9600, 7200, 5400, 3600]) {
        st.textContent = `Making the print file (${w} × ${Math.round(w * H / W)} px)...`;
        await new Promise(r => setTimeout(r, 30));
        let cv = null;
        try { cv = toCanvas(sceneOf(cur), w / W); } catch (e) { cv = null; }
        if (!cv) continue;
        const blob = await new Promise(r => { try { cv.toBlob(r, "image/jpeg", 0.95); } catch (e) { r(null); } });
        cv.width = cv.height = 0;
        if (!blob || blob.size < 50000) continue;
        save(blob, fname("jpg"));
        const inch = (w / 150).toFixed(0), ft = (w / 150 / 12).toFixed(1);
        st.textContent = `✅ Saved ${w} × ${Math.round(w * H / W)} px JPG (${(blob.size / 1048576).toFixed(1)} MB) - prints sharp up to about ${inch} in (${ft} ft) wide at 150 dpi; for a bigger flex banner print shops usually use 72-100 dpi, so it goes about twice as wide.`;
        return;
      }
      st.textContent = "⚠️ This device could not make a large picture - please use the SVG (vector) file, or try on a computer.";
    } finally { btn.disabled = false; }
  });
  window.ptStart = start;
})();
