/* ===================== SOLUTION PREPARATION: normality / molarity calculator ===================== */
(function solCalc() {
  const $ = id => document.getElementById(id);
  if (!$("scFormula")) return;
  // IUPAC / CIAAW abridged standard atomic weights (ciaaw.org)
  const AW = { H: 1.0080, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
    Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.95, K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938,
    Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468,
    Sr: 87.62, Y: 88.906, Zr: 91.222, Nb: 92.906, Mo: 95.95, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71,
    Sb: 121.76, Te: 127.60, I: 126.90, Xe: 131.29, Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24, Sm: 150.36, Eu: 151.96,
    Gd: 157.25, Tb: 158.93, Dy: 162.50, Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05, Lu: 174.97, Hf: 178.49, Ta: 180.95, W: 183.84, Re: 186.21,
    Os: 190.23, Ir: 192.22, Pt: 195.08, Au: 196.97, Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98, Th: 232.04, Pa: 231.04, U: 238.03 };

  // Common lab reagents: n-factor (equivalents per mole) with the reaction it assumes,
  // and for concentrated liquids a typical assay / density (commercial acids & bases table) - always check the bottle label.
  const KNOWN = [
    ["HCl", "Hydrochloric acid", 1, "acid: 1 replaceable H+", { assay: 36, dens: 1.18 }],
    ["H2SO4", "Sulphuric acid", 2, "acid: 2 replaceable H+", { assay: 96, dens: 1.84 }],
    ["HNO3", "Nitric acid", 1, "acid: 1 replaceable H+", { assay: 71, dens: 1.42 }],
    ["H3PO4", "Phosphoric acid", 3, "acid: 3 H+ (full neutralisation; to phenolphthalein end point it is 2)", { assay: 85, dens: 1.70 }],
    ["HClO4", "Perchloric acid", 1, "acid: 1 replaceable H+", { assay: 70, dens: 1.67 }],
    ["CH3COOH", "Acetic acid (glacial)", 1, "acid: 1 replaceable H+", { assay: 99.5, dens: 1.05 }],
    ["NH3", "Ammonia solution", 1, "base: 1 OH- (assay is % NH3)", { assay: 28, dens: 0.90 }],
    ["NH4OH", "Ammonia solution", 1, "base: 1 OH- (assay is % NH3)", { assay: 28, dens: 0.90, as: "NH3" }],
    ["NaOH", "Sodium hydroxide", 1, "base: 1 OH-"], ["KOH", "Potassium hydroxide", 1, "base: 1 OH-"],
    ["Ca(OH)2", "Calcium hydroxide", 2, "base: 2 OH-"], ["Ba(OH)2", "Barium hydroxide", 2, "base: 2 OH-"],
    ["Na2CO3", "Sodium carbonate", 2, "base: CO3 2- takes 2 H+ (methyl orange end point)"],
    ["H2C2O4.2H2O", "Oxalic acid dihydrate", 2, "acid: 2 H+ / redox: C2O4 2- gives 2 e-"], ["Na2C2O4", "Sodium oxalate", 2, "redox: C2O4 2- gives 2 e-"],
    ["KMnO4", "Potassium permanganate", 5, "redox in acid medium: MnO4- + 5 e- -> Mn2+"],
    ["K2Cr2O7", "Potassium dichromate", 6, "redox in acid medium: Cr2O7 2- + 6 e- -> 2 Cr3+"],
    ["Na2S2O3.5H2O", "Sodium thiosulphate pentahydrate", 1, "redox with iodine: 1 e- per S2O3 2-"], ["Na2S2O3", "Sodium thiosulphate", 1, "redox with iodine: 1 e- per S2O3 2-"],
    ["(NH4)2Fe(SO4)2.6H2O", "Ferrous ammonium sulphate (Mohr's salt)", 1, "redox: Fe2+ -> Fe3+ (1 e-)"], ["FeSO4.7H2O", "Ferrous sulphate heptahydrate", 1, "redox: Fe2+ -> Fe3+ (1 e-)"],
    ["I2", "Iodine", 2, "redox: I2 + 2 e- -> 2 I-"], ["KIO3", "Potassium iodate", 6, "redox (iodometry): IO3- + 6 e- -> I-"], ["KBrO3", "Potassium bromate", 6, "redox: BrO3- + 6 e- -> Br-"],
    ["AgNO3", "Silver nitrate", 1, "precipitation: 1 Ag+"], ["NaCl", "Sodium chloride", 1, "precipitation: 1 Cl-"], ["KCl", "Potassium chloride", 1, "precipitation: 1 Cl-"],
    ["BaCl2.2H2O", "Barium chloride dihydrate", 2, "precipitation: Ba2+ (charge 2)"], ["KSCN", "Potassium thiocyanate", 1, "precipitation: 1 SCN-"], ["NH4SCN", "Ammonium thiocyanate", 1, "precipitation: 1 SCN-"]
  ];
  const norm = f => String(f || "").replace(/\s+/g, "").replace(/[·•∙*]/g, ".");
  const known = f => KNOWN.find(k => norm(k[0]).toLowerCase() === norm(f).toLowerCase());

  function parse(formula) {
    const s = norm(formula);
    if (!s) throw new Error("Enter a formula");
    const total = {};
    s.split(".").filter(Boolean).forEach(part => {
      const m = /^(\d+)(?=[A-Z(\[])/.exec(part);
      const mult = m ? parseInt(m[1], 10) : 1;
      const body = m ? part.slice(m[1].length) : part;
      const stack = [{}];
      let i = 0;
      const num = () => { const r = /^\d+/.exec(body.slice(i)); if (!r) return 1; i += r[0].length; return parseInt(r[0], 10); };
      while (i < body.length) {
        const ch = body[i];
        if (ch === "(" || ch === "[") { stack.push({}); i++; }
        else if (ch === ")" || ch === "]") {
          if (stack.length < 2) throw new Error("Bracket does not match");
          i++; const n = num(), top = stack.pop(), cur = stack[stack.length - 1];
          Object.keys(top).forEach(e => { cur[e] = (cur[e] || 0) + top[e] * n; });
        } else if (/[A-Z]/.test(ch)) {
          const el = /^[A-Z][a-z]?/.exec(body.slice(i))[0];
          if (!(el in AW)) throw new Error(`"${el}" is not an element symbol (capital first letter: Co = cobalt, CO = carbon + oxygen)`);
          i += el.length; const n = num(), cur = stack[stack.length - 1]; cur[el] = (cur[el] || 0) + n;
        } else throw new Error(`Can't read "${ch}" in the formula`);
      }
      if (stack.length !== 1) throw new Error("Bracket is not closed");
      Object.keys(stack[0]).forEach(e => { total[e] = (total[e] || 0) + stack[0][e] * mult; });
    });
    let M = 0; Object.keys(total).forEach(e => { M += AW[e] * total[e]; });
    return { atoms: total, M };
  }

  const f = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  let lastFormula = "";

  function applyKnown() {
    const k = known($("scFormula").value);
    $("scName").textContent = k ? k[1] : "";
    if (!k) {
      $("scNHint").textContent = "Not in the app's list - enter the n-factor (H+ / OH- / electrons / charge per formula unit).";
      $("scN").value = ""; $("scForm").value = "solid"; $("scAssay").value = ""; $("scDens").value = "";
      return;
    }
    $("scN").value = k[2];
    $("scNHint").textContent = "Assumed: " + k[3] + ". Change it if your reaction is different.";
    const liq = !!k[4];
    $("scForm").value = liq ? "liquid" : "solid";
    if (liq) { $("scAssay").value = k[4].assay; $("scDens").value = k[4].dens; }
    else { $("scPurity").value = $("scPurity").value || 100; }
  }
  function calc() {
    const out = $("scResult");
    const formula = $("scFormula").value;
    if (norm(formula) !== lastFormula) { lastFormula = norm(formula); applyKnown(); }
    const isN = $("scMode").value === "N";
    $("scNWrap").classList.toggle("hidden", !isN);
    const liquid = $("scForm").value === "liquid";
    $("scSolidWrap").classList.toggle("hidden", liquid);
    $("scLiquidWrap").classList.toggle("hidden", !liquid);
    $("scStrengthLbl").textContent = isN ? "Normality (N)" : "Molarity (M)";
    let p;
    try { p = parse(formula); } catch (e) { out.innerHTML = formula.trim() ? `<div class="scErr">⚠️ ${esc(e.message)}</div>` : ""; return; }
    const C = parseFloat($("scStrength").value), V = parseFloat($("scVol").value), n = parseFloat($("scN").value);
    const comp = Object.keys(p.atoms).map(e => `${e}${p.atoms[e] > 1 ? "<sub>" + p.atoms[e] + "</sub>" : ""} ${f(AW[e] * p.atoms[e], 3)}`).join(" + ");
    let html = `<div class="scMM">Molar mass of <b>${esc(norm(formula))}</b> = <b>${f(p.M, 3)} g/mol</b><br><small>${comp}</small></div>`;
    if (!(C > 0) || !(V > 0) || (isN && !(n > 0))) { out.innerHTML = html + `<div class="scErr">Enter the strength${isN ? ", n-factor" : ""} and volume.</div>`; return; }
    const eqW = isN ? p.M / n : p.M;
    const k = known(formula), basis = liquid && k && k[4] && k[4].as ? parse(k[4].as) : null;
    const gPure = C * (basis ? (isN ? basis.M / n : basis.M) : eqW) * V / 1000;   // grams of pure substance
    if (isN) html += `<div class="scStep">Equivalent weight = ${f(p.M, 3)} ÷ ${n} = <b>${f(eqW, 3)} g</b></div>`;
    if (!liquid) {
      const pur = parseFloat($("scPurity").value) || 100;
      const w = gPure * 100 / pur;
      html += `<div class="scStep">Weight = ${C} ${isN ? "N × " + f(eqW, 3) : "M × " + f(p.M, 3)} × ${V} ml ÷ 1000${pur !== 100 ? ` × 100 ÷ ${pur}% purity` : ""}</div>
        <div class="scBig"><span>⚖️ Weigh</span><b>${f(w, 4)} g</b><small>of ${esc(norm(formula))}</small></div>
        <div class="scBig water"><span>💧 Distilled water</span><b>make up to ${V} ml</b><small>dissolve in about ${Math.round(V * 0.6)} ml first, then fill to the ${V} ml mark of the volumetric flask</small></div>`;
    } else {
      const as = parseFloat($("scAssay").value), d = parseFloat($("scDens").value);
      if (!(as > 0) || !(d > 0)) { out.innerHTML = html + `<div class="scErr">Enter the assay % and density from the bottle label.</div>`; return; }
      const ml = gPure / (d * as / 100);
      const stockC = d * as / 100 * 1000 / (basis ? basis.M : p.M) * (isN ? n : 1);
      html += `<div class="scStep">Pure ${esc(basis ? k[4].as : norm(formula))} needed = ${f(gPure, 4)} g · bottle strength ≈ ${f(stockC, 2)} ${isN ? "N" : "M"} (${as}% , ${d} g/ml)</div>
        <div class="scBig"><span>🧪 Measure</span><b>${f(ml, 2)} ml</b><small>of concentrated ${esc(k ? k[1].toLowerCase() : norm(formula))} (= ${f(ml * d, 3)} g)</small></div>
        <div class="scBig water"><span>💧 Distilled water</span><b>about ${f(Math.max(V - ml, 0), 1)} ml</b><small>final volume: make up to the ${V} ml mark (volumes are not exactly additive)</small></div>` +
        (/^H2SO4$/i.test(norm(formula)) || /HClO4|HNO3|HCl/i.test(norm(formula)) ? `<div class="scWarn">⚠️ Add the acid slowly to the water (never water into acid), stir and let it cool before making up to the mark.</div>` : "");
    }
    out.innerHTML = html;
    try { localStorage.setItem("solCalcLast", JSON.stringify({ f: formula, m: $("scMode").value, c: $("scStrength").value, v: $("scVol").value, n: $("scN").value, form: $("scForm").value, pur: $("scPurity").value, as: $("scAssay").value, d: $("scDens").value })); } catch (e) {}
  }

  // quick picks
  $("scChips").innerHTML = ["HCl", "H2SO4", "HNO3", "NaOH", "KMnO4", "K2Cr2O7", "Na2S2O3.5H2O", "(NH4)2Fe(SO4)2.6H2O", "AgNO3", "H2C2O4.2H2O"]
    .map(x => `<button type="button" class="scChip" data-f="${esc(x)}">${esc(x)}</button>`).join("");
  $("scChips").addEventListener("click", e => { const b = e.target.closest(".scChip"); if (!b) return; $("scFormula").value = b.dataset.f; lastFormula = ""; calc(); });
  ["scFormula", "scMode", "scStrength", "scVol", "scN", "scForm", "scPurity", "scAssay", "scDens"].forEach(id => $(id).addEventListener("input", calc));
  $("scForm").addEventListener("change", () => { const k = known($("scFormula").value); if ($("scForm").value === "liquid" && !(k && k[4])) { $("scAssay").value = $("scAssay").value || ""; } calc(); });
  try {
    const s = JSON.parse(localStorage.getItem("solCalcLast") || "null");
    if (s) { $("scFormula").value = s.f || ""; lastFormula = norm(s.f); $("scMode").value = s.m || "N"; $("scStrength").value = s.c || ""; $("scVol").value = s.v || 1000; $("scN").value = s.n || "";
      $("scForm").value = s.form || "solid"; $("scPurity").value = s.pur || 100; $("scAssay").value = s.as || ""; $("scDens").value = s.d || "";
      const k = known(s.f); $("scName").textContent = k ? k[1] : ""; $("scNHint").textContent = k ? "Assumed: " + k[3] + ". Change it if your reaction is different." : ""; }
  } catch (e) {}
  calc();
  window.solCalcParse = parse;
})();
