/* ===================== ELEMENT: QAD safety posters (10, bilingual, print quality) ===================== */
(function safetyPosters() {
  const $ = id => document.getElementById(id);
  if (!$("spStage")) return;
  const ICON = {"arrows-sort":"M3 9l4 -4l4 4m-4 -4v14 M21 15l-4 4l-4 -4m4 4v-14","bell-ringing":"M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6 M9 17v1a3 3 0 0 0 6 0v-1 M21 6.727a11.05 11.05 0 0 0 -2.794 -3.727 M3 6.727a11.05 11.05 0 0 1 2.792 -3.727","bolt":"M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11","bottle":"M10 5h4v-2a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v2z M14 3.5c0 1.626 .507 3.212 1.45 4.537l.05 .07a8.093 8.093 0 0 1 1.5 4.694v6.199a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-6.2c0 -1.682 .524 -3.322 1.5 -4.693l.05 -.07a7.823 7.823 0 0 0 1.45 -4.537 M7 14.803a2.4 2.4 0 0 0 1 -.803a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 1 -.805","box":"M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5 M12 12l8 -4.5 M12 12l0 9 M12 12l-8 -4.5","bucket":"M12 7m-8 0a8 4 0 1 0 16 0a8 4 0 1 0 -16 0 M4 7c0 .664 .088 1.324 .263 1.965l2.737 10.035c.5 1.5 2.239 2 5 2s4.5 -.5 5 -2c.333 -1 1.246 -4.345 2.737 -10.035a7.45 7.45 0 0 0 .263 -1.965","building-warehouse":"M3 21v-13l9 -4l9 4v13 M13 13h4v8h-10v-6h6 M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3","calendar-check":"M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6 M16 3v4 M8 3v4 M4 11h16 M15 19l2 2l4 -4","clipboard-check":"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2 M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z M9 14l2 2l4 -4","clock":"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0 M12 7v5l3 3","cylinder":"M12 6m-7 0a7 3 0 1 0 14 0a7 3 0 1 0 -14 0 M5 6v12c0 1.657 3.134 3 7 3s7 -1.343 7 -3v-12","door":"M14 12v.01 M3 21h18 M6 21v-16a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16","droplet":"M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546z","droplet-off":"M18.963 14.938a6.54 6.54 0 0 0 -.899 -4.06l-4.89 -7.26c-.42 -.626 -1.287 -.804 -1.936 -.398a1.376 1.376 0 0 0 -.41 .397l-1.282 1.9m-1.625 2.415l-1.986 2.946c-1.695 2.837 -1.035 6.44 1.567 8.545c2.602 2.105 6.395 2.105 8.996 0a6.83 6.83 0 0 0 1.376 -1.499 M3 3l18 18","ear":"M6 10a7 7 0 1 1 13 3.6a10 10 0 0 1 -2 2a8 8 0 0 0 -2 3a4.5 4.5 0 0 1 -6.8 1.4 M10 10a3 3 0 1 1 5 2.2","eye":"M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0 M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6","eyeglass-2":"M8 4h-2l-3 10v2.5 M16 4h2l3 10v2.5 M10 16l4 0 M17.5 16.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0 M6.5 16.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0","file-text":"M14 3v4a1 1 0 0 0 1 1h4 M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z M9 9l1 0 M9 13l6 0 M9 17l6 0","fire-extinguisher":"M12 7a4 4 0 0 1 4 4v9a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-9a4 4 0 0 1 4 -4z M9 16h6 M12 7v-3 M16 5l-4 -1l4 -1 M12 4h-3a3 3 0 0 0 -3 3","first-aid-kit":"M8 8v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2 M4 8m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M10 14h4 M12 12v4","flame":"M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 3 -4 2z","flame-off":"M8.973 8.974c-.335 .378 -.67 .716 -.973 1.026c-1.226 1.26 -2 3.24 -2 5a6 6 0 0 0 11.472 2.466m.383 -3.597c-.32 -1.409 -1.122 -3.045 -1.855 -3.869c-.281 .472 -.543 .87 -.79 1.202m-2.358 -2.35c-.068 -2.157 -1.182 -4.184 -1.852 -4.852c0 .968 -.18 1.801 -.465 2.527 M3 3l18 18","flask":"M9 3l6 0 M10 9l4 0 M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6","fountain":"M9 16v-5a2 2 0 1 0 -4 0 M15 16v-5a2 2 0 1 1 4 0 M12 16v-10a3 3 0 0 1 6 0 M6 6a3 3 0 0 1 6 0 M3 16h18v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2z","gauge":"M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M13.41 10.59l2.59 -2.59 M7 12a5 5 0 0 1 5 -5","hand-grab":"M8 11v-3.5a1.5 1.5 0 0 1 3 0v2.5 M11 9.5v-3a1.5 1.5 0 0 1 3 0v3.5 M14 7.5a1.5 1.5 0 0 1 3 0v2.5 M17 9.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47","hand-off":"M3 3l18 18 M8 13.5v-5.5m.44 -3.562a1.5 1.5 0 0 1 2.56 1.062v1.5m0 4.008v.992m0 -6.5v-2a1.5 1.5 0 1 1 3 0v6.5m0 -4.5a1.5 1.5 0 0 1 3 0v6.5m0 -4.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2c-2.114 -.292 -3.956 -1.397 -5 -3l-2.7 -5.25a1.7 1.7 0 0 1 2.75 -2l.9 1.75","hand-stop":"M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5 M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5 M14 5.5a1.5 1.5 0 0 1 3 0v6.5 M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47","list-check":"M3.5 5.5l1.5 1.5l2.5 -2.5 M3.5 11.5l1.5 1.5l2.5 -2.5 M3.5 17.5l1.5 1.5l2.5 -2.5 M11 6l9 0 M11 12l9 0 M11 18l9 0","lock":"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0 M8 11v-4a4 4 0 1 1 8 0v4","map-pin":"M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0 M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z","phone-call":"M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2 M15 7a2 2 0 0 1 2 2 M15 3a6 6 0 0 1 6 6","plug":"M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054z M4 20l3.5 -3.5 M15 4l-3.5 3.5 M20 9l-3.5 3.5","plug-off":"M16.123 16.092l-.177 .177a5.81 5.81 0 1 1 -8.215 -8.215l.159 -.159 M4 20l3.5 -3.5 M15 4l-3.5 3.5 M20 9l-3.5 3.5 M3 3l18 18","run":"M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M4 17l5 1l.75 -1.5 M15 21l0 -4l-4 -3l1 -6 M7 12l0 -3l5 -1l3 3l3 1","shirt":"M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0","shoe":"M4 6h5.426a1 1 0 0 1 .863 .496l1.064 1.823a3 3 0 0 0 1.896 1.407l4.677 1.114a4 4 0 0 1 3.074 3.89v2.27a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1z M14 13l1 -2 M8 18v-1a4 4 0 0 0 -4 -4h-1 M10 12l1.5 -3","sparkles":"M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z","tag":"M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z","tags":"M3 8v4.172a2 2 0 0 0 .586 1.414l5.71 5.71a2.41 2.41 0 0 0 3.408 0l3.592 -3.592a2.41 2.41 0 0 0 0 -3.408l-5.71 -5.71a2 2 0 0 0 -1.414 -.586h-4.172a2 2 0 0 0 -2 2z M18 19l1.592 -1.592a4.82 4.82 0 0 0 0 -6.816l-4.592 -4.592 M7 10h-.01","temperature":"M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5 M10 9l4 0","test-pipe":"M20 8.04l-12.122 12.124a2.857 2.857 0 1 1 -4.041 -4.04l12.122 -12.124 M7 13h8 M19 15l1.5 1.6a2 2 0 1 1 -3 0l1.5 -1.6z M15 3l6 6","tool":"M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5","tools-kitchen-2-off":"M14.386 10.409c.53 -2.28 1.766 -4.692 4.614 -7.409v12m-4 0h-1c0 -.313 0 -.627 0 -.941 M19 19v2h-1v-3 M8 8v13 M5 5v2a3 3 0 0 0 4.546 2.572m1.454 -2.572v-3 M3 3l18 18","trash":"M4 7l16 0 M10 11l0 6 M14 11l0 6 M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12 M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3","trolley":"M11 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M6 16l3 2 M12 17l8 -12 M17 10l2 1 M9.592 4.695l3.306 2.104a1.3 1.3 0 0 1 .396 1.8l-3.094 4.811a1.3 1.3 0 0 1 -1.792 .394l-3.306 -2.104a1.3 1.3 0 0 1 -.396 -1.8l3.094 -4.81a1.3 1.3 0 0 1 1.792 -.394z","users-group":"M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0 M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1 M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0 M17 10h2a2 2 0 0 1 2 2v1 M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0 M3 13v-1a2 2 0 0 1 2 -2h2","walk":"M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M7 21l3 -4 M16 21l-2 -4l-3 -3l1 -6 M6 12l2 -3l4 -1l3 3l3 1","wind":"M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24 M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24 M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24","hardhat":"M4.5 16a7.5 7.5 0 0 1 15 0 M2 16h20v2.5h-20z M10 8.7v-3.7h4v3.7 M8 9.5l1 6.5 M16 9.5l-1 6.5"};
  const W = 2480, H = 3508;   // A-series portrait (1 : 1.414)
  const FAM = { P: "Poppins, 'Segoe UI', Arial, sans-serif", B: "'Baloo 2', 'Nirmala UI', 'Noto Sans Devanagari', Poppins, sans-serif" };
  const TYPE = {   // ISO 7010 style colours
    must: { c: "#1565c0", d: "#0b3c7a", ink: "#ffffff", label: "MANDATORY", hi: "अनिवार्य" },
    warn: { c: "#f6c000", d: "#c99a00", ink: "#111111", label: "WARNING", hi: "चेतावनी" },
    fire: { c: "#c62828", d: "#7f1414", ink: "#ffffff", label: "FIRE SAFETY", hi: "अग्नि सुरक्षा" },
    safe: { c: "#1b8a4b", d: "#0e5a2f", ink: "#ffffff", label: "SAFE PRACTICE", hi: "सुरक्षित तरीका" }
  };
  // [type, main icon, English title, Hindi title, [[icon, English, Hindi], ...]]
  const POSTERS = [
    ["must", "hardhat", "PPE IS MANDATORY IN SMS & LAB", "एसएमएस और लैब में PPE अनिवार्य है", [
      ["hardhat", "Safety helmet at all times on the shop floor", "शॉप फ्लोर पर हर समय सेफ्टी हेलमेट पहनें"],
      ["shoe", "Safety shoes only - no sandals or slippers", "केवल सेफ्टी शूज़ - चप्पल या सैंडल नहीं"],
      ["eyeglass-2", "Goggles / face shield near molten metal and chemicals", "पिघली धातु और केमिकल के पास गॉगल्स / फेस शील्ड"],
      ["hand-stop", "Heat-resistant gloves for hot samples, chemical gloves for acids", "गर्म सैंपल के लिए हीट-रेज़िस्टेंट, एसिड के लिए केमिकल दस्ताने"],
      ["shirt", "Fire-retardant / aluminised jacket during sampling", "सैंपलिंग के समय फायर-रिटार्डेंट / एल्युमिनाइज़्ड जैकेट"],
      ["ear", "Ear plugs in high-noise areas", "ज़्यादा शोर वाली जगह पर ईयर प्लग"]]],
    ["warn", "flame", "MOLTEN METAL SAMPLING", "पिघली धातु की सैंपलिंग - सावधान", [
      ["droplet-off", "Use only dry tools and moulds - water or moisture with molten metal can explode", "केवल सूखे औज़ार और मोल्ड - पिघली धातु के साथ पानी या नमी से विस्फोट हो सकता है"],
      ["shirt", "Full PPE: face shield, aluminised jacket, heat gloves", "पूरा PPE: फेस शील्ड, एल्युमिनाइज़्ड जैकेट, हीट ग्लव्स"],
      ["walk", "Stand to the side - never in front of the furnace or ladle mouth", "बगल में खड़े हों - भट्टी या लैडल के मुँह के सामने कभी नहीं"],
      ["users-group", "Keep the path clear - nobody in the splash zone", "रास्ता साफ़ रखें - स्प्लैश ज़ोन में कोई न हो"],
      ["hand-grab", "Hold hot samples only with tongs; cool them at the marked place", "गर्म सैंपल केवल चिमटे से पकड़ें; तय जगह पर ठंडा करें"]]],
    ["warn", "flask", "HANDLE ACIDS WITH CARE", "एसिड सावधानी से संभालें", [
      ["droplet", "Always add acid to water - never water to acid", "हमेशा एसिड को पानी में डालें - पानी को एसिड में कभी नहीं"],
      ["wind", "Work in the fume hood; never smell or taste chemicals", "फ्यूम हुड में काम करें; केमिकल को कभी सूंघें या चखें नहीं"],
      ["test-pipe", "Use a pipette filler / bulb - never pipette by mouth", "पिपेट फिलर / बल्ब इस्तेमाल करें - मुँह से कभी नहीं"],
      ["eyeglass-2", "Wear goggles, apron and acid-resistant gloves", "गॉगल्स, एप्रन और एसिड-रेज़िस्टेंट दस्ताने पहनें"],
      ["bottle", "Carry acid bottles in a carrier, held from the bottom", "एसिड की बोतल कैरियर में, नीचे से पकड़कर ले जाएँ"],
      ["bucket", "Spill? Contain it, inform the in-charge, clean up as per the SDS", "गिर जाए तो रोकें, इंचार्ज को बताएँ, SDS के अनुसार साफ़ करें"]]],
    ["must", "tags", "STORE & LABEL CHEMICALS CORRECTLY", "केमिकल सही तरह रखें, लेबल लगाएँ", [
      ["tag", "Label every bottle: name, strength, date, prepared by", "हर बोतल पर लेबल: नाम, स्ट्रेंथ, तारीख, बनाने वाले का नाम"],
      ["building-warehouse", "Store acids, alkalis, oxidisers and flammables separately", "एसिड, क्षार, ऑक्सीडाइज़र और ज्वलनशील पदार्थ अलग-अलग रखें"],
      ["box", "Heavy and corrosive bottles on the lower shelves", "भारी और संक्षारक बोतलें नीचे की शेल्फ पर"],
      ["file-text", "Keep the SDS (Safety Data Sheet) of every chemical", "हर केमिकल की SDS (सेफ्टी डेटा शीट) रखें"],
      ["tools-kitchen-2-off", "Close lids tightly; no eating or drinking in the lab", "ढक्कन कसकर बंद करें; लैब में खाना-पीना मना"],
      ["trash", "Dispose of expired / unlabelled chemicals as per procedure", "पुराने / बिना लेबल के केमिकल नियम के अनुसार नष्ट करें"]]],
    ["warn", "cylinder", "GAS CYLINDER SAFETY (ARGON)", "गैस सिलेंडर सुरक्षा (आर्गन)", [
      ["lock", "Keep cylinders upright and chained to the wall or stand", "सिलेंडर सीधा खड़ा रखें और चेन से बाँधें"],
      ["trolley", "Valve cap on when not in use; move only on a trolley", "उपयोग न हो तो वाल्व कैप लगाएँ; केवल ट्रॉली से ले जाएँ"],
      ["bucket", "Check leaks with soap solution - never with a flame", "लीकेज साबुन के घोल से जाँचें - आग से कभी नहीं"],
      ["gauge", "Use the correct regulator; open the valve slowly", "सही रेगुलेटर लगाएँ; वाल्व धीरे खोलें"],
      ["flame-off", "Keep cylinders away from heat and sparks", "सिलेंडर को गर्मी और चिंगारी से दूर रखें"],
      ["wind", "Argon can push out oxygen - keep the room ventilated", "आर्गन ऑक्सीजन को हटा सकती है - कमरा हवादार रखें"]]],
    ["warn", "temperature", "HOT SURFACES - FURNACE, OVEN, HOT PLATE", "गर्म सतह - भट्टी, ओवन, हॉट प्लेट", [
      ["hand-grab", "Use long tongs and heat-resistant gloves", "लंबे चिमटे और हीट-रेज़िस्टेंट दस्ताने इस्तेमाल करें"],
      ["door", "Open the furnace door slowly and stand aside", "भट्टी का दरवाज़ा धीरे खोलें और बगल में खड़े हों"],
      ["box", "Put hot crucibles only on a heat-proof tile or in a desiccator", "गर्म क्रूसिबल केवल हीट-प्रूफ टाइल या डेसिकेटर में रखें"],
      ["clock", "Never leave a hot plate on unattended", "चालू हॉट प्लेट को कभी अकेला न छोड़ें"],
      ["flame-off", "Keep flammables away from heating equipment", "ज्वलनशील चीज़ें हीटिंग उपकरण से दूर रखें"],
      ["plug-off", "Switch off and let it cool before cleaning", "साफ़ करने से पहले बंद करें और ठंडा होने दें"]]],
    ["warn", "bolt", "ELECTRICAL & INSTRUMENT SAFETY", "बिजली और उपकरण सुरक्षा", [
      ["tool", "Do not open instrument covers - authorised service persons only", "उपकरण के कवर न खोलें - केवल अधिकृत सर्विस वाले"],
      ["hand-off", "Keep hands off the spectrometer spark stand during analysis", "एनालिसिस के समय स्पेक्ट्रोमीटर स्पार्क स्टैंड से हाथ दूर रखें"],
      ["droplet-off", "Never touch switches or plugs with wet hands", "गीले हाथ से स्विच या प्लग कभी न छुएँ"],
      ["plug", "Report damaged cables and plugs at once", "खराब तार और प्लग की तुरंत सूचना दें"],
      ["bolt", "Do not overload sockets; keep proper earthing", "सॉकेट ओवरलोड न करें; सही अर्थिंग रखें"],
      ["lock", "Lock out and tag out before any repair", "किसी भी मरम्मत से पहले लॉक-आउट और टैग-आउट करें"]]],
    ["fire", "fire-extinguisher", "IN CASE OF FIRE", "आग लगने पर", [
      ["bell-ringing", "Raise the alarm and inform the control room", "अलार्म बजाएँ और कंट्रोल रूम को सूचित करें"],
      ["fire-extinguisher", "Extinguisher P-A-S-S: Pull the pin, Aim at the base, Squeeze the handle, Sweep side to side", "पिन खींचें, आग की जड़ पर निशाना लगाएँ, हैंडल दबाएँ, दाएँ-बाएँ घुमाएँ"],
      ["plug-off", "Electrical fire: switch off power, use CO2 / dry powder - never water", "बिजली की आग: बिजली बंद करें, CO2 / ड्राई पाउडर - पानी कभी नहीं"],
      ["map-pin", "Know your nearest extinguisher and exit", "नज़दीकी फायर एक्सटिंग्विशर और निकास पहले से जानें"],
      ["run", "Leave by the nearest exit and go to the assembly point", "नज़दीकी निकास से बाहर निकलें और असेंबली पॉइंट पर जाएँ"]]],
    ["safe", "first-aid-kit", "CHEMICAL SPLASH & BURNS - FIRST AID", "केमिकल छींटे और जलना - प्राथमिक उपचार", [
      ["eye", "Eyes: flush at the eye-wash station for at least 15 minutes", "आँखें: आई-वॉश पर कम से कम 15 मिनट तक धोएँ"],
      ["fountain", "Skin: remove contaminated clothing, wash with plenty of water", "त्वचा: दूषित कपड़े हटाएँ, खूब पानी से धोएँ"],
      ["droplet", "Burn from hot metal: cool it under clean running water", "गर्म धातु से जलना: साफ़ बहते पानी से ठंडा करें"],
      ["hand-off", "Do not rub the eyes", "आँखें न मलें"],
      ["phone-call", "Inform the in-charge and go to the medical centre", "इंचार्ज को बताएँ और मेडिकल सेंटर जाएँ"],
      ["first-aid-kit", "Know where the first-aid box and eye-wash are", "फर्स्ट-एड बॉक्स और आई-वॉश कहाँ है, यह जानें"]]],
    ["safe", "sparkles", "GOOD HOUSEKEEPING - 5S IN THE LAB", "अच्छी साफ़-सफ़ाई - लैब में 5S", [
      ["arrows-sort", "Sort: remove what is not needed", "छाँटें: जो ज़रूरी नहीं, उसे हटाएँ"],
      ["list-check", "Set in order: a fixed place for everything", "क्रम में रखें: हर चीज़ की तय जगह"],
      ["sparkles", "Shine: clean benches and spills at once", "चमकाएँ: बेंच और गिरा हुआ तुरंत साफ़ करें"],
      ["clipboard-check", "Standardise: same method, labels and checklists", "मानक बनाएँ: एक जैसा तरीका, लेबल और चेकलिस्ट"],
      ["calendar-check", "Sustain: make it a daily habit", "बनाए रखें: इसे रोज़ की आदत बनाएँ"],
      ["trash", "Broken glassware only in the marked bin", "टूटा काँच केवल तय डिब्बे में"]]]
  ];

  // ---------- scene renderer: rect / circle / poly / path / icon / text / image / clipped group ----------
  const mctx = document.createElement("canvas").getContext("2d");
  const font = (o, size) => `${o.weight || 400} ${size || o.size}px ${FAM[o.fam || "P"]}`;
  const tw = (s, size, weight, fam) => { mctx.font = `${weight} ${size}px ${FAM[fam || "P"]}`; return mctx.measureText(s).width; };
  function wrap(s, size, weight, fam, maxW) {
    const words = String(s).split(" "), lines = []; let cur = "";
    words.forEach(w => { const t = cur ? cur + " " + w : w; if (tw(t, size, weight, fam) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  const hexA = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const PHOTO = {};   // poster index -> loaded <img> of the user's own photo
  function toSVG(sc, uid) {
    const defs = []; let gi = 0;
    const paint = p => {
      if (!p || typeof p === "string") return p || "none";
      const id = `${uid}g${gi++}`;
      const stops = p.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
      defs.push(p.lin ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${p.lin[0]}" y1="${p.lin[1]}" x2="${p.lin[2]}" y2="${p.lin[3]}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${p.rad[0]}" cy="${p.rad[1]}" r="${p.rad[2]}">${stops}</radialGradient>`);
      return `url(#${id})`;
    };
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const one = o => {
      const op = o.op != null ? ` opacity="${o.op}"` : "";
      const st = o.stroke ? ` stroke="${paint(o.stroke)}" stroke-width="${o.sw || 1}" stroke-linejoin="round" stroke-linecap="round"` : "";
      if (o.t === "rect") return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.r || 0}" fill="${paint(o.fill)}"${st}${op}/>`;
      if (o.t === "circle") return `<circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="${paint(o.fill)}"${st}${op}/>`;
      if (o.t === "poly") return `<polygon points="${o.pts.map(p => p.join(",")).join(" ")}" fill="${paint(o.fill)}"${st}${op}/>`;
      if (o.t === "path") return `<path d="${o.d}" transform="translate(${o.x || 0} ${o.y || 0}) scale(${o.s || 1})" fill="${paint(o.fill)}"${o.stroke ? ` stroke="${paint(o.stroke)}" stroke-width="${(o.sw || 1) / (o.s || 1)}" stroke-linejoin="round" stroke-linecap="round"` : ""}${op}/>`;
      if (o.t === "icon") return `<g transform="translate(${o.x} ${o.y}) scale(${o.s})" fill="none" stroke="${o.c}" stroke-width="${o.sw || 1.8}" stroke-linecap="round" stroke-linejoin="round"${op}><path d="${ICON[o.n] || ""}"/></g>`;
      if (o.t === "text") return `<text x="${o.x}" y="${o.y}" font-family="${esc(FAM[o.fam || "P"])}" font-size="${o.size}" font-weight="${o.weight || 400}" fill="${paint(o.fill)}" text-anchor="${o.anchor || "start"}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}${op}>${esc(o.s)}</text>`;
      if (o.t === "image") { const ph = PHOTO[o.k]; if (!ph) return ""; const { sx, sy, sw, sh } = cover(ph, o.w, o.h);
        const sc2 = o.w / sw; return `<svg x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none"><image href="${ph.src}" width="${ph.naturalWidth}" height="${ph.naturalHeight}"/></svg>`; }
      if (o.t === "group") { const id = `${uid}c${gi++}`; defs.push(`<clipPath id="${id}"><rect x="${o.clip.x}" y="${o.clip.y}" width="${o.clip.w}" height="${o.clip.h}" rx="${o.clip.r || 0}"/></clipPath>`);
        return `<g clip-path="url(#${id})">${o.items.map(one).join("")}</g>`; }
      return "";
    };
    const body = sc.map(one).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join("")}</defs>${body}</svg>`;
  }
  function cover(img, w, h) {   // source rectangle that fills w x h (centre crop)
    const iw = img.naturalWidth, ih = img.naturalHeight, r = Math.max(w / iw, h / ih);
    const sw = w / r, sh = h / r; return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
  }
  function toCanvas(sc, scale) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const g = cv.getContext("2d"); if (!g) return null;
    g.scale(scale, scale);
    const paint = p => { if (!p || typeof p === "string") return p || "transparent";
      const gr = p.lin ? g.createLinearGradient(...p.lin) : g.createRadialGradient(p.rad[0], p.rad[1], 0, p.rad[0], p.rad[1], p.rad[2]);
      p.stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const finish = (o, path) => { if (o.fill && o.fill !== "none") { g.fillStyle = paint(o.fill); path ? g.fill(path) : g.fill(); }
      if (o.stroke) { g.strokeStyle = paint(o.stroke); g.lineWidth = (o.sw || 1) / (o.t === "path" ? (o.s || 1) : 1); g.lineJoin = "round"; g.lineCap = "round"; path ? g.stroke(path) : g.stroke(); } };
    const draw = o => {
      g.save(); g.globalAlpha *= o.op != null ? o.op : 1;
      if (o.t === "rect") { g.beginPath(); if (g.roundRect) g.roundRect(o.x, o.y, o.w, o.h, o.r || 0); else g.rect(o.x, o.y, o.w, o.h); finish(o); }
      else if (o.t === "circle") { g.beginPath(); g.arc(o.cx, o.cy, o.r, 0, Math.PI * 2); finish(o); }
      else if (o.t === "poly") { g.beginPath(); o.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); finish(o); }
      else if (o.t === "path") { g.translate(o.x || 0, o.y || 0); g.scale(o.s || 1, o.s || 1); finish(o, new Path2D(o.d)); }
      else if (o.t === "icon") { g.translate(o.x, o.y); g.scale(o.s, o.s); g.strokeStyle = o.c; g.lineWidth = o.sw || 1.8; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(new Path2D(ICON[o.n] || "")); }
      else if (o.t === "text") { g.font = font(o); g.textAlign = o.anchor === "middle" ? "center" : o.anchor === "end" ? "right" : "left"; if ("letterSpacing" in g) g.letterSpacing = (o.ls || 0) + "px"; g.fillStyle = paint(o.fill); g.fillText(o.s, o.x, o.y); }
      else if (o.t === "image") { const ph = PHOTO[o.k]; if (ph) { const c = cover(ph, o.w, o.h); g.drawImage(ph, c.sx, c.sy, c.sw, c.sh, o.x, o.y, o.w, o.h); } }
      else if (o.t === "group") { g.beginPath(); if (g.roundRect) g.roundRect(o.clip.x, o.clip.y, o.clip.w, o.clip.h, o.clip.r || 0); else g.rect(o.clip.x, o.clip.y, o.clip.w, o.clip.h); g.clip(); o.items.forEach(draw); }
      g.restore();
    };
    sc.forEach(draw);
    return cv;
  }

  // ---------- illustration kit (flat style) ----------
  // every helper pushes into the array "L" with coordinates relative to the picture box (0,0 = top-left, 2360 x 800)
  const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
  const lin = (x1, y1, x2, y2, stops) => ({ lin: [x1, y1, x2, y2], stops });
  const rrect = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2));
    return r ? `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z` : `M${x} ${y}h${w}v${h}h${-w}z`; };
  function mk(L, ox, oy) {
    return {
      R: (x, y, w, h, r, fill, more) => L.push(Object.assign({ t: "path", d: rrect(x, y, w, h, r || 0), x: ox, y: oy, s: 1, fill }, more || {})),
      C: (cx, cy, r, fill, more) => L.push(Object.assign({ t: "path", d: ell(cx, cy, r, r), x: ox, y: oy, s: 1, fill }, more || {})),
      P: (d, fill, more) => L.push(Object.assign({ t: "path", d, x: ox, y: oy, s: 1, fill }, more || {})),
      Q: (pts, fill, more) => L.push(Object.assign({ t: "poly", pts: pts.map(([x, y]) => [ox + x, oy + y]), fill }, more || {})),
      T: (x, y, s, size, weight, fill, more) => L.push(Object.assign({ t: "text", x: ox + x, y: oy + y, s, size, weight, fill }, more || {})),
      I: (n, x, y, s, c, sw) => L.push({ t: "icon", n, x: ox + x, y: oy + y, s, c, sw }),
      ox, oy
    };
  }
  const SKIN = "#e0ac7e", SKIN_D = "#c98f60";
  // a worker standing; feet at (x, y); s = scale (1 = about 640 tall)
  function worker(L, k, x, y, s, o) {
    o = o || {};
    const S = v => v * s, X = v => x + v * s, Y = v => y + v * s;
    const jacket = o.alu ? lin(X(-120), 0, X(120), 0, [[0, "#9aa3ad"], [0.45, "#eef2f5"], [1, "#a7b0ba"]]) : (o.jacket || "#ff7a1a");
    k.P(ell(X(0), Y(4), S(140), S(24)), "rgba(0,0,0,.16)");   // shadow
    k.R(X(-70), Y(-44), S(64), S(44), S(14), "#2b2b2b"); k.R(X(6), Y(-44), S(64), S(44), S(14), "#2b2b2b");   // boots
    k.R(X(-70), Y(-44), S(26), S(22), S(8), "#7a7f87"); k.R(X(44), Y(-44), S(26), S(22), S(8), "#7a7f87");      // steel toe
    k.R(X(-60), Y(-300), S(54), S(262), S(18), o.alu ? "#b8c0c9" : "#2e4a78"); k.R(X(6), Y(-300), S(54), S(262), S(18), o.alu ? "#b8c0c9" : "#2e4a78");   // legs
    k.P(`M${X(-108)} ${Y(-300)}L${X(-122)} ${Y(-540)}Q${X(-120)} ${Y(-585)} ${X(-70)} ${Y(-592)}L${X(70)} ${Y(-592)}Q${X(120)} ${Y(-585)} ${X(122)} ${Y(-540)}L${X(108)} ${Y(-300)}Z`, jacket);   // jacket
    if (!o.alu) { k.R(X(-112), Y(-430), S(224), S(22), 0, "#e8eef3"); k.R(X(-110), Y(-370), S(220), S(22), 0, "#e8eef3"); }   // reflective tape
    k.R(X(-6), Y(-590), S(12), S(290), 0, "rgba(0,0,0,.15)");
    // arms
    const armL = o.armUp ? `M${X(-112)} ${Y(-560)}L${X(-210)} ${Y(-470)}L${X(-180)} ${Y(-440)}L${X(-104)} ${Y(-505)}Z` : `M${X(-118)} ${Y(-575)}L${X(-150)} ${Y(-340)}L${X(-112)} ${Y(-334)}L${X(-90)} ${Y(-540)}Z`;
    const armR = o.reach ? `M${X(112)} ${Y(-560)}L${X(250)} ${Y(-470)}L${X(232)} ${Y(-436)}L${X(102)} ${Y(-505)}Z` : `M${X(118)} ${Y(-575)}L${X(150)} ${Y(-340)}L${X(112)} ${Y(-334)}L${X(90)} ${Y(-540)}Z`;
    k.P(armL, jacket); k.P(armR, jacket);
    const glove = o.glove || "#e6b84a";
    if (o.armUp) k.C(X(-200), Y(-452), S(30), glove); else k.C(X(-131), Y(-326), S(30), glove);
    if (o.reach) k.C(X(246), Y(-452), S(30), glove); else k.C(X(131), Y(-326), S(30), glove);
    // head
    k.R(X(-26), Y(-628), S(52), S(44), S(10), SKIN_D);
    k.C(X(0), Y(-690), S(66), SKIN);
    k.C(X(-64), Y(-688), S(14), SKIN_D); k.C(X(64), Y(-688), S(14), SKIN_D);
    if (o.ear !== false) k.C(X(-66), Y(-688), S(8), "#ff8a00");
    k.P(`M${X(-22)} ${Y(-648)}Q${X(0)} ${Y(-636)} ${X(22)} ${Y(-648)}`, "none", { stroke: "#8a5a3c", sw: S(6) });   // smile
    // goggles
    k.R(X(-60), Y(-712), S(120), S(40), S(18), "#1e3a5f"); k.R(X(-50), Y(-706), S(46), S(28), S(12), "#7fd3ff"); k.R(X(4), Y(-706), S(46), S(28), S(12), "#7fd3ff");
    if (o.shield) k.R(X(-74), Y(-740), S(148), S(120), S(30), "rgba(170,225,255,.35)", { stroke: "rgba(255,255,255,.7)", sw: S(4) });
    // hard hat
    const hat = o.hat || "#ffd21f";
    k.P(`M${X(-80)} ${Y(-722)}Q${X(-78)} ${Y(-800)} ${X(0)} ${Y(-806)}Q${X(78)} ${Y(-800)} ${X(80)} ${Y(-722)}Z`, hat);
    k.R(X(-98), Y(-730), S(196), S(20), S(10), hat); k.R(X(-12), Y(-806), S(24), S(70), S(10), "rgba(255,255,255,.35)");
  }
  function plant(k, w, h, col) {   // factory silhouette at the bottom of the picture
    const d = `M0 ${h}V${h - 180}H160V${h - 300}H230V${h - 180}H420V${h - 260}L560 ${h - 330}V${h - 260}L700 ${h - 330}V${h - 200}H860V${h - 420}H900V${h - 200}H1040V${h - 240}H1300V${h - 160}H1480V${h - 360}H1520V${h - 160}H1700V${h - 280}H1900V${h - 190}H2100V${h - 300}H2140V${h - 190}H${w}V${h}Z`;
    k.P(d, col, { op: 0.16 });
    [[880, h - 470, 34], [915, h - 520, 44], [1500, h - 410, 30], [1535, h - 455, 40]].forEach(([cx, cy, r]) => k.C(cx, cy, r, col, { op: 0.1 }));
  }
  function label(k, x, y, txt, col, anchor) {
    const w = tw(txt, 40, 700, "P") + 50;
    const lx = anchor === "end" ? x - w : x;
    k.R(lx, y - 46, w, 66, 33, "#ffffff", { stroke: col, sw: 5 });
    k.T(lx + 25, y + 2, txt, 40, 700, "#14213d");
  }
  function lineTo(k, x1, y1, x2, y2, col) { k.P(`M${x1} ${y1}L${x2} ${y2}`, "none", { stroke: col, sw: 5 }); k.C(x2, y2, 10, col); }
  function bottle(k, x, y, w, h, liquid, cap, lab) {
    k.R(x + w * 0.3, y - h * 0.18, w * 0.4, h * 0.2, 8, cap);
    k.R(x, y, w, h, w * 0.22, "#eaf4fb", { stroke: "#9fb6c8", sw: 5 });
    k.R(x + 6, y + h * 0.35, w - 12, h * 0.62, w * 0.18, liquid);
    if (lab) { k.R(x + w * 0.12, y + h * 0.42, w * 0.76, h * 0.3, 8, "#ffffff"); k.T(x + w / 2, y + h * 0.62, lab, Math.min(34, w * 0.28), 800, "#14213d", { anchor: "middle" }); }
  }
  function flame(k, cx, by, s, col1, col2) {
    k.P(`M${cx} ${by}C${cx - 90 * s} ${by} ${cx - 110 * s} ${by - 120 * s} ${cx - 40 * s} ${by - 220 * s}C${cx - 30 * s} ${by - 150 * s} ${cx} ${by - 160 * s} ${cx + 10 * s} ${by - 260 * s}C${cx + 90 * s} ${by - 170 * s} ${cx + 110 * s} ${by - 60 * s} ${cx} ${by}Z`, col1 || "#ff6a00");
    k.P(`M${cx} ${by}C${cx - 45 * s} ${by} ${cx - 55 * s} ${by - 60 * s} ${cx - 15 * s} ${by - 120 * s}C${cx} ${by - 80 * s} ${cx + 20 * s} ${by - 90 * s} ${cx + 25 * s} ${by - 140 * s}C${cx + 60 * s} ${by - 80 * s} ${cx + 50 * s} ${by - 20 * s} ${cx} ${by}Z`, col2 || "#ffd23f");
  }
  function check(k, x, y, ok) {
    k.C(x, y, 52, ok ? "#1b8a4b" : "#c62828");
    if (ok) k.P(`M${x - 24} ${y}l16 18l32 -36`, "none", { stroke: "#ffffff", sw: 12 });
    else k.P(`M${x - 22} ${y - 22}l44 44M${x + 22} ${y - 22}l-44 44`, "none", { stroke: "#ffffff", sw: 12 });
  }

  const PW = 2360, PH = 800;
  const SCENES = [
    // 1. PPE - worker with call-outs
    (k, T) => { plant(k, PW, PH, T.c); worker(k.L, k, 1180, 770, 0.95);
      const c = T.c;
      [["Safety helmet", 1110, 92, 600, 110, "end"], ["Goggles / face shield", 1130, 98, 560, 250, "end"], ["Ear plugs", 1120, 116, 560, 380, "end"],
        ["Fire-retardant jacket", 1290, 300, 1700, 230], ["Gloves", 1305, 460, 1700, 400], ["Safety shoes", 1240, 742, 1700, 640]].forEach(([t, px, py, lx, ly, a]) => {
        lineTo(k, lx, ly - 12, px, py, c); label(k, lx, ly, t, c, a); }); },
    // 2. molten metal - ladle pouring, worker standing aside
    (k, T) => { k.R(0, 0, PW, PH, 0, lin(0, 0, 0, PH, [[0, "#2a1408"], [1, "#4a1d06"]]));
      k.C(1180, 520, 520, { rad: [1180, 560, 560], stops: [[0, "rgba(255,150,40,.55)"], [1, "rgba(255,120,0,0)"]] });
      k.P("M760 120L1240 120L1180 470Q1170 520 1120 520L880 520Q830 520 820 470Z", lin(760, 0, 1240, 0, [[0, "#3c4148"], [0.5, "#6b727c"], [1, "#2e3238"]]), { stroke: "#1b1d21", sw: 10 });
      k.P(ell(1000, 128, 238, 26), "#ffb02e"); k.C(810, 300, 26, "#4b525c"); k.C(1190, 300, 26, "#4b525c");
      k.P("M1236 132C1330 170 1360 300 1352 640", "none", { stroke: lin(0, 140, 0, 640, [[0, "#fff1b0"], [0.4, "#ffb02e"], [1, "#ff5a14"]]), sw: 34 });
      k.R(1180, 640, 360, 130, 14, "#2a2d33", { stroke: "#4b525c", sw: 8 }); k.R(1196, 662, 328, 92, 8, lin(0, 662, 0, 754, [[0, "#ffe08a"], [1, "#ff6a00"]]));
      for (let i = 0; i < 26; i++) { const a = -Math.PI * (0.1 + 0.8 * ((i * 37) % 26) / 26), r = 80 + (i * 53) % 240; k.C(1352 + Math.cos(a) * r, 640 + Math.sin(a) * r, 5 + (i % 4) * 2, i % 3 ? "#ffd27a" : "#fff3c4"); }
      worker(k.L, k, 1960, 780, 0.85, { alu: true, shield: true, reach: true, glove: "#c9ccd1" });
      k.P("M2170 384L1700 600", "none", { stroke: "#9aa3ad", sw: 14 });
      label(k, 1600, 120, "Stand aside - dry tools only", "#ffb02e"); },
    // 3. acids - acid to water
    (k, T) => { plant(k, PW, PH, "#8a6d00");
      k.R(140, 600, 2080, 40, 12, "#8d6e63"); k.R(160, 640, 40, 140, 6, "#6d4c41"); k.R(2160, 640, 40, 140, 6, "#6d4c41");
      // correct: acid into water
      k.P("M330 360L560 360L540 600L350 600Z", "#e3f2fd", { stroke: "#90caf9", sw: 8 }); k.P("M346 470L544 470L540 600L350 600Z", "#64b5f6", { op: 0.75 });
      k.T(445, 560, "WATER", 34, 800, "#0d47a1", { anchor: "middle" });
      bottle(k, 520, 150, 150, 210, "#ffcc80", "#c62828", "ACID");
      k.P("M600 340C600 400 470 420 455 470", "none", { stroke: "#ff9800", sw: 14 });
      check(k, 760, 230, true); k.T(450, 720, "ACID  →  WATER", 52, 800, "#1b5e20", { anchor: "middle" });
      // wrong
      k.P("M1430 360L1660 360L1640 600L1450 600Z", "#fff3e0", { stroke: "#ffb74d", sw: 8 }); k.P("M1446 470L1644 470L1640 600L1450 600Z", "#ff9800", { op: 0.75 });
      k.T(1545, 560, "ACID", 34, 800, "#e65100", { anchor: "middle" });
      bottle(k, 1620, 150, 150, 210, "#90caf9", "#1565c0", "H2O");
      k.P("M1700 340C1700 400 1570 420 1555 470", "none", { stroke: "#42a5f5", sw: 14 });
      [[1500, 330], [1590, 300], [1650, 350], [1540, 280]].forEach(([x, y], i) => k.C(x, y, 14 + i * 4, "#ffcc80", { op: 0.8 }));
      check(k, 1860, 230, false); k.T(1550, 720, "WATER  →  ACID", 52, 800, "#b71c1c", { anchor: "middle" });
      worker(k.L, k, 1080, 600, 0.62, { shield: true, glove: "#43a047", jacket: "#ffffff" }); },
    // 4. chemical storage - colour-coded shelves
    (k, T) => { plant(k, PW, PH, T.c);
      const groups = [["ACIDS", "#e53935"], ["ALKALIS", "#1e88e5"], ["OXIDISERS", "#fdd835"], ["FLAMMABLES", "#fb8c00"]];
      groups.forEach(([n, col], g) => { const x = 100 + g * 450;
        k.R(x, 120, 410, 620, 18, "#f5f7fa", { stroke: "#b0bec5", sw: 8 });
        k.R(x, 120, 410, 90, 18, col); k.T(x + 205, 182, n, 42, 800, g === 2 ? "#14213d" : "#ffffff", { anchor: "middle" });
        [380, 600].forEach((sy, r) => { k.R(x + 10, sy, 390, 16, 4, "#90a4ae");
          for (let b = 0; b < 3; b++) bottle(k, x + 30 + b * 125, sy - (r ? 170 : 150), 92, r ? 170 : 150, col, "#37474f", ""); });
      });
      k.R(1930, 250, 380, 300, 26, "#ffffff", { stroke: T.c, sw: 8 }); k.R(1930, 250, 380, 70, 26, T.c);
      k.T(2120, 300, "LABEL", 40, 800, "#ffffff", { anchor: "middle" });
      [["HCl 1 N", 44, 800, "#14213d"], ["Date: 17-10-2026", 32, 600, "#4a5568"], ["By: QAD-SMS", 32, 600, "#4a5568"]].forEach(([t, z, w, c], j) => k.T(1960, 390 + j * 60, t, z, w, c)); },
    // 5. argon cylinders - chained to the wall, soap test
    (k, T) => { k.R(0, 0, PW, PH, 0, lin(0, 0, 0, PH, [[0, "#eef2f7"], [1, "#dfe6ee"]])); k.R(0, 690, PW, 110, 0, "#c7cfd8");
      for (let y = 40; y < 680; y += 80) for (let x = (y / 80) % 2 ? 0 : 60; x < PW; x += 120) k.R(x, y, 112, 72, 6, "#e5eaf0", { stroke: "#d3dae3", sw: 3 });
      [[700, "#2e7d32"], [1020, "#2e7d32"]].forEach(([cx, col], i) => {
        k.R(cx - 110, 170, 220, 600, 100, lin(cx - 110, 0, cx + 110, 0, [[0, "#1b5e20"], [0.4, "#43a047"], [1, "#1b5e20"]]));
        k.R(cx - 110, 170, 220, 120, 100, "#d0d7de"); k.R(cx - 30, 110, 60, 70, 10, "#78909c");
        k.T(cx, 480, "ARGON", 50, 800, "#ffffff", { anchor: "middle" });
        k.P(`M${cx - 130} 330Q${cx} 380 ${cx + 130} 330`, "none", { stroke: "#424242", sw: 14 }); k.P(`M${cx - 130} 560Q${cx} 610 ${cx + 130} 560`, "none", { stroke: "#424242", sw: 14 });
      });
      k.R(560, 320, 30, 30, 6, "#424242"); k.R(1140, 320, 30, 30, 6, "#424242");
      k.C(1020, 78, 56, "#ffffff", { stroke: "#455a64", sw: 10 }); k.P("M1020 78L1046 50", "none", { stroke: "#c62828", sw: 8 }); k.R(1000, 100, 40, 40, 6, "#455a64");
      [[1066, 120, 16], [1094, 100, 22], [1080, 70, 12], [1118, 130, 14]].forEach(([x, y, r]) => k.C(x, y, r, "rgba(255,255,255,.6)", { stroke: "#4fc3f7", sw: 4 }));
      label(k, 1160, 96, "Soap test for leaks", "#2e7d32"); label(k, 1180, 360, "Chained upright", "#2e7d32");
      // cylinder trolley
      k.R(1880, 200, 28, 520, 12, "#546e7a"); k.R(1880, 690, 260, 28, 10, "#546e7a"); k.C(1910, 740, 42, "#37474f"); k.C(2100, 740, 42, "#37474f"); k.C(1910, 740, 16, "#90a4ae"); k.C(2100, 740, 16, "#90a4ae");
      k.R(1930, 300, 170, 390, 80, lin(1930, 0, 2100, 0, [[0, "#1b5e20"], [0.4, "#43a047"], [1, "#1b5e20"]])); k.R(1930, 300, 170, 90, 80, "#d0d7de"); k.R(1990, 250, 50, 56, 8, "#78909c");
      k.P("M1900 470Q2015 500 2120 470", "none", { stroke: "#424242", sw: 12 });
      label(k, 1560, 160, "Move on a trolley", "#2e7d32"); },
    // 6. hot surfaces - muffle furnace + hot plate
    (k, T) => { plant(k, PW, PH, "#8a6d00"); k.R(140, 640, 2080, 40, 12, "#8d6e63");
      k.R(260, 180, 620, 460, 30, lin(260, 0, 880, 0, [[0, "#cfd8dc"], [1, "#90a4ae"]]), { stroke: "#607d8b", sw: 8 });
      k.R(330, 250, 360, 300, 20, "#263238"); k.R(355, 275, 310, 250, 14, { rad: [510, 400, 220], stops: [[0, "#fff3c4"], [0.4, "#ffb02e"], [1, "#e64a19"]] });
      k.R(720, 270, 120, 70, 10, "#263238"); k.T(780, 318, "950°", 36, 800, "#ff5252", { anchor: "middle" }); k.C(780, 420, 34, "#455a64");
      // tongs with crucible
      k.P("M980 300L700 420M980 330L705 440", "none", { stroke: "#455a64", sw: 14 }); k.P("M640 400L740 400L728 470L652 470Z", "#eceff1", { stroke: "#90a4ae", sw: 6 });
      worker(k.L, k, 1150, 640, 0.6, { shield: true, reach: false, armUp: false, glove: "#8d6e63", jacket: "#ffffff" });
      // hot plate
      k.R(1500, 520, 520, 120, 20, "#37474f"); k.R(1540, 480, 440, 50, 10, { rad: [1760, 505, 240], stops: [[0, "#ff7043"], [1, "#bf360c"]] });
      [1640, 1760, 1880].forEach(x => k.P(`M${x} 450C${x - 30} 410 ${x + 30} 380 ${x} 340C${x - 30} 300 ${x + 30} 270 ${x} 230`, "none", { stroke: "#ff7043", sw: 12, op: 0.8 }));
      label(k, 1500, 140, "HOT - use tongs & heat gloves", "#e64a19"); },
    // 7. electrical - spectrometer + LOTO
    (k, T) => { plant(k, PW, PH, "#8a6d00"); k.R(140, 660, 2080, 30, 10, "#8d6e63");
      k.R(260, 220, 900, 440, 30, lin(260, 0, 1160, 0, [[0, "#eceff1"], [1, "#b0bec5"]]), { stroke: "#78909c", sw: 8 });
      k.R(300, 260, 360, 220, 16, "#263238"); k.R(320, 280, 320, 180, 10, lin(0, 280, 0, 460, [[0, "#4fc3f7"], [1, "#0277bd"]]));
      k.T(480, 380, "OES", 56, 800, "#ffffff", { anchor: "middle" });
      k.R(760, 160, 320, 120, 16, "#455a64"); k.C(920, 220, 40, "#263238"); k.P("M905 190L935 215L912 222L940 252", "none", { stroke: "#ffeb3b", sw: 8 });
      k.Q([[930, 300], [1010, 300], [970, 360]], "#f6c000", { stroke: "#111111", sw: 6 }); k.T(970, 346, "!", 44, 900, "#111111", { anchor: "middle" });
      // switchboard with lock & tag
      k.R(1500, 160, 360, 460, 24, "#cfd8dc", { stroke: "#78909c", sw: 8 }); k.R(1560, 240, 240, 140, 14, "#37474f"); k.R(1650, 270, 60, 80, 10, "#ef5350");
      k.P("M1640 440a40 40 0 0 1 80 0", "none", { stroke: "#c62828", sw: 14 }); k.R(1620, 440, 120, 100, 16, "#c62828"); k.C(1680, 488, 12, "#ffffff");
      k.P("M1740 470L1880 520L1860 640L1720 590Z", "#ffeb3b", { stroke: "#111111", sw: 5 }); k.T(1800, 570, "DANGER", 28, 900, "#c62828", { anchor: "middle" });
      label(k, 1880, 240, "Lock out · Tag out", "#c62828"); },
    // 8. fire - extinguisher and PASS
    (k, T) => { k.R(0, 0, PW, PH, 0, lin(0, 0, 0, PH, [[0, "#fff5f3"], [1, "#ffe1db"]]));
      flame(k, 420, 720, 2.2, "#ff5722", "#ffc107"); flame(k, 600, 720, 1.4, "#ff7043", "#ffd54f"); flame(k, 260, 720, 1.2, "#ff7043", "#ffd54f");
      k.R(820, 220, 200, 520, 90, lin(820, 0, 1020, 0, [[0, "#b71c1c"], [0.45, "#ef5350"], [1, "#b71c1c"]])); k.R(860, 140, 120, 90, 20, "#37474f");
      k.P("M980 170C1080 160 1110 260 1060 330", "none", { stroke: "#212121", sw: 18 }); k.R(840, 420, 160, 150, 14, "#ffffff"); k.T(920, 510, "CO2", 44, 900, "#b71c1c", { anchor: "middle" });
      [["P", "Pull", "pin"], ["A", "Aim", "at base"], ["S", "Squeeze", "handle"], ["S", "Sweep", "side to side"]].forEach(([l, a, b], i) => {
        const x = 1220 + i * 270; k.R(x, 200, 240, 400, 30, "#ffffff", { stroke: "#c62828", sw: 8 });
        k.C(x + 120, 300, 70, "#c62828"); k.T(x + 120, 330, l, 96, 900, "#ffffff", { anchor: "middle" });
        k.T(x + 120, 450, a, 48, 800, "#14213d", { anchor: "middle" }); k.T(x + 120, 510, b, 34, 600, "#4a5568", { anchor: "middle" }); });
      k.T(1750, 690, "Fight a fire only if it is small and you are trained", 40, 700, "#7f1414", { anchor: "middle" }); },
    // 9. first aid - eye-wash station
    (k, T) => { k.R(0, 0, PW, PH, 0, lin(0, 0, 0, PH, [[0, "#ecf8f1"], [1, "#d5efe0"]]));
      k.R(380, 180, 60, 600, 20, "#1b8a4b"); k.P("M300 180h220a30 30 0 0 1 0 60h-220a30 30 0 0 1 0 -60z", "#1b8a4b");
      k.P(ell(410, 330, 210, 46), "#2e7d32"); k.P(ell(410, 322, 190, 34), "#a5d6a7");
      [[330, 300], [490, 300]].forEach(([x, y]) => k.P(`M${x} ${y}C${x - 10} 200 ${x + 70} 160 ${x + 80} 140`, "none", { stroke: "#4fc3f7", sw: 16, op: 0.85 }));
      k.R(250, 520, 320, 90, 16, "#ffffff", { stroke: "#1b8a4b", sw: 6 }); k.T(410, 578, "EYE WASH", 40, 900, "#1b8a4b", { anchor: "middle" });
      // clock 15 min
      k.C(900, 330, 170, "#ffffff", { stroke: "#1b8a4b", sw: 14 }); k.P("M900 330L900 210", "none", { stroke: "#14213d", sw: 14 }); k.P("M900 330L1010 330", "none", { stroke: "#14213d", sw: 14 });
      k.P("M900 160A170 170 0 0 1 1070 330L900 330Z", "#1b8a4b", { op: 0.25 }); k.T(900, 580, "15 min", 64, 900, "#1b8a4b", { anchor: "middle" });
      // first aid box
      k.R(1300, 260, 420, 300, 30, "#ffffff", { stroke: "#1b8a4b", sw: 12 }); k.R(1430, 220, 160, 60, 20, "#1b8a4b");
      k.R(1480, 330, 60, 160, 10, "#1b8a4b"); k.R(1430, 380, 160, 60, 10, "#1b8a4b");
      k.T(1510, 640, "First-aid box", 48, 800, "#14213d", { anchor: "middle" });
      k.C(2000, 330, 150, "#ffffff", { stroke: "#1b8a4b", sw: 12 }); k.I("phone-call", 1890, 220, 9, "#1b8a4b", 2); k.T(2000, 580, "Inform in-charge", 48, 800, "#14213d", { anchor: "middle" }); },
    // 10. 5S - five steps
    (k, T) => { k.R(0, 0, PW, PH, 0, lin(0, 0, PW, 0, [[0, "#ecf8f1"], [1, "#e3f2fd"]]));
      const steps = [["1S", "SORT", "#e53935", "arrows-sort"], ["2S", "SET IN ORDER", "#fb8c00", "list-check"], ["3S", "SHINE", "#fdd835", "sparkles"], ["4S", "STANDARDISE", "#43a047", "clipboard-check"], ["5S", "SUSTAIN", "#1e88e5", "calendar-check"]];
      steps.forEach(([n, t, col, ic], i) => { const cx = 260 + i * 460, cy = 360;
        if (i < 4) k.P(`M${cx + 170} ${cy}L${cx + 290} ${cy}`, "none", { stroke: "#90a4ae", sw: 12 });
        if (i < 4) k.Q([[cx + 290, cy - 26], [cx + 330, cy], [cx + 290, cy + 26]], "#90a4ae");
        k.C(cx, cy, 170, col); k.C(cx, cy, 140, "#ffffff", { op: 0.92 }); k.I(ic, cx - 72, cy - 110, 6, col, 2.2);
        k.T(cx, cy + 92, n, 64, 900, col === "#fdd835" ? "#b8860b" : col, { anchor: "middle" });
        k.T(cx, cy + 250, t, 46, 800, "#14213d", { anchor: "middle" }); });
      k.T(PW / 2, 760, "A clean, orderly lab is a safe lab", 44, 700, "#1b5e20", { anchor: "middle" }); }
  ];

  // ---------- one poster ----------
  function build(i) {
    const [type, mainIcon, en, hi, rows] = POSTERS[i], T = TYPE[type], sc = [];
    sc.push({ t: "rect", x: 0, y: 0, w: W, h: H, fill: "#ffffff" });
    const BH = 830;
    sc.push({ t: "rect", x: 0, y: 0, w: W, h: BH, fill: { lin: [0, 0, W, BH], stops: [[0, T.d], [1, T.c]] } });
    for (let k = 0; k < 9; k++) sc.push({ t: "circle", cx: W - 200 + k * 10, cy: 120 - k * 6, r: 300 + k * 90, fill: "none", stroke: "#ffffff", sw: 3, op: 0.06 });
    const cx = W / 2, cy = 270;
    if (type === "warn") {
      sc.push({ t: "poly", pts: [[cx, cy - 215], [cx + 245, cy + 190], [cx - 245, cy + 190]], fill: "#ffffff", stroke: "#ffffff", sw: 54 });
      sc.push({ t: "poly", pts: [[cx, cy - 180], [cx + 210, cy + 170], [cx - 210, cy + 170]], fill: "#f6c000", stroke: "#111111", sw: 24 });
      sc.push({ t: "icon", n: mainIcon, x: cx - 105, y: cy - 50, s: 8.75, c: "#111111", sw: 2.1 });
    } else if (type === "must") {
      sc.push({ t: "circle", cx, cy, r: 205, fill: "#ffffff" }); sc.push({ t: "circle", cx, cy, r: 180, fill: T.c });
      sc.push({ t: "icon", n: mainIcon, x: cx - 132, y: cy - 132, s: 11, c: "#ffffff", sw: 1.9 });
    } else {
      sc.push({ t: "rect", x: cx - 205, y: cy - 205, w: 410, h: 410, r: 44, fill: "#ffffff" }); sc.push({ t: "rect", x: cx - 180, y: cy - 180, w: 360, h: 360, r: 28, fill: T.c });
      sc.push({ t: "icon", n: mainIcon, x: cx - 132, y: cy - 132, s: 11, c: "#ffffff", sw: 1.9 });
    }
    const tFill = type === "warn" ? "#111111" : "#ffffff";
    let ts = 108; while (tw(en, ts, 800, "P") > W - 200 && ts > 64) ts -= 2;
    sc.push({ t: "text", x: W / 2, y: 620, s: en, size: ts, weight: 800, fill: tFill, anchor: "middle", ls: 2 });
    let hs = 80; while (tw(hi, hs, 700, "B") > W - 220 && hs > 50) hs -= 4;
    sc.push({ t: "text", x: W / 2, y: 740, s: hi, size: hs, weight: 700, fill: tFill, anchor: "middle", fam: "B", op: 0.95 });
    if (type === "warn") for (let x = -60; x < W; x += 120) sc.push({ t: "poly", pts: [[x, BH], [x + 60, BH], [x + 120, BH + 40], [x + 60, BH + 40]], fill: "#111111" });
    else sc.push({ t: "rect", x: 0, y: BH, w: W, h: 40, fill: T.d, op: 0.9 });
    // picture: your own photo, or the built-in illustration
    const px = 60, py = BH + 80, clip = { x: px, y: py, w: PW, h: PH, r: 44 };
    sc.push({ t: "rect", x: px + 8, y: py + 16, w: PW, h: PH, r: 44, fill: "#000000", op: 0.12 });
    if (PHOTO[i]) {
      sc.push({ t: "group", clip, items: [{ t: "image", k: i, x: px, y: py, w: PW, h: PH }] });
    } else {
      const L = [];
      const k = mk(L, px, py); k.L = L;
      k.R(0, 0, PW, PH, 0, { lin: [0, 0, 0, PH], stops: [[0, hexA(T.c, 0.08)], [1, hexA(T.c, 0.2)]] });
      SCENES[i](k, T);
      sc.push({ t: "group", clip, items: L });
    }
    sc.push({ t: "rect", x: px, y: py, w: PW, h: PH, r: 44, fill: "none", stroke: T.c, sw: 10 });
    // rules
    const top = py + PH + 90, bottom = H - 250, x0 = 360, maxW = W - x0 - 120;
    let es = 66, hsz = 56, laid;
    for (;;) {
      laid = rows.map(([ic, e, h]) => ({ ic, e: wrap(e, es, 700, "P", maxW), h: wrap(h, hsz, 600, "B", maxW) }));
      const need = laid.reduce((s, r) => s + r.e.length * es * 1.2 + r.h.length * hsz * 1.25, 0) + 40 * rows.length;
      if (need <= bottom - top || es <= 40) { laid.gap = Math.max(40, (bottom - top - need) / rows.length + 40); break; }
      es -= 2; hsz -= 2;
    }
    let y = top;
    laid.forEach((r, kk) => {
      const blockH = r.e.length * es * 1.2 + r.h.length * hsz * 1.25;
      const cyR = y + blockH / 2 - es * 0.25, rr = Math.min(100, Math.max(70, blockH / 2 + 6));
      sc.push({ t: "circle", cx: 200, cy: cyR, r: rr, fill: type === "warn" ? "#f6c000" : T.c });
      sc.push({ t: "icon", n: r.ic, x: 200 - rr * 0.62, y: cyR - rr * 0.62, s: rr * 1.24 / 24, c: type === "warn" ? "#111111" : "#ffffff", sw: 2 });
      let yy = y + es;
      r.e.forEach(l => { sc.push({ t: "text", x: x0, y: yy, s: l, size: es, weight: 700, fill: "#14213d" }); yy += es * 1.2; });
      r.h.forEach(l => { sc.push({ t: "text", x: x0, y: yy + 4, s: l, size: hsz, weight: 600, fill: "#4a5568", fam: "B" }); yy += hsz * 1.25; });
      y += blockH + laid.gap;
    });
    // footer
    sc.push({ t: "rect", x: 0, y: H - 200, w: W, h: 200, fill: "#0b2545" });
    sc.push({ t: "rect", x: 0, y: H - 200, w: W, h: 14, fill: "#c9a227" });
    sc.push({ t: "text", x: 110, y: H - 82, s: coTag("QAD - SMS").toUpperCase(), size: 62, weight: 800, fill: "#ffffff", ls: 4 });
    sc.push({ t: "text", x: W - 110, y: H - 82, s: "SAFETY FIRST  ·  सुरक्षा पहले", size: 62, weight: 800, fill: "#f1d27a", anchor: "end", fam: "B" });
    sc.push({ t: "text", x: W / 2, y: H - 222, s: `${T.label} · ${T.hi}   ·   Poster ${i + 1} / ${POSTERS.length}`, size: 32, weight: 600, fill: "#8a94a6", anchor: "middle", fam: "B" });
    return sc;
  }

  // ---------- your own photos (kept on this device) ----------
  const photoKey = i => "spPhoto_" + i;
  function loadPhoto(i) {
    return new Promise(res => {
      let src = null; try { src = localStorage.getItem(photoKey(i)); } catch (e) {}
      if (!src) { delete PHOTO[i]; return res(); }
      const im = new Image(); im.onload = () => { PHOTO[i] = im; res(); }; im.onerror = () => { delete PHOTO[i]; res(); }; im.src = src;
    });
  }
  function pickPhoto(i) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { const im = new Image(); im.onload = () => {
        const sc2 = Math.min(1, 2400 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
        cv.width = Math.round(im.width * sc2); cv.height = Math.round(im.height * sc2); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        let q = 0.85, url = cv.toDataURL("image/jpeg", q);
        while (url.length > 900000 && q > 0.5) { q -= 0.1; url = cv.toDataURL("image/jpeg", q); }
        try { localStorage.setItem(photoKey(i), url); } catch (e) { alert("Couldn't save the photo on this device (storage full)."); return; }
        loadPhoto(i).then(() => { delete cache[i]; refresh(i); });
      }; im.src = rd.result; };
      rd.readAsDataURL(f);
    };
    inp.click();
  }

  // ---------- UI ----------
  let cur = 0; const cache = {};
  const sceneOf = i => cache[i] || (cache[i] = build(i));
  const img = (i, w, q) => { const cv = toCanvas(sceneOf(i), w / W); const u = cv ? cv.toDataURL("image/jpeg", q || 0.88) : ""; if (cv) cv.width = cv.height = 0; return u; };
  const title = i => POSTERS[i][2].replace(/\s+-\s+.*/, "");
  function thumbs() {
    $("spThumbs").innerHTML = POSTERS.map((p, i) => `<button type="button" class="ptThumb spThumb${i === cur ? " sel" : ""}" data-i="${i}"><img alt="" src="${img(i, 360)}"><b>${i + 1}. ${title(i)}</b></button>`).join("");
  }
  function show() {
    $("spStage").innerHTML = `<img alt="${POSTERS[cur][2]}" src="${img(cur, 1400)}">`;
    $("spThumbs").querySelectorAll(".spThumb").forEach(b => b.classList.toggle("sel", +b.dataset.i === cur));
    $("spName").textContent = `${cur + 1}. ${POSTERS[cur][2]}`;
    $("spPhotoDel").classList.toggle("hidden", !PHOTO[cur]);
    $("spPhotoBtn").textContent = PHOTO[cur] ? "📷 Change photo" : "📷 Use my own photo";
  }
  function refresh(i) {
    const t = $("spThumbs").querySelector(`.spThumb[data-i="${i}"] img`); if (t) t.src = img(i, 360);
    if (i === cur) show();
  }
  let started = false;
  async function start() {
    if (started) return; started = true;
    try { await Promise.all(["600", "700", "800", "900"].map(w => document.fonts.load(`${w} 40px Poppins`)).concat(["600", "700", "800"].map(w => document.fonts.load(`${w} 40px "Baloo 2"`, "सुरक्षा")))); } catch (e) {}
    await Promise.all(POSTERS.map((p, i) => loadPhoto(i)));
    thumbs(); show();
  }
  $("spThumbs").addEventListener("click", e => { const b = e.target.closest(".spThumb"); if (!b) return; cur = +b.dataset.i; show(); $("spStage").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("spPhotoBtn").addEventListener("click", () => pickPhoto(cur));
  $("spPhotoDel").addEventListener("click", () => { try { localStorage.removeItem(photoKey(cur)); } catch (e) {} delete PHOTO[cur]; delete cache[cur]; refresh(cur); });
  const fname = (i, ext) => `Safety_Poster_${String(i + 1).padStart(2, "0")}_${title(i).replace(/\W+/g, "_")}.${ext}`;
  const save = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); };
  async function bigJpg(i) {
    for (const w of [4961, 3508, 2480]) {
      let cv = null; try { cv = toCanvas(sceneOf(i), w / W); } catch (e) { cv = null; }
      if (!cv) continue;
      const blob = await new Promise(r => { try { cv.toBlob(r, "image/jpeg", 0.95); } catch (e) { r(null); } });
      cv.width = cv.height = 0;
      if (blob && blob.size > 40000) return { blob, w };
    }
    return null;
  }
  $("spJpgBtn").addEventListener("click", async () => {
    const st = $("spStatus"), b = $("spJpgBtn"); b.disabled = true; st.textContent = "Making the print file...";
    try {
      const r = await bigJpg(cur);
      if (!r) { st.textContent = "⚠️ This device could not make a large picture - use the SVG file or try on a computer."; return; }
      save(r.blob, fname(cur, "jpg"));
      const h = Math.round(r.w * H / W);
      st.textContent = `✅ ${r.w} × ${h} px JPG (${(r.blob.size / 1048576).toFixed(1)} MB) - ${r.w >= 4961 ? "A2 at 300 dpi (A1 at ~210 dpi)" : r.w >= 3508 ? "A3 at 300 dpi" : "A4 at 300 dpi"}.` +
        (PHOTO[cur] ? " Your photo prints only as sharp as the original photo." : "");
    } finally { b.disabled = false; }
  });
  $("spSvgBtn").addEventListener("click", () => save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + toSVG(sceneOf(cur), "x")], { type: "image/svg+xml" }), fname(cur, "svg")));
  $("spPdfBtn").addEventListener("click", async () => {
    const st = $("spStatus"), b = $("spPdfBtn"); b.disabled = true;
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
      for (let i = 0; i < POSTERS.length; i++) {
        st.textContent = `Adding poster ${i + 1} of ${POSTERS.length}...`;
        await new Promise(r => setTimeout(r, 20));
        if (i) doc.addPage("a3", "portrait");
        doc.addImage(img(i, 2480, 0.92), "JPEG", 0, 0, 297, 420, undefined, "FAST");
      }
      save(doc.output("blob"), "QAD_Safety_Posters_A3.pdf");
      st.textContent = `✅ All ${POSTERS.length} posters saved as one A3 PDF (2480 px wide pages - about 210 dpi on A3). For the sharpest big print use the single-poster JPG.`;
    } catch (e) { st.textContent = "⚠️ PDF failed: " + e.message; }
    finally { b.disabled = false; }
  });
  window.spStart = start;
})();
