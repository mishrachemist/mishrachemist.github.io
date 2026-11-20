/* ===================== ELEMENT: Safety Data Sheets (16 lab chemicals, 16 sections, English + Hindi) ===================== */
// Content compiled from the ILO/WHO International Chemical Safety Cards (ICSC) and supplier SDSs named in Section 16
// of each sheet; GHS hazard / precautionary statement wording per the UN GHS.
(function sdsModule() {
  const $ = id => document.getElementById(id);
  if (!$("sdsList")) return;

  // ---------- GHS statements (English | Hindi) ----------
  const HS = {
    H226: ["Flammable liquid and vapour.", "ज्वलनशील द्रव और वाष्प।"],
    H271: ["May cause fire or explosion; strong oxidiser.", "आग या विस्फोट का कारण बन सकता है; तेज़ ऑक्सीडाइज़र।"],
    H272: ["May intensify fire; oxidiser.", "आग को और तेज़ कर सकता है; ऑक्सीडाइज़र।"],
    H280: ["Contains gas under pressure; may explode if heated.", "दबाव में भरी गैस; गर्म होने पर फट सकता है।"],
    H290: ["May be corrosive to metals.", "धातुओं को संक्षारित (गला) कर सकता है।"],
    H301: ["Toxic if swallowed.", "निगलने पर विषैला।"],
    H302: ["Harmful if swallowed.", "निगलने पर हानिकारक।"],
    H303: ["May be harmful if swallowed.", "निगलने पर हानिकारक हो सकता है।"],
    H312: ["Harmful in contact with skin.", "त्वचा के संपर्क में हानिकारक।"],
    "H312+H332": ["Harmful in contact with skin or if inhaled.", "त्वचा के संपर्क में या साँस से अंदर जाने पर हानिकारक।"],
    H314: ["Causes severe skin burns and eye damage.", "त्वचा को गंभीर रूप से जलाता है और आँखों को नुकसान पहुँचाता है।"],
    H317: ["May cause an allergic skin reaction.", "त्वचा पर एलर्जी पैदा कर सकता है।"],
    H330: ["Fatal if inhaled.", "साँस से अंदर जाने पर जानलेवा।"],
    H334: ["May cause allergy or asthma symptoms or breathing difficulties if inhaled.", "साँस से अंदर जाने पर एलर्जी, दमा के लक्षण या साँस लेने में कठिनाई हो सकती है।"],
    H335: ["May cause respiratory irritation.", "श्वसन तंत्र में जलन पैदा कर सकता है।"],
    H340: ["May cause genetic defects.", "आनुवंशिक दोष पैदा कर सकता है।"],
    H350: ["May cause cancer.", "कैंसर पैदा कर सकता है।"],
    H360: ["May damage fertility or the unborn child.", "प्रजनन क्षमता या गर्भस्थ शिशु को नुकसान पहुँचा सकता है।"],
    H361: ["Suspected of damaging fertility or the unborn child.", "प्रजनन क्षमता या गर्भस्थ शिशु को नुकसान पहुँचाने का संदेह।"],
    H370: ["Causes damage to kidneys.", "गुर्दों (किडनी) को नुकसान पहुँचाता है।"],
    H372: ["Causes damage to organs through prolonged or repeated exposure.", "लंबे या बार-बार संपर्क से अंगों को नुकसान पहुँचाता है।"],
    H373: ["May cause damage to organs through prolonged or repeated exposure.", "लंबे या बार-बार संपर्क से अंगों को नुकसान पहुँचा सकता है।"],
    H400: ["Very toxic to aquatic life.", "जलीय जीवों के लिए अत्यधिक विषैला।"],
    H402: ["Harmful to aquatic life.", "जलीय जीवों के लिए हानिकारक।"],
    H410: ["Very toxic to aquatic life with long lasting effects.", "जलीय जीवों के लिए अत्यधिक विषैला, लंबे समय तक असर।"]
  };
  const PS = {
    P201: ["Obtain special instructions before use.", "इस्तेमाल से पहले विशेष निर्देश प्राप्त करें।"],
    P202: ["Do not handle until all safety precautions have been read and understood.", "सभी सुरक्षा सावधानियाँ पढ़ और समझ लेने से पहले न छुएँ।"],
    P210: ["Keep away from heat, hot surfaces, sparks, open flames and other ignition sources. No smoking.", "गर्मी, गर्म सतह, चिंगारी, खुली आग और अन्य ज्वलन स्रोतों से दूर रखें। धूम्रपान मना।"],
    P220: ["Keep away from clothing and other combustible materials.", "कपड़ों और अन्य जलने वाली चीज़ों से दूर रखें।"],
    P233: ["Keep container tightly closed.", "कंटेनर कसकर बंद रखें।"],
    P234: ["Keep only in original packaging.", "केवल मूल पैकिंग में रखें।"],
    P240: ["Ground and bond container and receiving equipment.", "कंटेनर और लेने वाले उपकरण की अर्थिंग / बॉन्डिंग करें।"],
    P260: ["Do not breathe dust / fume / gas / mist / vapours / spray.", "धूल / धुआँ / गैस / धुंध / वाष्प / स्प्रे में साँस न लें।"],
    P261: ["Avoid breathing dust / fume / gas / mist / vapours / spray.", "धूल / धुआँ / गैस / धुंध / वाष्प / स्प्रे में साँस लेने से बचें।"],
    P264: ["Wash hands thoroughly after handling.", "इस्तेमाल के बाद हाथ अच्छी तरह धोएँ।"],
    P270: ["Do not eat, drink or smoke when using this product.", "इस्तेमाल करते समय खाना, पीना या धूम्रपान न करें।"],
    P271: ["Use only outdoors or in a well-ventilated area.", "केवल खुली या अच्छी हवादार जगह में इस्तेमाल करें।"],
    P272: ["Contaminated work clothing should not be allowed out of the workplace.", "दूषित काम के कपड़े कार्यस्थल से बाहर न ले जाएँ।"],
    P273: ["Avoid release to the environment.", "पर्यावरण में न छोड़ें।"],
    P280: ["Wear protective gloves / protective clothing / eye protection / face protection.", "सुरक्षात्मक दस्ताने / कपड़े / आँख और चेहरे की सुरक्षा पहनें।"],
    P284: ["In case of inadequate ventilation wear respiratory protection.", "हवादारी कम हो तो श्वसन सुरक्षा (रेस्पिरेटर) पहनें।"],
    "P301+P310": ["IF SWALLOWED: Immediately call a POISON CENTRE / doctor.", "निगल लिया हो: तुरंत ज़हर नियंत्रण केंद्र / डॉक्टर को बुलाएँ।"],
    "P301+P312": ["IF SWALLOWED: Call a POISON CENTRE / doctor if you feel unwell.", "निगल लिया हो: तबीयत खराब लगे तो ज़हर नियंत्रण केंद्र / डॉक्टर को बुलाएँ।"],
    "P301+P330+P331": ["IF SWALLOWED: Rinse mouth. Do NOT induce vomiting.", "निगल लिया हो: मुँह कुल्ला करें। उल्टी न कराएँ।"],
    "P302+P352": ["IF ON SKIN: Wash with plenty of water.", "त्वचा पर लगे: खूब पानी से धोएँ।"],
    "P303+P361+P353": ["IF ON SKIN (or hair): Take off immediately all contaminated clothing. Rinse skin with water or shower.", "त्वचा (या बालों) पर लगे: सभी दूषित कपड़े तुरंत उतारें। त्वचा को पानी से धोएँ या शावर लें।"],
    "P304+P340": ["IF INHALED: Remove person to fresh air and keep comfortable for breathing.", "साँस से अंदर गया हो: व्यक्ति को ताज़ी हवा में ले जाएँ और आराम से साँस लेने दें।"],
    "P305+P351+P338": ["IF IN EYES: Rinse cautiously with water for several minutes. Remove contact lenses, if present and easy to do. Continue rinsing.", "आँखों में जाए: कई मिनट तक सावधानी से पानी से धोएँ। कॉन्टैक्ट लेंस हों और आसानी से निकलें तो निकालें। धोना जारी रखें।"],
    "P308+P311": ["IF exposed or concerned: Call a POISON CENTRE / doctor.", "संपर्क हुआ हो या चिंता हो: ज़हर नियंत्रण केंद्र / डॉक्टर को बुलाएँ।"],
    "P308+P313": ["IF exposed or concerned: Get medical advice / attention.", "संपर्क हुआ हो या चिंता हो: डॉक्टरी सलाह / इलाज लें।"],
    P310: ["Immediately call a POISON CENTRE / doctor.", "तुरंत ज़हर नियंत्रण केंद्र / डॉक्टर को बुलाएँ।"],
    P312: ["Call a POISON CENTRE / doctor if you feel unwell.", "तबीयत खराब लगे तो ज़हर नियंत्रण केंद्र / डॉक्टर को बुलाएँ।"],
    P314: ["Get medical advice / attention if you feel unwell.", "तबीयत खराब लगे तो डॉक्टरी सलाह / इलाज लें।"],
    P330: ["Rinse mouth.", "मुँह कुल्ला करें।"],
    "P333+P313": ["If skin irritation or rash occurs: Get medical advice / attention.", "त्वचा में जलन या दाने हों: डॉक्टरी सलाह / इलाज लें।"],
    "P342+P311": ["If experiencing respiratory symptoms: Call a POISON CENTRE / doctor.", "साँस संबंधी लक्षण हों: ज़हर नियंत्रण केंद्र / डॉक्टर को बुलाएँ।"],
    P363: ["Wash contaminated clothing before reuse.", "दूषित कपड़े दोबारा पहनने से पहले धोएँ।"],
    "P370+P378": ["In case of fire: use the extinguishing media given in Section 5.", "आग लगने पर: सेक्शन 5 में बताए साधन से बुझाएँ।"],
    "P371+P380+P375": ["In case of major fire and large quantities: Evacuate area. Fight fire remotely due to the risk of explosion.", "बड़ी आग और बड़ी मात्रा हो तो: जगह खाली करें। विस्फोट के खतरे के कारण दूर से आग बुझाएँ।"],
    P390: ["Absorb spillage to prevent material damage.", "सामग्री को नुकसान से बचाने के लिए गिरा हुआ सोख लें।"],
    P391: ["Collect spillage.", "गिरा हुआ इकट्ठा करें।"],
    "P403+P233": ["Store in a well-ventilated place. Keep container tightly closed.", "हवादार जगह पर रखें। कंटेनर कसकर बंद रखें।"],
    "P403+P235": ["Store in a well-ventilated place. Keep cool.", "हवादार जगह पर रखें। ठंडा रखें।"],
    P405: ["Store locked up.", "ताले में रखें।"],
    "P410+P403": ["Protect from sunlight. Store in a well-ventilated place.", "धूप से बचाएँ। हवादार जगह पर रखें।"],
    P501: ["Dispose of contents / container in accordance with local regulations.", "सामग्री / कंटेनर को स्थानीय नियमों के अनुसार नष्ट करें।"]
  };
  // precautionary statements that go with each hazard statement (UN GHS Annex 3)
  const P_FOR = {
    H226: ["P210", "P233", "P240", "P280", "P370+P378", "P403+P235", "P501"],
    H271: ["P210", "P220", "P280", "P371+P380+P375", "P370+P378", "P501"],
    H272: ["P210", "P220", "P280", "P370+P378", "P501"],
    H280: ["P410+P403"],
    H290: ["P234", "P390"],
    H301: ["P264", "P270", "P301+P310", "P330", "P405", "P501"],
    H302: ["P264", "P270", "P301+P312", "P330", "P501"],
    H303: ["P312"],
    H312: ["P280", "P302+P352", "P312", "P363"],
    "H312+H332": ["P261", "P271", "P280", "P302+P352", "P304+P340", "P312", "P363"],
    H314: ["P260", "P264", "P280", "P301+P330+P331", "P303+P361+P353", "P304+P340", "P305+P351+P338", "P310", "P363", "P405", "P501"],
    H317: ["P261", "P272", "P280", "P302+P352", "P333+P313", "P363", "P501"],
    H330: ["P260", "P271", "P284", "P304+P340", "P310", "P403+P233", "P405", "P501"],
    H334: ["P261", "P284", "P304+P340", "P342+P311", "P501"],
    H335: ["P261", "P271", "P304+P340", "P312", "P403+P233", "P405", "P501"],
    H340: ["P201", "P202", "P280", "P308+P313", "P405", "P501"],
    H350: ["P201", "P202", "P280", "P308+P313", "P405", "P501"],
    H360: ["P201", "P202", "P280", "P308+P313", "P405", "P501"],
    H361: ["P201", "P202", "P280", "P308+P313", "P405", "P501"],
    H370: ["P260", "P264", "P270", "P308+P311", "P405", "P501"],
    H372: ["P260", "P264", "P270", "P314", "P501"],
    H373: ["P260", "P314", "P501"],
    H400: ["P273", "P391", "P501"],
    H402: ["P273", "P501"],
    H410: ["P273", "P391", "P501"]
  };
  const PICT = { GHS02: ["Flame", "ज्वलनशील"], GHS03: ["Flame over circle (oxidiser)", "ऑक्सीडाइज़र"], GHS04: ["Gas cylinder", "दबाव में गैस"],
    GHS05: ["Corrosion", "संक्षारक"], GHS06: ["Skull and crossbones", "तीव्र विषैला"], GHS07: ["Exclamation mark", "हानिकारक / उत्तेजक"],
    GHS08: ["Health hazard", "स्वास्थ्य खतरा"], GHS09: ["Environment", "पर्यावरण के लिए खतरा"] };

  // ---------- reusable phrases (English | Hindi) ----------
  const L = {
    // symptoms
    cough: ["cough", "खाँसी"], sore: ["sore throat", "गले में खराश"], burn: ["burning sensation", "जलन"], sob: ["shortness of breath", "साँस फूलना"],
    labour: ["laboured breathing", "साँस लेने में कठिनाई"], red: ["redness", "लालिमा"], pain: ["pain", "दर्द"], blister: ["blisters", "छाले"],
    skinburn: ["skin burns", "त्वचा का जलना"], serburn: ["serious skin burns", "त्वचा का गंभीर जलना"], sevburn: ["severe burns", "गंभीर जलन / घाव"],
    deepburn: ["severe deep burns", "गहरे गंभीर घाव"], blur: ["blurred vision", "धुंधला दिखना"], vision: ["loss of vision", "दृष्टि जाना"],
    abd: ["abdominal pain", "पेट दर्द"], vomit: ["vomiting", "उल्टी"], nausea: ["nausea", "जी मिचलाना"], diarr: ["diarrhoea", "दस्त"],
    shock: ["shock or collapse", "सदमा या बेहोशी"], headache: ["headache", "सिरदर्द"], dizzy: ["dizziness", "चक्कर"], wheeze: ["wheezing", "घरघराहट"],
    mouthburn: ["burns in mouth and throat", "मुँह और गले में जलन / घाव"], chest: ["burning sensation behind the breastbone", "छाती की हड्डी के पीछे जलन"],
    yellow: ["yellow staining of skin", "त्वचा पीली पड़ना"], frost: ["frostbite (from the liquid)", "शीत-दंश (तरल से)"], suffoc: ["suffocation", "दम घुटना"],
    lethargy: ["lethargy", "सुस्ती"], convuls: ["convulsions", "ऐंठन / दौरे"], weak: ["weakness", "कमज़ोरी"], fatigue: ["fatigue", "थकान"],
    // first aid
    fa_air: ["Fresh air, rest.", "ताज़ी हवा में ले जाएँ, आराम कराएँ।"],
    fa_halfup: ["Keep in a half-upright position.", "आधा बैठा हुआ (अर्ध-सीधी) स्थिति में रखें।"],
    fa_artresp: ["Artificial respiration may be needed.", "ज़रूरत हो तो कृत्रिम श्वसन दें।"],
    fa_mednow: ["Refer immediately for medical attention.", "तुरंत डॉक्टर / मेडिकल सेंटर ले जाएँ।"],
    fa_med: ["Refer for medical attention.", "डॉक्टर को दिखाएँ।"],
    fa_unwell: ["Get medical advice if you feel unwell.", "तबीयत खराब लगे तो डॉक्टर से सलाह लें।"],
    fa_helpers: ["First-aid helpers: wear protective gloves.", "मदद करने वाले दस्ताने पहनें।"],
    fa_cloth: ["Remove contaminated clothes.", "दूषित कपड़े उतार दें।"],
    fa_rinse15: ["Rinse skin with plenty of water or shower for at least 15 minutes.", "त्वचा को कम से कम 15 मिनट तक खूब पानी से धोएँ या शावर लें।"],
    fa_soap: ["Wash skin with soap and water.", "त्वचा को साबुन और पानी से धोएँ।"],
    fa_frost: ["On frostbite: rinse with plenty of water; do NOT remove clothes.", "शीत-दंश पर: खूब पानी से धोएँ; कपड़े न उतारें।"],
    fa_eye: ["Rinse with plenty of water for several minutes (remove contact lenses if easily possible), then continue at the eye-wash.", "कई मिनट तक खूब पानी से आँखें धोएँ (कॉन्टैक्ट लेंस आसानी से निकलें तो निकालें), फिर आई-वॉश पर धोते रहें।"],
    fa_eyerun: ["Rinse for several minutes under running water.", "बहते पानी से कई मिनट तक धोएँ।"],
    fa_mouth: ["Rinse mouth.", "मुँह कुल्ला कराएँ।"],
    fa_novomit: ["Do NOT induce vomiting.", "उल्टी न कराएँ।"],
    fa_nodrink: ["Give nothing to drink.", "पीने को कुछ न दें।"],
    fa_smallwater: ["Give one small glass of water to drink, only if within a few minutes of ingestion.", "निगलने के कुछ ही मिनट के भीतर हो तभी एक छोटा गिलास पानी पिलाएँ।"],
    fa_water12: ["Give one or two glasses of water to drink.", "एक-दो गिलास पानी पिलाएँ।"],
    fa_delay: ["Symptoms of lung oedema may appear only after a few hours and are worsened by physical effort - rest and medical observation are essential.", "फेफड़ों में सूजन (लंग ओडिमा) के लक्षण कुछ घंटों बाद दिख सकते हैं और मेहनत से बढ़ते हैं - आराम और डॉक्टरी निगरानी ज़रूरी है।"],
    // fire
    fi_noncomb: ["Not combustible.", "ज्वलनशील नहीं है।"],
    fi_enhance: ["Not combustible, but enhances the combustion of other substances (oxidiser).", "स्वयं नहीं जलता, पर दूसरी चीज़ों के जलने को बढ़ाता है (ऑक्सीडाइज़र)।"],
    fi_flam: ["Flammable; above 39 °C explosive vapour / air mixtures may be formed.", "ज्वलनशील; 39 °C से ऊपर वाष्प-हवा का विस्फोटक मिश्रण बन सकता है।"],
    fi_comb: ["Combustible.", "जल सकता है।"],
    fi_fumes: ["Gives off irritating or toxic fumes (or gases) in a fire.", "आग में जलन पैदा करने वाला या ज़हरीला धुआँ / गैस निकलती है।"],
    fi_react: ["Many reactions may cause fire or explosion.", "कई अभिक्रियाओं से आग या विस्फोट हो सकता है।"],
    fi_waterheat: ["Contact with moisture or water may generate enough heat to ignite combustible substances.", "नमी या पानी के संपर्क से इतनी गर्मी बन सकती है कि जलने वाली चीज़ें आग पकड़ लें।"],
    fi_perchlor: ["May explode on heating, shock or friction; mixtures with combustibles (paper, wood) may ignite spontaneously.", "गर्म करने, झटके या घर्षण से विस्फोट हो सकता है; कागज़ / लकड़ी जैसी चीज़ों के साथ अपने-आप आग लग सकती है।"],
    fi_cyl: ["Heating will cause a pressure rise with risk of bursting.", "गर्म होने पर दबाव बढ़ता है और सिलेंडर फट सकता है।"],
    fm_surround: ["Use extinguishing media appropriate to the surrounding fire.", "आसपास की आग के अनुसार उपयुक्त अग्निशामक इस्तेमाल करें।"],
    fm_cool: ["Keep drums / containers / cylinders cool by spraying with water.", "ड्रम / कंटेनर / सिलेंडर को पानी की फुहार से ठंडा रखें।"],
    fm_nowater: ["Do NOT let water come in direct contact with the substance.", "पदार्थ पर सीधे पानी न पड़ने दें।"],
    fm_nitric: ["Use large amounts of water or carbon dioxide; NO powder, NO foam.", "भरपूर पानी या कार्बन डाइऑक्साइड इस्तेमाल करें; पाउडर या फोम नहीं।"],
    fm_acetic: ["Use powder, alcohol-resistant foam, water spray or carbon dioxide.", "पाउडर, अल्कोहल-रोधी फोम, पानी की फुहार या कार्बन डाइऑक्साइड इस्तेमाल करें।"],
    fm_largewater: ["Use large amounts of water.", "भरपूर पानी इस्तेमाल करें।"],
    fm_oxalic: ["Use water spray, powder, foam or carbon dioxide.", "पानी की फुहार, पाउडर, फोम या कार्बन डाइऑक्साइड इस्तेमाल करें।"],
    fm_shelter: ["Fight the fire from a sheltered position.", "सुरक्षित आड़ से आग बुझाएँ।"],
    fm_scba: ["Fire-fighters: self-contained breathing apparatus and full protective clothing.", "अग्निशमन कर्मी: सेल्फ-कंटेन्ड ब्रीदिंग अपैरेटस और पूरा सुरक्षात्मक कपड़ा।"],
    // spill
    sp_evac: ["Evacuate the danger area; consult an expert.", "खतरे वाली जगह खाली कराएँ; विशेषज्ञ से सलाह लें।"],
    sp_suit: ["Personal protection: chemical protection suit including self-contained breathing apparatus.", "व्यक्तिगत सुरक्षा: केमिकल-रोधी सूट और सेल्फ-कंटेन्ड ब्रीदिंग अपैरेटस।"],
    sp_filter: ["Personal protection: particulate filter respirator, gloves and safety goggles.", "व्यक्तिगत सुरक्षा: पार्टिकुलेट फ़िल्टर रेस्पिरेटर, दस्ताने और सेफ्टी गॉगल्स।"],
    sp_ppe: ["Wear suitable protective equipment; keep unprotected persons away.", "उपयुक्त सुरक्षा उपकरण पहनें; बिना सुरक्षा वाले लोगों को दूर रखें।"],
    sp_noenv: ["Do NOT let this chemical enter the environment or drains.", "इस केमिकल को पर्यावरण या नाली में न जाने दें।"],
    sp_nosaw: ["Do NOT absorb in sawdust or other combustible absorbents.", "बुरादे या किसी जलने वाले सोखने वाले पदार्थ से न सोखें।"],
    sp_liq: ["Collect leaking liquid in sealable containers.", "रिसते द्रव को बंद होने वाले कंटेनर में इकट्ठा करें।"],
    sp_sand: ["Absorb the remaining liquid in dry sand or inert absorbent.", "बचे हुए द्रव को सूखी रेत या निष्क्रिय पदार्थ में सोखें।"],
    sp_lime: ["Then cautiously neutralise the remainder with lime or soda ash.", "फिर बचे हिस्से को सावधानी से चूना या सोडा ऐश से उदासीन करें।"],
    sp_na2co3: ["Cautiously neutralise the remainder with sodium carbonate, then wash away with plenty of water.", "बचे हिस्से को सावधानी से सोडियम कार्बोनेट से उदासीन करें, फिर खूब पानी से बहाएँ।"],
    sp_neutral: ["Cautiously neutralise the remainder.", "बचे हिस्से को सावधानी से उदासीन करें।"],
    sp_dilacid: ["Cautiously neutralise with dilute acid (e.g. dilute sulfuric acid), then wash away with plenty of water.", "सावधानी से तनु अम्ल (जैसे तनु सल्फ्यूरिक एसिड) से उदासीन करें, फिर खूब पानी से बहाएँ।"],
    sp_sweep: ["Sweep the spilled substance into covered (plastic) containers; carefully collect the remainder.", "गिरे पदार्थ को ढक्कन वाले (प्लास्टिक) कंटेनर में झाड़कर भरें; बचा हुआ सावधानी से उठाएँ।"],
    sp_moist: ["If appropriate, moisten first to prevent dusting.", "धूल न उड़े, इसके लिए ज़रूरत हो तो पहले हल्का गीला करें।"],
    sp_wash: ["Wash away the remainder with plenty of water.", "बचे हुए को खूब पानी से धो दें।"],
    sp_vent: ["Ventilate the area.", "जगह को हवादार करें।"],
    sp_ign: ["Remove all ignition sources.", "आग / चिंगारी के सभी स्रोत हटाएँ।"],
    sp_jet: ["Never direct a water jet on the liquid.", "तरल पर कभी पानी की धार न डालें।"],
    sp_mech: ["Pick up mechanically.", "औज़ार से उठाकर इकट्ठा करें।"],
    sp_disp: ["Store and dispose of according to local regulations.", "स्थानीय नियमों के अनुसार रखें और नष्ट करें।"],
    // handling
    hd_avoid: ["Avoid all contact; prevent generation of mists / dust.", "किसी भी तरह का संपर्क न होने दें; धुंध / धूल न बनने दें।"],
    hd_dilute: ["When diluting, always add it slowly to water - NEVER pour water into it.", "पतला करते समय हमेशा इसे धीरे-धीरे पानी में डालें - इसमें पानी कभी न डालें।"],
    hd_hood: ["Work in a fume hood or with local exhaust.", "फ्यूम हुड या लोकल एग्ज़ॉस्ट में काम करें।"],
    hd_noeat: ["Do not eat, drink or smoke during work; wash hands after handling.", "काम के दौरान खाना-पीना-धूम्रपान न करें; काम के बाद हाथ धोएँ।"],
    hd_noflame: ["No open flames, no sparks, no smoking.", "खुली आग, चिंगारी और धूम्रपान मना।"],
    hd_nocomb: ["Keep away from combustible substances and reducing agents.", "जलने वाली चीज़ों और अपचायक (रिड्यूसिंग) पदार्थों से दूर रखें।"],
    hd_perchlor: ["Avoid friction and shock; use only a fume hood meant for perchloric acid (not one used for other work).", "घर्षण और झटके से बचाएँ; केवल परक्लोरिक एसिड के लिए बने फ्यूम हुड में काम करें।"],
    hd_dust: ["Avoid breathing dust; prevent dispersion of dust.", "धूल में साँस न लें; धूल न फैलने दें।"],
    hd_clothes: ["Do not take working clothes home.", "काम के कपड़े घर न ले जाएँ।"],
    hd_special: ["Obtain special instructions before use; avoid all exposure.", "इस्तेमाल से पहले विशेष निर्देश लें; किसी भी तरह के संपर्क से बचें।"],
    hd_cyl: ["Secure the cylinder upright; open the valve slowly; use the correct regulator.", "सिलेंडर सीधा बाँधकर रखें; वाल्व धीरे खोलें; सही रेगुलेटर लगाएँ।"],
    hd_vent: ["Ensure good ventilation of the work area.", "काम की जगह अच्छी हवादार रखें।"],
    // storage
    st_food: ["Separated from food and feedstuffs.", "खाने-पीने की चीज़ों से अलग।"],
    st_bases: ["Separated from bases (alkalis).", "क्षारों (बेस) से अलग।"],
    st_acids: ["Separated from strong acids.", "तेज़ अम्लों से अलग।"],
    st_metals: ["Separated from metals.", "धातुओं से अलग।"],
    st_comb: ["Separated from combustible substances, reducing agents and organic materials.", "जलने वाले पदार्थ, अपचायक और कार्बनिक पदार्थों से अलग।"],
    st_oxid: ["Separated from strong oxidants.", "तेज़ ऑक्सीडाइज़र से अलग।"],
    st_dry: ["Keep dry and tightly closed.", "सूखा और कसकर बंद रखें।"],
    st_orig: ["Store only in the original container.", "केवल मूल कंटेनर में रखें।"],
    st_cool: ["Store in a cool, dry, well-ventilated place.", "ठंडी, सूखी, हवादार जगह में रखें।"],
    st_drain: ["Store in an area without drain or sewer access.", "ऐसी जगह रखें जहाँ से नाली / सीवर में न जा सके।"],
    st_fire: ["Fireproof storage.", "अग्निरोधी भंडारण।"],
    st_effl: ["Provide for containment of fire-extinguishing effluent.", "आग बुझाने के पानी को रोकने का इंतज़ाम रखें।"],
    st_unbreak: ["Unbreakable packaging; put breakable bottles into a closed unbreakable container.", "न टूटने वाली पैकिंग; टूटने वाली बोतल को बंद, न टूटने वाले डिब्बे में रखें।"],
    st_nofill: ["Do not fill bottles completely; open caps carefully (pressure may build up).", "बोतल पूरी न भरें; ढक्कन सावधानी से खोलें (दबाव बन सकता है)।"],
    st_locked: ["Store locked up.", "ताले में रखें।"],
    st_cyl: ["Store cylinders upright and secured, in a well-ventilated place away from heat, valve cap on.", "सिलेंडर सीधे और बँधे हुए, हवादार जगह पर, गर्मी से दूर, वाल्व कैप लगी रहे।"],
    st_noacid: ["Do not store with acids or oxidising agents.", "अम्लों या ऑक्सीडाइज़र के साथ न रखें।"],
    st_sun: ["Avoid direct sunlight, air contact and moisture.", "सीधी धूप, हवा और नमी से बचाएँ।"],
    // PPE
    pp_face: ["Eyes / face: chemical goggles or face shield (with respiratory protection when vapour / mist / dust is present).", "आँख / चेहरा: केमिकल गॉगल्स या फेस शील्ड (वाष्प / धुंध / धूल हो तो रेस्पिरेटर के साथ)।"],
    pp_glass: ["Eyes: safety glasses with side shields.", "आँख: साइड-शील्ड वाले सेफ्टी चश्मे।"],
    pp_gacid: ["Hands: acid-resistant gloves - check the glove maker's chart for this chemical.", "हाथ: एसिड-रोधी दस्ताने - इस केमिकल के लिए दस्ताने बनाने वाले का चार्ट देखें।"],
    pp_galk: ["Hands: alkali-resistant gloves - check the glove maker's chart for this chemical.", "हाथ: क्षार-रोधी दस्ताने - इस केमिकल के लिए दस्ताने बनाने वाले का चार्ट देखें।"],
    pp_gloves: ["Hands: protective gloves (e.g. nitrile).", "हाथ: सुरक्षात्मक दस्ताने (जैसे नाइट्राइल)।"],
    pp_body: ["Body: protective clothing and apron.", "शरीर: सुरक्षात्मक कपड़े और एप्रन।"],
    pp_fr: ["Body: flame-retardant protective clothing.", "शरीर: अग्निरोधी सुरक्षात्मक कपड़े।"],
    pp_resp: ["Breathing: work in a fume hood; where limits may be exceeded, use a suitable respirator.", "साँस: फ्यूम हुड में काम करें; सीमा से ज़्यादा संपर्क हो तो उपयुक्त रेस्पिरेटर पहनें।"],
    pp_cold: ["Cold-insulating gloves when handling the liquid; ventilation; check oxygen content before entering a closed area.", "तरल संभालते समय ठंड-रोधी दस्ताने; हवादारी; बंद जगह में जाने से पहले ऑक्सीजन जाँचें।"],
    pp_wash: ["Eye-wash and safety shower close to the work area.", "काम की जगह के पास आई-वॉश और सेफ्टी शावर।"]
  };
  const PL = {   // property labels
    app: ["Appearance", "रूप"], odour: ["Odour", "गंध"], mm: ["Molar mass", "मोलर द्रव्यमान"], mp: ["Melting / freezing point", "गलनांक / हिमांक"],
    bp: ["Boiling point", "क्वथनांक"], dec: ["Decomposes at", "विघटन तापमान"], dens: ["Relative density (water = 1)", "सापेक्ष घनत्व (पानी = 1)"],
    sol: ["Solubility in water", "पानी में घुलनशीलता"], vp: ["Vapour pressure", "वाष्प दाब"], vd: ["Relative vapour density (air = 1)", "सापेक्ष वाष्प घनत्व (हवा = 1)"],
    fp: ["Flash point", "फ्लैश पॉइंट"], ait: ["Auto-ignition temperature", "स्वतः ज्वलन तापमान"], expl: ["Explosive limits", "विस्फोटक सीमा"],
    ph: ["pH", "pH"], logp: ["log Pow", "log Pow"]
  };
  const ICSC = n => `ILO/WHO International Chemical Safety Card (ICSC) ${n}`;
  const ACID_FA = { inh: ["fa_air", "fa_halfup", "fa_artresp", "fa_mednow"], skin: ["fa_helpers", "fa_rinse15", "fa_cloth", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_nodrink", "fa_novomit", "fa_mednow"] };
  const ACID_SYM = { inh: ["cough", "sore", "burn", "sob", "labour"], skin: ["red", "pain", "blister", "serburn"], eye: ["red", "pain", "sevburn"], ing: ["mouthburn", "chest", "abd", "vomit", "shock"] };

  // ---------- the 16 chemicals ----------
  const C = [
    { id: "hcl", en: "Hydrochloric acid", hi: "हाइड्रोक्लोरिक एसिड", f: "HCl (aqueous)", syn: "Muriatic acid; hydrogen chloride solution", cas: "7647-01-0", ec: "231-595-7", mm: "36.46 g/mol (HCl)",
      conc: ["Hydrogen chloride in water - concentrated acid about 36 % (up to 38 %; check the bottle label)", "पानी में हाइड्रोजन क्लोराइड - सांद्र एसिड लगभग 36 % (38 % तक; बोतल का लेबल देखें)"],
      sig: "Danger", pict: ["GHS05", "GHS07"], H: ["H290", "H314", "H335"],
      src: [ICSC("0163 (hydrogen chloride, Nov 2016)"), "Harmonised classification H314 + H335 (EU CLP index 017-002-01; Safe Work Australia HCIS)", "NOAA CAMEO Chemicals - hydrochloric acid, solution"],
      fa: ACID_FA, sym: ACID_SYM, faNote: "fa_delay",
      fire: ["fi_noncomb", "fi_fumes"], media: ["fm_surround", "fm_cool"],
      decomp: ["Hydrogen chloride; with oxidants it gives toxic chlorine; with metals it gives flammable hydrogen.", "हाइड्रोजन क्लोराइड; ऑक्सीडाइज़र के साथ ज़हरीली क्लोरीन; धातुओं के साथ ज्वलनशील हाइड्रोजन।"],
      spill: ["sp_evac", "sp_suit", "sp_vent", "sp_liq", "sp_sand", "sp_lime", "sp_noenv", "sp_disp"],
      handle: ["hd_avoid", "hd_hood", "hd_dilute", "hd_noeat"], store: ["st_food", "st_bases", "st_oxid", "st_metals", "st_cool", "st_orig", "st_unbreak"],
      oel: [["ACGIH TLV", "2 ppm (ceiling)"], ["EU-OEL (HCl)", "8 mg/m³ (5 ppm) TWA; 15 mg/m³ (10 ppm) STEL"], ["NIOSH IDLH", "50 ppm"]],
      ppe: ["pp_face", "pp_gacid", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Colourless liquid (aqueous solution)", "रंगहीन द्रव (जलीय घोल)"], ["odour", "Sharp, irritating", "तीखी, जलन वाली"], ["dens", "1.18 (about 36 %)"], ["sol", "Miscible", "पूरी तरह मिल जाता है"]],
      react: ["Strong acid: reacts violently with bases and oxidants (oxidants release toxic chlorine). Attacks many metals, giving flammable / explosive hydrogen. Reacts with carbonates (CO₂), sulfides (H₂S) and cyanides. Mixing with concentrated sulfuric acid can release HCl gas fast.", "तेज़ अम्ल: क्षारों और ऑक्सीडाइज़र से तेज़ अभिक्रिया (ऑक्सीडाइज़र से ज़हरीली क्लोरीन)। कई धातुओं से ज्वलनशील / विस्फोटक हाइड्रोजन बनाता है। कार्बोनेट (CO₂), सल्फाइड (H₂S) और साइनाइड से अभिक्रिया। सांद्र सल्फ्यूरिक एसिड से मिलाने पर तेज़ी से HCl गैस निकल सकती है।"],
      avoid: ["Bases, oxidants, metals, carbonates, sulfides, cyanides.", "क्षार, ऑक्सीडाइज़र, धातुएँ, कार्बोनेट, सल्फाइड, साइनाइड।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; inhaling the vapour or mist may cause asthma-like reactions and lung oedema (may be delayed).", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; वाष्प / धुंध से दमा जैसी प्रतिक्रिया और फेफड़ों में सूजन (देर से भी) हो सकती है।"],
        ["Repeated exposure: tooth erosion, chronic airway inflammation and reduced lung function. Mists of strong inorganic acids are carcinogenic to humans (IARC Group 1).", "बार-बार संपर्क: दाँतों का क्षरण, श्वास नली में पुरानी सूजन, फेफड़ों की क्षमता घटना। तेज़ अकार्बनिक अम्लों की धुंध मनुष्यों में कैंसरकारी (IARC ग्रुप 1)।"]],
      eco: ["Lowers the pH of water - do not let it reach drains or water bodies.", "पानी का pH घटाता है - नाली या जल स्रोत में न जाने दें।"],
      un: { no: "UN 1789", name: "HYDROCHLORIC ACID", cls: "8", pg: "II" } },

    { id: "h2so4", en: "Sulfuric acid", hi: "सल्फ्यूरिक एसिड", f: "H₂SO₄", syn: "Sulphuric acid; oil of vitriol", cas: "7664-93-9", ec: "231-639-5", mm: "98.1 g/mol",
      conc: ["Sulfuric acid, concentrated (above 51 %; laboratory grade usually about 96-98 % - check the label)", "सांद्र सल्फ्यूरिक एसिड (51 % से अधिक; लैब ग्रेड आमतौर पर लगभग 96-98 % - लेबल देखें)"],
      sig: "Danger", pict: ["GHS05", "GHS06"], H: ["H290", "H314", "H330", "H335"], src: [ICSC("0362 (Nov 2016)")],
      fa: ACID_FA, sym: ACID_SYM, faNote: "fa_delay",
      fire: ["fi_noncomb", "fi_react", "fi_fumes"], media: ["fm_nowater", "fm_surround", "fm_cool"],
      decomp: ["Sulfur oxides on heating (decomposes at about 340 °C).", "गर्म करने पर सल्फर ऑक्साइड (लगभग 340 °C पर विघटन)।"],
      spill: ["sp_evac", "sp_suit", "sp_noenv", "sp_nosaw", "sp_liq", "sp_sand", "sp_lime", "sp_disp"],
      handle: ["hd_avoid", "hd_dilute", "hd_hood", "hd_noeat"], store: ["st_food", "st_bases", "st_comb", "st_dry", "st_orig", "st_unbreak"],
      oel: [["ACGIH TLV", "0.2 mg/m³ TWA (thoracic fraction), A2 suspected human carcinogen"], ["EU-OEL", "0.05 mg/m³ TWA"], ["MAK", "0.1 mg/m³ (inhalable fraction)"]],
      ppe: ["pp_face", "pp_gacid", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Colourless, oily, hygroscopic liquid", "रंगहीन, तैलीय, नमी सोखने वाला द्रव"], ["odour", "Odourless", "गंधहीन"], ["mp", "10 °C"], ["dec", "340 °C"], ["dens", "1.8 (20 °C)"],
        ["sol", "Miscible", "पूरी तरह मिल जाता है"], ["vp", "< 10 Pa at 20 °C (negligible)"], ["vd", "3.4"]],
      react: ["Strong acid and strong oxidant: reacts violently with bases, water (great heat), combustible and reducing materials and organic matter. Attacks most common metals, giving flammable hydrogen; attacks many plastics.", "तेज़ अम्ल और तेज़ ऑक्सीडाइज़र: क्षार, पानी (बहुत गर्मी), जलने वाले, अपचायक और कार्बनिक पदार्थों से तेज़ अभिक्रिया। ज़्यादातर धातुओं से ज्वलनशील हाइड्रोजन बनाता है; कई प्लास्टिक को गला देता है।"],
      avoid: ["Bases, water (except slow addition of acid to water), combustibles, reducing agents, organic materials, metals.", "क्षार, पानी (केवल एसिड को धीरे-धीरे पानी में डालना ठीक), जलने वाले, अपचायक, कार्बनिक पदार्थ, धातुएँ।"],
      tox: [["Very corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Mist may cause lung oedema (delayed) and asthma-like reactions; throat swelling may cause suffocation.", "आँख, त्वचा और श्वसन तंत्र के लिए अत्यधिक संक्षारक; निगलने पर भी। धुंध से फेफड़ों में सूजन (देर से) और दमा जैसी प्रतिक्रिया; गले की सूजन से दम घुट सकता है।"],
        ["Repeated contact: dermatitis; lungs may be affected; tooth erosion. Mists of strong inorganic acids are carcinogenic to humans (IARC Group 1).", "बार-बार संपर्क: त्वचा रोग; फेफड़ों पर असर; दाँतों का क्षरण। तेज़ अकार्बनिक अम्लों की धुंध मनुष्यों में कैंसरकारी (IARC ग्रुप 1)।"]],
      eco: ["Harmful to aquatic organisms.", "जलीय जीवों के लिए हानिकारक।"],
      un: { no: "UN 1830", name: "SULPHURIC ACID", cls: "8", pg: "II" } },

    { id: "hno3", en: "Nitric acid", hi: "नाइट्रिक एसिड", f: "HNO₃", syn: "Aqua fortis", cas: "7697-37-2", ec: "231-714-2", mm: "63.0 g/mol",
      conc: ["Nitric acid in water, about 70 % (check the label). Data in this sheet: ICSC 0183 for nitric acid above 70 %.", "पानी में नाइट्रिक एसिड, लगभग 70 % (लेबल देखें)। इस शीट का डेटा: 70 % से अधिक नाइट्रिक एसिड के लिए ICSC 0183।"],
      sig: "Danger", pict: ["GHS03", "GHS05"], H: ["H272", "H290", "H314", "H335"], src: [ICSC("0183 (Nov 2016)")],
      fa: ACID_FA, sym: Object.assign({}, ACID_SYM, { skin: ["pain", "yellow", "serburn"] }), faNote: "fa_delay",
      fire: ["fi_enhance", "fi_fumes", "fi_react"], media: ["fm_nitric", "fm_cool", "fm_nowater"],
      decomp: ["Nitrogen oxides on heating.", "गर्म करने पर नाइट्रोजन ऑक्साइड।"],
      spill: ["sp_evac", "sp_suit", "sp_nosaw", "sp_vent", "sp_liq", "sp_na2co3", "sp_disp"],
      handle: ["hd_avoid", "hd_dilute", "hd_hood", "hd_nocomb", "hd_noeat"], store: ["st_comb", "st_bases", "st_food", "st_cool", "st_orig", "st_unbreak"],
      oel: [["ACGIH TLV", "2 ppm TWA; 4 ppm STEL"], ["EU-OEL", "2.6 mg/m³ (1 ppm) STEL"]],
      ppe: ["pp_face", "pp_gacid", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Colourless to yellow liquid", "रंगहीन से पीला द्रव"], ["odour", "Pungent", "तीखी"], ["bp", "121 °C"], ["mp", "-41.6 °C"], ["dens", "1.4"],
        ["sol", "Miscible", "पूरी तरह मिल जाता है"], ["vp", "6.4 kPa at 20 °C"], ["vd", "2.2"], ["logp", "-0.21"]],
      react: ["Strong oxidant and strong acid: reacts violently with combustible and reducing materials, organic compounds and bases. Corrodes metals, possibly giving flammable hydrogen. Decomposes on heating, giving nitrogen oxides.", "तेज़ ऑक्सीडाइज़र और तेज़ अम्ल: जलने वाले, अपचायक, कार्बनिक पदार्थों और क्षारों से तेज़ अभिक्रिया। धातुओं को गलाता है, ज्वलनशील हाइड्रोजन बन सकती है। गर्म करने पर नाइट्रोजन ऑक्साइड।"],
      avoid: ["Combustibles, reducing agents, organic chemicals, bases, metals, heat.", "जलने वाले, अपचायक, कार्बनिक केमिकल, क्षार, धातुएँ, गर्मी।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Inhalation may cause asthma-like reactions, pneumonitis and lung oedema; harmful air concentrations build up quickly at 20 °C.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। साँस से दमा जैसी प्रतिक्रिया, न्यूमोनाइटिस और फेफड़ों में सूजन; 20 °C पर हवा में जल्दी हानिकारक स्तर बनता है।"],
        ["Repeated exposure: tooth erosion, chronic airway inflammation, reduced lung function. Mists of strong inorganic acids are carcinogenic to humans (IARC Group 1).", "बार-बार संपर्क: दाँतों का क्षरण, श्वास नली में पुरानी सूजन, फेफड़ों की क्षमता घटना। तेज़ अकार्बनिक अम्लों की धुंध कैंसरकारी (IARC ग्रुप 1)।"]],
      eco: ["Lowers the pH of water - keep out of drains and water bodies.", "पानी का pH घटाता है - नाली और जल स्रोत से दूर रखें।"],
      un: { no: "UN 2031", name: "NITRIC ACID", cls: "8", sub: "5.1", pg: "I (above 70 %); II for 65-70 %" },
      notes: [["The smell is not an adequate warning when exposure limits are exceeded.", "सीमा पार होने पर गंध से पर्याप्त चेतावनी नहीं मिलती।"]] },

    { id: "h3po4", en: "Phosphoric acid", hi: "फॉस्फोरिक एसिड", f: "H₃PO₄", syn: "Orthophosphoric acid", cas: "7664-38-2", ec: "231-633-2", mm: "98.0 g/mol",
      conc: ["Phosphoric acid solution in water, usually about 85 % (check the label). ICSC 1008 describes the pure (crystalline) acid.", "पानी में फॉस्फोरिक एसिड का घोल, आमतौर पर लगभग 85 % (लेबल देखें)। ICSC 1008 शुद्ध (क्रिस्टल) एसिड के लिए है।"],
      sig: "Danger", pict: ["GHS05", "GHS07"], H: ["H290", "H314", "H335", "H402"], src: [ICSC("1008 (Nov 2016)")],
      fa: { inh: ["fa_air", "fa_halfup", "fa_artresp", "fa_mednow"], skin: ["fa_helpers", "fa_cloth", "fa_rinse15", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_nodrink", "fa_novomit", "fa_mednow"] },
      sym: ACID_SYM, faNote: "fa_delay",
      fire: ["fi_noncomb", "fi_fumes"], media: ["fm_surround", "fm_cool", "fm_nowater"],
      decomp: ["Toxic fumes on decomposition (above 213 °C); with alcohols, aldehydes, cyanides, sulfides and other organics it gives toxic fumes.", "विघटन (213 °C से ऊपर) पर ज़हरीला धुआँ; अल्कोहल, एल्डिहाइड, साइनाइड, सल्फाइड आदि से ज़हरीली गैसें।"],
      spill: ["sp_ppe", "sp_noenv", "sp_liq", "sp_sand", "sp_neutral", "sp_disp"],
      handle: ["hd_avoid", "hd_dilute", "hd_noeat"], store: ["st_dry", "st_food", "st_bases", "st_drain"],
      oel: [["ACGIH TLV", "1 mg/m³ TWA; 3 mg/m³ STEL"], ["EU-OEL", "1 mg/m³ TWA; 2 mg/m³ STEL"]],
      ppe: ["pp_face", "pp_gacid", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "85 % solution: colourless, syrupy liquid (pure acid: hygroscopic colourless crystals)", "85 % घोल: रंगहीन, गाढ़ा द्रव (शुद्ध एसिड: रंगहीन क्रिस्टल)"], ["dens", "1.70 (85 % solution)"], ["mp", "42 °C (pure acid)"], ["dec", "213 °C"], ["sol", "Miscible", "पूरी तरह मिल जाता है"], ["vp", "< 10 Pa at 25 °C (negligible)"]],
      react: ["Medium-strong acid: reacts violently with bases. Violent polymerisation with azo compounds and epoxides. Attacks many metals, giving flammable hydrogen.", "मध्यम-तेज़ अम्ल: क्षारों से तेज़ अभिक्रिया। एज़ो यौगिक और एपॉक्साइड के साथ तेज़ बहुलीकरण। कई धातुओं से ज्वलनशील हाइड्रोजन बनाता है।"],
      avoid: ["Bases, metals, azo compounds, epoxides, cyanides, sulfides.", "क्षार, धातुएँ, एज़ो यौगिक, एपॉक्साइड, साइनाइड, सल्फाइड।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Inhalation may cause asthma-like reactions and delayed lung oedema.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। साँस से दमा जैसी प्रतिक्रिया और देर से फेफड़ों में सूजन।"],
        ["Repeated exposure may affect the upper airways and lungs (chronic inflammation, reduced lung function).", "बार-बार संपर्क से ऊपरी श्वास नली और फेफड़ों पर असर (पुरानी सूजन, क्षमता घटना)।"]],
      eco: ["Harmful to aquatic organisms.", "जलीय जीवों के लिए हानिकारक।"],
      un: { no: "UN 1805", name: "PHOSPHORIC ACID, SOLUTION", cls: "8", pg: "III" } },

    { id: "hclo4", en: "Perchloric acid", hi: "परक्लोरिक एसिड", f: "HClO₄", syn: "Perchloric acid 70 %", cas: "7601-90-3", ec: "231-512-4", mm: "100.46 g/mol",
      conc: ["Perchloric acid about 70 %, water about 30 %", "परक्लोरिक एसिड लगभग 70 %, पानी लगभग 30 %"],
      sig: "Danger", pict: ["GHS03", "GHS05", "GHS07", "GHS08"], H: ["H271", "H290", "H302", "H314", "H373"],
      src: [ICSC("1006 (72 % solution, Apr 2000)"), "Loba Chemie Pvt. Ltd. (Mumbai) SDS - Perchloric acid 70 % AcıPUR, product 0241F (GHS label)"],
      fa: { inh: ["fa_air", "fa_halfup", "fa_artresp", "fa_mednow"], skin: ["fa_cloth", "fa_rinse15", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_mednow"] },
      sym: { inh: ["sore", "burn", "cough", "labour"], skin: ["red", "pain", "serburn"], eye: ["red", "pain", "vision", "deepburn"], ing: ["sore", "abd", "burn", "diarr", "shock", "vomit"] }, faNote: "fa_delay",
      fire: ["fi_enhance", "fi_perchlor", "fi_fumes"], media: ["fm_largewater", "fm_cool", "fm_shelter"],
      decomp: ["Toxic and corrosive fumes on heating.", "गर्म करने पर ज़हरीला और संक्षारक धुआँ।"],
      spill: ["sp_evac", "sp_suit", "sp_nosaw", "sp_sand", "sp_neutral", "sp_noenv", "sp_disp"],
      handle: ["hd_perchlor", "hd_avoid", "hd_dilute", "hd_nocomb", "hd_noeat"], store: ["st_fire", "st_comb", "st_metals", "st_dry", "st_unbreak"],
      oel: [["Exposure limits", "None listed on ICSC 1006 or the Loba Chemie SDS - keep exposure as low as possible"]],
      ppe: ["pp_face", "pp_gacid", "pp_fr", "pp_resp", "pp_wash"],
      props: [["app", "Clear, colourless liquid", "साफ़, रंगहीन द्रव"], ["odour", "Odourless (Loba) / pungent (ICSC)", "गंधहीन (लोबा) / तीखी (ICSC)"], ["mp", "-18 °C (freezing, 70 %)"], ["bp", "203 °C"],
        ["dens", "1.68 (20 °C)"], ["sol", "Miscible", "पूरी तरह मिल जाता है"], ["vp", "9 hPa at 20 °C"], ["ph", "< 1"]],
      react: ["Strong oxidant; extreme risk of explosion by shock, friction, fire or other ignition sources. Above 72 % it is unstable and may explode by shock when dry or drying. Reacts violently with combustibles, reducing agents, organic materials and strong bases; attacks many metals, giving flammable hydrogen.", "तेज़ ऑक्सीडाइज़र; झटके, घर्षण, आग से विस्फोट का बहुत खतरा। 72 % से ऊपर अस्थिर - सूखने पर झटके से फट सकता है। जलने वाले, अपचायक, कार्बनिक पदार्थ और तेज़ क्षार से तेज़ अभिक्रिया; धातुओं से ज्वलनशील हाइड्रोजन।"],
      avoid: ["Heat, sparks, open flame, combustible materials (paper, wood, cloth), organic matter, metals, strong bases.", "गर्मी, चिंगारी, खुली आग, जलने वाली चीज़ें (कागज़, लकड़ी, कपड़ा), कार्बनिक पदार्थ, धातुएँ, तेज़ क्षार।"],
      tox: [["Corrosive to eyes, skin and respiratory tract. Vapour or mist may cause lung oedema (may be delayed). Harmful if swallowed (oral ATE 500 mg/kg, Loba SDS).", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक। वाष्प / धुंध से फेफड़ों में सूजन (देर से भी)। निगलने पर हानिकारक (ओरल ATE 500 mg/kg, लोबा SDS)।"],
        ["May cause damage to organs through prolonged or repeated exposure (Loba SDS: H373).", "लंबे या बार-बार संपर्क से अंगों को नुकसान हो सकता है (लोबा SDS: H373)।"]],
      eco: ["Harmful to aquatic organisms.", "जलीय जीवों के लिए हानिकारक।"],
      un: { no: "UN 1873", name: "PERCHLORIC ACID", cls: "5.1", sub: "8", pg: "I" } },

    { id: "acetic", en: "Acetic acid, glacial", hi: "एसिटिक एसिड (ग्लेशियल)", f: "CH₃COOH", syn: "Ethanoic acid", cas: "64-19-7", ec: "200-580-7", mm: "60.1 g/mol",
      conc: ["Glacial acetic acid, about 99.5 %", "ग्लेशियल एसिटिक एसिड, लगभग 99.5 %"],
      sig: "Danger", pict: ["GHS02", "GHS05", "GHS07", "GHS08"], H: ["H226", "H303", "H312+H332", "H314", "H335", "H372", "H402"],
      Hx: { H372: ["Causes damage to the respiratory tract through prolonged or repeated exposure if inhaled.", "लंबे या बार-बार साँस से संपर्क पर श्वसन तंत्र को नुकसान पहुँचाता है।"] },
      src: [ICSC("0363 (May 2010)")],
      fa: { inh: ["fa_air", "fa_halfup", "fa_mednow"], skin: ["fa_cloth", "fa_rinse15", "fa_soap", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_smallwater", "fa_mednow"] },
      sym: { inh: ["sore", "cough", "burn", "headache", "dizzy", "sob", "labour"], skin: ["pain", "red", "skinburn", "blister"], eye: ["red", "pain", "sevburn", "vision"], ing: ["sore", "burn", "abd", "vomit", "shock"] },
      fire: ["fi_flam", "fi_fumes"], media: ["fm_acetic", "fm_cool"],
      decomp: ["Irritating or toxic fumes in a fire.", "आग में जलन वाला या ज़हरीला धुआँ।"],
      spill: ["sp_ign", "sp_suit", "sp_noenv", "sp_liq", "sp_na2co3", "sp_disp"],
      handle: ["hd_noflame", "hd_hood", "hd_avoid", "hd_noeat"], store: ["st_fire", "st_food", "st_oxid", "st_acids", "st_bases", "st_orig", "st_cool", "st_drain"],
      oel: [["ACGIH TLV", "10 ppm TWA; 15 ppm STEL"], ["EU-OEL", "25 mg/m³ (10 ppm) TWA; 50 mg/m³ (20 ppm) STEL"]],
      ppe: ["pp_face", "pp_gacid", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Colourless liquid", "रंगहीन द्रव"], ["odour", "Pungent (vinegar-like)", "तीखी (सिरके जैसी)"], ["bp", "118 °C"], ["mp", "16.7 °C"], ["dens", "1.05"], ["sol", "Miscible", "पूरी तरह मिल जाता है"],
        ["vp", "1.5 kPa at 20 °C"], ["vd", "2.1"], ["fp", "39 °C (closed cup)"], ["ait", "485 °C"], ["expl", "6.0-17 vol % in air"], ["logp", "-0.17"]],
      react: ["Weak acid. Reacts violently with strong oxidants, strong acids, strong bases and many other compounds, causing fire and explosion hazard. Attacks some plastics, rubber and coatings.", "कमज़ोर अम्ल। तेज़ ऑक्सीडाइज़र, तेज़ अम्ल, तेज़ क्षार और कई यौगिकों से तेज़ अभिक्रिया - आग और विस्फोट का खतरा। कुछ प्लास्टिक, रबर और कोटिंग को गलाता है।"],
      avoid: ["Heat, flames and sparks (flash point 39 °C), strong oxidants, strong acids, strong bases.", "गर्मी, आग, चिंगारी (फ्लैश पॉइंट 39 °C), तेज़ ऑक्सीडाइज़र, तेज़ अम्ल, तेज़ क्षार।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Inhalation may cause lung oedema after initial corrosive effects. Harmful air concentrations build up quickly on evaporation at 20 °C.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। साँस से फेफड़ों में सूजन हो सकती है। 20 °C पर वाष्पीकरण से हवा में जल्दी हानिकारक स्तर।"],
        ["Repeated or prolonged skin contact may cause dermatitis; repeated exposure to aerosols may affect the lungs and cause tooth erosion.", "बार-बार त्वचा संपर्क से त्वचा रोग; बार-बार धुंध से फेफड़ों पर असर और दाँतों का क्षरण।"]],
      eco: ["Harmful to aquatic organisms.", "जलीय जीवों के लिए हानिकारक।"],
      un: { no: "UN 2789", name: "ACETIC ACID, GLACIAL", cls: "8", sub: "3", pg: "II" } },

    { id: "naoh", en: "Sodium hydroxide", hi: "सोडियम हाइड्रॉक्साइड", f: "NaOH", syn: "Caustic soda; soda lye", cas: "1310-73-2", ec: "215-185-5", mm: "40.0 g/mol",
      conc: ["Sodium hydroxide, solid (pellets / flakes), about 97-100 % as supplied (check label)", "सोडियम हाइड्रॉक्साइड, ठोस (गोलियाँ / परत), लगभग 97-100 % (लेबल देखें)"],
      sig: "Danger", pict: ["GHS05", "GHS07"], H: ["H302", "H314", "H335"], src: [ICSC("0360 (May 2010)")],
      fa: { inh: ["fa_air", "fa_mednow"], skin: ["fa_cloth", "fa_rinse15", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_smallwater", "fa_mednow"] },
      sym: { inh: ["cough", "sore", "burn", "sob"], skin: ["red", "pain", "serburn", "blister"], eye: ["red", "pain", "blur", "sevburn"], ing: ["abd", "mouthburn", "chest", "nausea", "vomit", "shock"] },
      fire: ["fi_noncomb", "fi_waterheat"], media: ["fm_surround"],
      decomp: ["Not combustible; with water / moisture it gives much heat.", "ज्वलनशील नहीं; पानी / नमी से बहुत गर्मी।"],
      spill: ["sp_suit", "sp_noenv", "sp_sweep", "sp_disp"],
      handle: ["hd_avoid", "hd_dust", "hd_dilute", "hd_noeat"], store: ["st_food", "st_acids", "st_metals", "st_dry", "st_orig", "st_drain"],
      oel: [["ACGIH TLV", "2 mg/m³ (ceiling)"]],
      ppe: ["pp_face", "pp_galk", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "White, hygroscopic solid (pellets, flakes)", "सफ़ेद, नमी सोखने वाला ठोस (गोलियाँ, परत)"], ["mp", "318 °C"], ["bp", "1388 °C"], ["dens", "2.1"], ["sol", "109 g / 100 mL at 20 °C (very good)"]],
      react: ["The solution in water is a strong base: reacts violently with acids and corrodes aluminium, tin, lead and zinc, giving flammable / explosive hydrogen. Reacts with ammonium salts, giving ammonia. Dissolving in water gives much heat.", "पानी में घोल तेज़ क्षार है: अम्लों से तेज़ अभिक्रिया; एल्युमिनियम, टिन, लेड, ज़िंक को गलाकर ज्वलनशील / विस्फोटक हाइड्रोजन बनाता है। अमोनियम लवणों से अमोनिया। पानी में घोलने पर बहुत गर्मी।"],
      avoid: ["Acids, metals (Al, Zn, Sn, Pb), ammonium salts, moisture.", "अम्ल, धातुएँ (Al, Zn, Sn, Pb), अमोनियम लवण, नमी।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Harmful dust concentrations build up quickly when dispersed.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। धूल फैलने पर हवा में जल्दी हानिकारक स्तर।"],
        ["Repeated or prolonged skin contact may cause dermatitis.", "बार-बार या लंबे त्वचा संपर्क से त्वचा रोग।"]],
      eco: ["May be hazardous to the environment; special attention to aquatic organisms (raises pH).", "पर्यावरण के लिए खतरनाक हो सकता है; जलीय जीवों पर विशेष ध्यान (pH बढ़ाता है)।"],
      un: { no: "UN 1823", name: "SODIUM HYDROXIDE, SOLID", cls: "8", pg: "II" },
      notes: [["Solution: UN 1824 SODIUM HYDROXIDE SOLUTION, class 8, PG II or III.", "घोल: UN 1824 सोडियम हाइड्रॉक्साइड सॉल्यूशन, क्लास 8, PG II या III।"]] },

    { id: "koh", en: "Potassium hydroxide", hi: "पोटैशियम हाइड्रॉक्साइड", f: "KOH", syn: "Caustic potash", cas: "1310-58-3", ec: "215-181-3", mm: "56.1 g/mol",
      conc: ["Potassium hydroxide, solid (pellets / flakes), about 85 % or more as supplied (check label)", "पोटैशियम हाइड्रॉक्साइड, ठोस (गोलियाँ / परत), लगभग 85 % या अधिक (लेबल देखें)"],
      sig: "Danger", pict: ["GHS05", "GHS07"], H: ["H302", "H314", "H335"], src: [ICSC("0357 (May 2010)")],
      fa: { inh: ["fa_air", "fa_mednow"], skin: ["fa_cloth", "fa_rinse15", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_smallwater", "fa_mednow"] },
      sym: { inh: ["cough", "sore", "burn", "sob"], skin: ["red", "pain", "serburn", "blister"], eye: ["red", "pain", "blur", "sevburn"], ing: ["abd", "mouthburn", "chest", "nausea", "vomit", "shock"] },
      fire: ["fi_noncomb", "fi_waterheat"], media: ["fm_surround"],
      decomp: ["Not combustible; with water / moisture it gives much heat.", "ज्वलनशील नहीं; पानी / नमी से बहुत गर्मी।"],
      spill: ["sp_suit", "sp_noenv", "sp_sweep", "sp_disp"],
      handle: ["hd_avoid", "hd_dust", "hd_dilute", "hd_noeat"], store: ["st_food", "st_acids", "st_metals", "st_dry", "st_orig", "st_drain"],
      oel: [["ACGIH TLV", "2 mg/m³ (ceiling)"]],
      ppe: ["pp_face", "pp_galk", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "White, hygroscopic solid (pellets, flakes)", "सफ़ेद, नमी सोखने वाला ठोस (गोलियाँ, परत)"], ["mp", "380 °C"], ["bp", "1324 °C"], ["dens", "2.04"], ["sol", "110 g / 100 mL at 25 °C (very good)"]],
      react: ["The solution in water is a strong base: reacts violently with acids and corrodes aluminium, tin, lead and zinc, giving flammable / explosive hydrogen. Reacts with ammonium salts, giving ammonia.", "पानी में घोल तेज़ क्षार है: अम्लों से तेज़ अभिक्रिया; एल्युमिनियम, टिन, लेड, ज़िंक को गलाकर ज्वलनशील / विस्फोटक हाइड्रोजन बनाता है। अमोनियम लवणों से अमोनिया।"],
      avoid: ["Acids, metals (Al, Zn, Sn, Pb), ammonium salts, moisture.", "अम्ल, धातुएँ (Al, Zn, Sn, Pb), अमोनियम लवण, नमी।"],
      tox: [["Very corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Harmful dust concentrations build up quickly when dispersed.", "आँख, त्वचा और श्वसन तंत्र के लिए अत्यधिक संक्षारक; निगलने पर भी। धूल फैलने पर हवा में जल्दी हानिकारक स्तर।"],
        ["Repeated or prolonged skin contact may cause dermatitis.", "बार-बार या लंबे त्वचा संपर्क से त्वचा रोग।"]],
      eco: ["May be hazardous to the environment; special attention to aquatic organisms (raises pH).", "पर्यावरण के लिए खतरनाक हो सकता है; जलीय जीवों पर विशेष ध्यान (pH बढ़ाता है)।"],
      un: { no: "UN 1813", name: "POTASSIUM HYDROXIDE, SOLID", cls: "8", pg: "II" },
      notes: [["Solution: UN 1814 POTASSIUM HYDROXIDE SOLUTION, class 8, PG II or III.", "घोल: UN 1814 पोटैशियम हाइड्रॉक्साइड सॉल्यूशन, क्लास 8, PG II या III।"]] },

    { id: "nh3", en: "Ammonia solution", hi: "अमोनिया सॉल्यूशन", f: "NH₄OH (NH₃ in water)", syn: "Ammonium hydroxide; liquor ammonia; aqua ammonia", cas: "1336-21-6", ec: "215-647-6", mm: "35.1 g/mol (NH₄OH)",
      conc: ["Ammonia in water, 10-35 % NH₃ (laboratory liquor ammonia usually about 25-30 %; check the label)", "पानी में अमोनिया, 10-35 % NH₃ (लैब लिकर अमोनिया आमतौर पर लगभग 25-30 %; लेबल देखें)"],
      sig: "Danger", pict: ["GHS05", "GHS07", "GHS09"], H: ["H290", "H302", "H314", "H335", "H400"], src: [ICSC("0215 (May 2018)")],
      fa: { inh: ["fa_air", "fa_artresp", "fa_med"], skin: ["fa_cloth", "fa_rinse15", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_water12", "fa_med"] },
      sym: { inh: ["cough", "sore", "burn", "labour"], skin: ["red", "pain", "blister", "serburn"], eye: ["red", "pain", "blur", "sevburn"], ing: ["sore", "vomit", "abd"] },
      fire: ["fi_noncomb", "fi_fumes"], media: ["fm_surround", "fm_cool"],
      decomp: ["Ammonia and nitrogen oxides on heating; ammonia vapour can be flammable under certain conditions.", "गर्म करने पर अमोनिया और नाइट्रोजन ऑक्साइड; कुछ स्थितियों में अमोनिया वाष्प ज्वलनशील।"],
      spill: ["sp_evac", "sp_suit", "sp_vent", "sp_noenv", "sp_dilacid", "sp_disp"],
      handle: ["hd_hood", "hd_avoid", "hd_noeat"], store: ["st_food", "st_acids", "st_cool", "st_drain", "st_effl", "st_nofill", "st_unbreak"],
      oel: [["ACGIH TLV (ammonia)", "18 mg/m³ (25 ppm) TWA; 27 mg/m³ STEL"], ["MAK", "14 mg/m³ (20 ppm)"]],
      ppe: ["pp_face", "pp_galk", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Very volatile, colourless solution", "बहुत वाष्पशील, रंगहीन घोल"], ["odour", "Pungent (ammonia)", "तीखी (अमोनिया)"], ["bp", "38 °C (25 %)"], ["mp", "-58 °C (25 %)"], ["dens", "0.9 (25 %)"],
        ["sol", "Miscible", "पूरी तरह मिल जाता है"], ["vp", "48 kPa at 20 °C (25 %)"], ["vd", "0.6"]],
      react: ["Reacts violently with acids. Forms explosive compounds with many heavy metals and their salts (e.g. silver, mercury). Attacks many metals, giving flammable hydrogen. Ammonia gas evolves from the solution.", "अम्लों से तेज़ अभिक्रिया। कई भारी धातुओं और उनके लवणों (जैसे सिल्वर, मर्करी) से विस्फोटक यौगिक बनाता है। कई धातुओं से ज्वलनशील हाइड्रोजन। घोल से अमोनिया गैस निकलती है।"],
      avoid: ["Acids, heavy-metal salts (silver, mercury), heat.", "अम्ल, भारी धातुओं के लवण (सिल्वर, मर्करी), गर्मी।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. High vapour levels may cause laryngeal oedema, inflammation of the airways and pneumonia; effects may be delayed.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। ज़्यादा वाष्प से गले में सूजन, श्वास नली में सूजन और निमोनिया; असर देर से भी।"],
        ["Repeated or prolonged inhalation may affect the lungs.", "बार-बार या लंबे समय तक साँस से फेफड़ों पर असर।"]],
      eco: ["Very toxic to aquatic organisms.", "जलीय जीवों के लिए अत्यधिक विषैला।"],
      un: { no: "UN 2672", name: "AMMONIA SOLUTION (10-35 % ammonia)", cls: "8", pg: "III" } },

    { id: "kmno4", en: "Potassium permanganate", hi: "पोटैशियम परमैंगनेट", f: "KMnO₄", syn: "Permanganic acid, potassium salt", cas: "7722-64-7", ec: "231-760-3", mm: "158.0 g/mol",
      conc: ["Potassium permanganate, solid, 99 % or more (AR grade; check label)", "पोटैशियम परमैंगनेट, ठोस, 99 % या अधिक (AR ग्रेड; लेबल देखें)"],
      sig: "Danger", pict: ["GHS03", "GHS05", "GHS07", "GHS08", "GHS09"], H: ["H272", "H302", "H314", "H361", "H400"], src: [ICSC("0672 (Nov 2016)")],
      fa: { inh: ["fa_air", "fa_halfup", "fa_artresp", "fa_mednow"], skin: ["fa_helpers", "fa_rinse15", "fa_cloth", "fa_med"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_smallwater", "fa_novomit", "fa_mednow"] },
      sym: { inh: ["burn", "cough", "sore", "sob", "labour"], skin: ["red", "skinburn", "pain"], eye: ["red", "pain", "sevburn"], ing: ["burn", "abd", "diarr", "nausea", "vomit", "shock"] },
      fire: ["fi_enhance", "fi_fumes"], media: ["fm_surround"],
      decomp: ["Toxic and irritating fumes on heating (decomposes at 240 °C).", "गर्म करने पर ज़हरीला और जलन वाला धुआँ (240 °C पर विघटन)।"],
      spill: ["sp_suit", "sp_noenv", "sp_sweep", "sp_nosaw", "sp_disp"],
      handle: ["hd_dust", "hd_nocomb", "hd_special", "hd_noeat"], store: ["st_comb", "st_metals", "st_dry", "st_effl", "st_drain"],
      oel: [["ACGIH TLV (as Mn)", "0.02 mg/m³ respirable; 0.1 mg/m³ inhalable (TWA)"], ["EU-OEL (as Mn)", "0.05 mg/m³ respirable; 0.2 mg/m³ inhalable (TWA)"]],
      ppe: ["pp_face", "pp_gloves", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Dark purple crystals", "गहरे बैंगनी क्रिस्टल"], ["dec", "240 °C"], ["dens", "2.7"], ["sol", "6.4 g / 100 mL at 20 °C (moderate)"], ["vp", "Negligible at 20 °C"], ["logp", "1.73 (calculated)"]],
      react: ["Strong oxidant: reacts with combustible and reducing materials, causing fire and explosion hazard. Decomposes on heating, giving toxic fumes.", "तेज़ ऑक्सीडाइज़र: जलने वाले और अपचायक पदार्थों से अभिक्रिया - आग और विस्फोट का खतरा। गर्म करने पर ज़हरीला धुआँ।"],
      avoid: ["Combustible substances, reducing agents, powdered metals, organic matter (e.g. glycerol), concentrated acids.", "जलने वाले पदार्थ, अपचायक, धातु पाउडर, कार्बनिक पदार्थ (जैसे ग्लिसरॉल), सांद्र अम्ल।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. Dust inhalation may cause lung oedema after initial corrosive effects; effects may be delayed.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। धूल से फेफड़ों में सूजन हो सकती है; असर देर से भी।"],
        ["May affect the lungs (bronchitis, pneumonia). Animal tests show possible toxic effects on human reproduction or development.", "फेफड़ों पर असर (ब्रोंकाइटिस, निमोनिया)। पशु परीक्षणों में मानव प्रजनन / विकास पर असर संभव।"]],
      eco: ["Very toxic to aquatic organisms. Marine pollutant.", "जलीय जीवों के लिए अत्यधिक विषैला। समुद्री प्रदूषक।"],
      un: { no: "UN 1490", name: "POTASSIUM PERMANGANATE", cls: "5.1", pg: "II" } },

    { id: "k2cr2o7", en: "Potassium dichromate", hi: "पोटैशियम डाइक्रोमेट", f: "K₂Cr₂O₇", syn: "Potassium bichromate", cas: "7778-50-9", ec: "231-906-6", mm: "294.2 g/mol",
      conc: ["Potassium dichromate, solid, 99 % or more (AR grade; check label). Contains hexavalent chromium, Cr(VI).", "पोटैशियम डाइक्रोमेट, ठोस, 99 % या अधिक (AR ग्रेड; लेबल देखें)। इसमें हेक्सावैलेंट क्रोमियम Cr(VI) है।"],
      sig: "Danger", pict: ["GHS03", "GHS06", "GHS05", "GHS08", "GHS09"], H: ["H272", "H301", "H312", "H330", "H314", "H334", "H317", "H340", "H350", "H360", "H370", "H372", "H410"],
      Hx: { H372: ["Causes damage to the nose through prolonged or repeated exposure if inhaled.", "लंबे या बार-बार साँस से संपर्क पर नाक को नुकसान पहुँचाता है।"] },
      src: [ICSC("1371 (Apr 2013)")],
      fa: { inh: ["fa_air", "fa_halfup", "fa_artresp", "fa_med"], skin: ["fa_rinse15", "fa_cloth", "fa_med"], eye: ["fa_eye", "fa_med"], ing: ["fa_mouth", "fa_novomit", "fa_water12", "fa_med"] },
      sym: { inh: ["burn", "sore", "cough", "wheeze", "labour"], skin: ["red", "pain", "skinburn"], eye: ["red", "pain", "blur", "deepburn"], ing: ["nausea", "vomit", "abd", "burn", "diarr", "shock"] },
      fire: ["fi_enhance"], media: ["fm_surround"],
      decomp: ["Strong oxidant; decomposes at 500 °C.", "तेज़ ऑक्सीडाइज़र; 500 °C पर विघटन।"],
      spill: ["sp_suit", "sp_sweep", "sp_moist", "sp_nosaw", "sp_noenv", "sp_disp"],
      handle: ["hd_special", "hd_dust", "hd_hood", "hd_nocomb", "hd_clothes", "hd_noeat"], store: ["st_locked", "st_comb", "st_food", "st_effl", "st_drain", "st_dry"],
      oel: [["ACGIH TLV (as Cr(VI), inhalable)", "0.0002 mg/m³ TWA; 0.0005 mg/m³ STEL; A1 confirmed human carcinogen; skin, DSEN, RSEN"], ["EU-OEL (as Cr)", "0.005 mg/m³ TWA"]],
      ppe: ["pp_face", "pp_gloves", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Orange-red crystals", "नारंगी-लाल क्रिस्टल"], ["mp", "398 °C"], ["dec", "500 °C"], ["dens", "2.7"], ["sol", "12 g / 100 mL at 20 °C (moderate)"]],
      react: ["Strong oxidant: reacts with combustible and reducing materials. The solution in water is a weak acid.", "तेज़ ऑक्सीडाइज़र: जलने वाले और अपचायक पदार्थों से अभिक्रिया। पानी में घोल कमज़ोर अम्ल।"],
      avoid: ["Combustible substances, reducing agents, organic matter.", "जलने वाले पदार्थ, अपचायक, कार्बनिक पदार्थ।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. May affect the kidneys and liver (tissue lesions). Fatal if inhaled; toxic if swallowed.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। किडनी और लिवर पर असर। साँस से जानलेवा; निगलने पर विषैला।"],
        ["Carcinogenic to humans; may cause genetic defects; may damage fertility or the unborn child. May cause skin sensitisation and asthma; nasal ulceration (perforated septum); kidney impairment.", "मनुष्यों में कैंसरकारी; आनुवंशिक दोष; प्रजनन क्षमता / गर्भस्थ शिशु को नुकसान। त्वचा एलर्जी और दमा; नाक में छाले (परदे में छेद); किडनी कमज़ोर होना।"]],
      eco: ["Very toxic to aquatic organisms, with long-lasting effects. Do not let it enter the environment.", "जलीय जीवों के लिए अत्यधिक विषैला, लंबे समय तक असर। पर्यावरण में न जाने दें।"],
      un: { no: "UN 3288", name: "TOXIC SOLID, INORGANIC, N.O.S. (potassium dichromate)", cls: "6.1", pg: "II" },
      notes: [["Anyone who has shown asthma symptoms from this substance should avoid all further contact. Asthma symptoms often appear only after a few hours.", "जिसे इस पदार्थ से दमा के लक्षण हुए हों, वह आगे कोई संपर्क न करे। दमा के लक्षण अक्सर कुछ घंटों बाद दिखते हैं।"]] },

    { id: "thio", en: "Sodium thiosulfate pentahydrate", hi: "सोडियम थायोसल्फेट पेंटाहाइड्रेट", f: "Na₂S₂O₃·5H₂O", syn: "Sodium hyposulphite; hypo", cas: "10102-17-7", ec: "231-867-5", mm: "248.2 g/mol",
      conc: ["Sodium thiosulfate pentahydrate, solid (AR / ACS grade; check label)", "सोडियम थायोसल्फेट पेंटाहाइड्रेट, ठोस (AR / ACS ग्रेड; लेबल देखें)"],
      sig: "", pict: [], H: [], notClass: true,
      src: ["Thermo Fisher Scientific (Alfa Aesar) SDS - Sodium thiosulfate pentahydrate, ACS, stock 14518"],
      fa: { inh: ["fa_air", "fa_artresp", "fa_unwell"], skin: ["fa_soap"], eye: ["fa_eyerun", "fa_unwell"], ing: ["fa_mouth", "fa_unwell"] },
      sym: { skin: ["red"], eye: ["red"] },
      fire: ["fi_noncomb"], media: ["fm_surround", "fm_scba"],
      decomp: ["Sulfur oxides and sodium oxide.", "सल्फर ऑक्साइड और सोडियम ऑक्साइड।"],
      spill: ["sp_ppe", "sp_vent", "sp_mech", "sp_noenv", "sp_disp"],
      handle: ["hd_vent", "hd_noeat"], store: ["st_dry", "st_cool", "st_noacid"],
      oel: [["Exposure limits", "No occupational exposure limit values listed in the supplier SDS"]],
      ppe: ["pp_glass", "pp_gloves", "pp_body"],
      props: [["app", "Colourless crystalline solid", "रंगहीन क्रिस्टलीय ठोस"], ["odour", "Odourless", "गंधहीन"], ["ph", "6.5-8 (100 g/L, 20 °C)"], ["mp", "48 °C"],
        ["bp", "100 °C (loses its 5 H₂O)"], ["dens", "1.69 (20 °C)"], ["sol", "680 g/L at 20 °C"]],
      react: ["Stable under recommended storage. Reacts with strong oxidising agents; with acids it releases sulfur dioxide and sulfur.", "सही भंडारण में स्थिर। तेज़ ऑक्सीडाइज़र से अभिक्रिया; अम्लों से सल्फर डाइऑक्साइड और सल्फर निकलता है।"],
      avoid: ["Acids, strong oxidising agents.", "अम्ल, तेज़ ऑक्सीडाइज़र।"],
      tox: [["Not classified as hazardous by the supplier. May cause skin and eye irritation.", "सप्लायर के अनुसार खतरनाक वर्गीकृत नहीं। त्वचा और आँख में जलन हो सकती है।"], ["No known sensitising, mutagenic, reproductive or target-organ effects (supplier SDS).", "कोई ज्ञात एलर्जी, म्यूटाजेनिक, प्रजनन या अंग-विशेष असर नहीं (सप्लायर SDS)।"]],
      eco: ["Avoid release to the environment.", "पर्यावरण में न छोड़ें।"],
      un: null },

    { id: "fas", en: "Ammonium iron(II) sulfate hexahydrate", hi: "फेरस अमोनियम सल्फेट (मोहर लवण)", f: "(NH₄)₂Fe(SO₄)₂·6H₂O", syn: "Ferrous ammonium sulphate (FAS); Mohr's salt", cas: "7783-85-9", ec: "233-151-8", mm: "392.13 g/mol",
      conc: ["Ammonium iron(II) sulfate hexahydrate, solid (AR / ACS grade; check label)", "फेरस अमोनियम सल्फेट हेक्साहाइड्रेट, ठोस (AR / ACS ग्रेड; लेबल देखें)"],
      sig: "", pict: [], H: [], notClass: true,
      src: ["Labbox Labware S.L. SDS - Ammonium iron(II) sulfate hexahydrate, analytical grade (AMIS-06A), version 2.5"],
      fa: { inh: ["fa_air", "fa_unwell"], skin: ["fa_soap", "fa_unwell"], eye: ["fa_eye", "fa_med"], ing: ["fa_mouth", "fa_novomit", "fa_unwell"] },
      sym: { inh: ["cough"], skin: ["red"], eye: ["red", "pain"] },
      fire: ["fi_noncomb", "fi_fumes"], media: ["fm_surround", "fm_scba"],
      decomp: ["Toxic fumes may be released in a fire.", "आग में ज़हरीला धुआँ निकल सकता है।"],
      spill: ["sp_ppe", "sp_vent", "sp_sweep", "sp_noenv", "sp_disp"],
      handle: ["hd_dust", "hd_vent", "hd_noeat"], store: ["st_dry", "st_cool", "st_sun"],
      oel: [["Exposure limits", "No occupational exposure limit values listed in the supplier SDS"]],
      ppe: ["pp_glass", "pp_gloves", "pp_body"],
      props: [["app", "Blue-green powder or crystals", "नीले-हरे पाउडर या क्रिस्टल"], ["odour", "Odourless", "गंधहीन"], ["mp", "About 100 °C"], ["ph", "3-5 (5 % solution, 20 °C)"], ["dens", "1.86 (20 °C)"], ["sol", "26.9 g / 100 mL at 20 °C"]],
      react: ["Stable under normal conditions. Slowly oxidised by air (iron(II) to iron(III)) - keep the bottle closed.", "सामान्य स्थिति में स्थिर। हवा से धीरे-धीरे ऑक्सीकृत (आयरन II से III) - बोतल बंद रखें।"],
      avoid: ["Direct sunlight, air contact, moisture.", "सीधी धूप, हवा, नमी।"],
      tox: [["Not classified as hazardous under EU CLP by the supplier. Dust may irritate the skin, eyes and respiratory tract.", "सप्लायर के अनुसार EU CLP में खतरनाक वर्गीकृत नहीं। धूल से त्वचा, आँख और श्वसन तंत्र में जलन हो सकती है।"], ["No long-term effects classified (supplier SDS).", "कोई दीर्घकालिक असर वर्गीकृत नहीं (सप्लायर SDS)।"]],
      eco: ["Not considered harmful to aquatic organisms (supplier SDS); Germany WGK 1 - slightly hazardous to water.", "जलीय जीवों के लिए हानिकारक नहीं माना गया (सप्लायर SDS); जर्मनी WGK 1 - पानी के लिए थोड़ा खतरनाक।"],
      un: null },

    { id: "agno3", en: "Silver nitrate", hi: "सिल्वर नाइट्रेट", f: "AgNO₃", syn: "Lunar caustic", cas: "7761-88-8", ec: "231-853-9", mm: "169.89 g/mol",
      conc: ["Silver nitrate, solid, 99 % or more (AR grade; check label)", "सिल्वर नाइट्रेट, ठोस, 99 % या अधिक (AR ग्रेड; लेबल देखें)"],
      sig: "Danger", pict: ["GHS03", "GHS05", "GHS09"], H: ["H272", "H302", "H314", "H400", "H410"], src: [ICSC("1116 (Apr 2024)")],
      fa: { inh: ["fa_air", "fa_artresp", "fa_med"], skin: ["fa_rinse15", "fa_cloth", "fa_mednow"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_mednow"] },
      sym: { inh: ["sore", "cough", "chest", "sob", "labour", "headache", "fatigue", "weak"], skin: ["red", "pain", "serburn", "blister"], eye: ["red", "pain", "sevburn", "vision"], ing: ["mouthburn", "abd", "nausea", "vomit", "shock"] },
      fire: ["fi_enhance", "fi_react", "fi_fumes"], media: ["fm_largewater", "fm_cool"],
      decomp: ["Toxic nitrogen oxides on heating (decomposes at 444 °C).", "गर्म करने पर ज़हरीले नाइट्रोजन ऑक्साइड (444 °C पर विघटन)।"],
      spill: ["sp_suit", "sp_noenv", "sp_sweep", "sp_moist", "sp_wash", "sp_nosaw", "sp_disp"],
      handle: ["hd_dust", "hd_nocomb", "hd_noeat"], store: ["st_comb", "st_dry", "st_orig", "st_drain", "st_effl", "st_unbreak"],
      oel: [["ACGIH TLV (as Ag)", "0.01 mg/m³ TWA"], ["EU-OEL (as Ag)", "0.01 mg/m³ TWA"]],
      ppe: ["pp_face", "pp_gloves", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Colourless or white crystals; turn grey on exposure to light", "रंगहीन या सफ़ेद क्रिस्टल; रोशनी में धूसर हो जाते हैं"], ["odour", "Odourless", "गंधहीन"], ["mp", "212 °C"], ["dec", "444 °C"], ["dens", "4.35 (20 °C)"], ["sol", "Very soluble", "बहुत घुलनशील"]],
      react: ["Strong oxidant: reacts violently with combustible and reducing materials, acetylene, acids and many other substances. Attacks some plastics, rubber and coatings.", "तेज़ ऑक्सीडाइज़र: जलने वाले, अपचायक पदार्थ, एसिटिलीन, अम्ल और कई पदार्थों से तेज़ अभिक्रिया। कुछ प्लास्टिक, रबर और कोटिंग को गलाता है।"],
      avoid: ["Combustibles, reducing agents, acetylene, ammonia solutions, light.", "जलने वाले पदार्थ, अपचायक, एसिटिलीन, अमोनिया घोल, रोशनी।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. May affect the blood (methaemoglobin formation); effects may be delayed.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। रक्त पर असर (मेथेमोग्लोबिन); असर देर से भी।"],
        ["May cause grey-blue discolouration of eyes and skin (argyria). Animal tests show possible toxic effects on human reproduction or development.", "आँख और त्वचा का धूसर-नीला रंग (आर्जीरिया)। पशु परीक्षणों में मानव प्रजनन / विकास पर असर संभव।"]],
      eco: ["Very toxic to aquatic organisms, with long-lasting effects.", "जलीय जीवों के लिए अत्यधिक विषैला, लंबे समय तक असर।"],
      un: { no: "UN 1493", name: "SILVER NITRATE", cls: "5.1", pg: "II" } },

    { id: "oxalic", en: "Oxalic acid dihydrate", hi: "ऑक्ज़ेलिक एसिड डाइहाइड्रेट", f: "(COOH)₂·2H₂O", syn: "Ethanedioic acid", cas: "6153-56-6 (dihydrate); 144-62-7 (anhydrous)", ec: "205-634-3", mm: "126.07 g/mol (dihydrate)",
      conc: ["Oxalic acid dihydrate, solid (AR grade; check label). ICSC 0529 describes oxalic acid.", "ऑक्ज़ेलिक एसिड डाइहाइड्रेट, ठोस (AR ग्रेड; लेबल देखें)। ICSC 0529 ऑक्ज़ेलिक एसिड के लिए है।"],
      sig: "Danger", pict: ["GHS05", "GHS07"], H: ["H302", "H314", "H335"], src: [ICSC("0529 (Nov 2009)")],
      fa: { inh: ["fa_air", "fa_halfup", "fa_mednow"], skin: ["fa_cloth", "fa_rinse15", "fa_med"], eye: ["fa_eye", "fa_mednow"], ing: ["fa_mouth", "fa_novomit", "fa_mednow"] },
      sym: { inh: ["cough", "sore", "burn", "sob", "labour", "headache"], skin: ["red", "pain", "skinburn"], eye: ["red", "pain", "blur", "sevburn"], ing: ["sore", "burn", "abd", "labour", "convuls", "shock"] },
      fire: ["fi_comb", "fi_fumes"], media: ["fm_oxalic", "fm_cool"],
      decomp: ["Formic acid and carbon monoxide (on hot surfaces or flames).", "फॉर्मिक एसिड और कार्बन मोनोऑक्साइड (गर्म सतह या आग पर)।"],
      spill: ["sp_filter", "sp_sweep", "sp_moist", "sp_wash", "sp_disp"],
      handle: ["hd_noflame", "hd_dust", "hd_noeat"], store: ["st_oxid", "st_food", "st_dry"],
      oel: [["ACGIH TLV", "1 mg/m³ TWA; 2 mg/m³ STEL"], ["EU-OEL", "1 mg/m³ TWA"]],
      ppe: ["pp_face", "pp_gacid", "pp_body", "pp_resp", "pp_wash"],
      props: [["app", "Colourless crystals or white powder", "रंगहीन क्रिस्टल या सफ़ेद पाउडर"], ["mp", "189.5 °C (anhydrous; sublimes from 157 °C)"], ["dens", "1.9 (anhydrous)"], ["sol", "9-10 g / 100 mL at 20 °C (moderate, anhydrous)"], ["logp", "-0.81"]],
      react: ["The solution in water is a medium-strong acid. Reacts violently with strong oxidants. Forms explosive silver oxalate with some silver compounds. Attacks some plastics.", "पानी में घोल मध्यम-तेज़ अम्ल। तेज़ ऑक्सीडाइज़र से तेज़ अभिक्रिया। कुछ सिल्वर यौगिकों से विस्फोटक सिल्वर ऑक्ज़ेलेट बनाता है। कुछ प्लास्टिक को गलाता है।"],
      avoid: ["Strong oxidants, silver compounds, hot surfaces.", "तेज़ ऑक्सीडाइज़र, सिल्वर यौगिक, गर्म सतह।"],
      tox: [["Corrosive to eyes, skin and respiratory tract; corrosive if swallowed. May affect the calcium balance after ingestion; high exposure could be fatal.", "आँख, त्वचा और श्वसन तंत्र के लिए संक्षारक; निगलने पर भी। निगलने पर कैल्शियम संतुलन बिगड़ सकता है; ज़्यादा मात्रा जानलेवा हो सकती है।"],
        ["Repeated skin contact may cause dermatitis; exposure may lead to kidney stones, slow-healing ulcers and black fingernails.", "बार-बार त्वचा संपर्क से त्वचा रोग; पथरी, धीरे भरने वाले छाले और काले नाखून हो सकते हैं।"]],
      eco: ["Acidic - keep out of drains and water bodies.", "अम्लीय - नाली और जल स्रोत से दूर रखें।"],
      un: { no: "UN 3261", name: "CORROSIVE SOLID, ACIDIC, ORGANIC, N.O.S. (oxalic acid)", cls: "8", pg: "III" },
      notes: [["ICSC note: some producers do not classify this substance under UN 3261 - follow your supplier's SDS.", "ICSC नोट: कुछ निर्माता इसे UN 3261 में नहीं रखते - अपने सप्लायर का SDS देखें।"]] },

    { id: "argon", en: "Argon (compressed gas)", hi: "आर्गन (संपीड़ित गैस)", f: "Ar", syn: "Spectrometer argon", cas: "7440-37-1", ec: "231-147-0", mm: "39.95 g/mol",
      conc: ["Argon, compressed gas in cylinder (high-purity grade for the spectrometer - check the cylinder label)", "आर्गन, सिलेंडर में संपीड़ित गैस (स्पेक्ट्रोमीटर के लिए हाई-प्योरिटी ग्रेड - सिलेंडर का लेबल देखें)"],
      sig: "Warning", pict: ["GHS04"], H: ["H280"],
      other: ["Simple asphyxiant: in high concentration it displaces oxygen - risk of unconsciousness or death. Heavier than air; collects in low spaces.", "दम घोंटने वाली गैस: ज़्यादा मात्रा में ऑक्सीजन हटा देती है - बेहोशी या मौत का खतरा। हवा से भारी; नीचे की जगहों में जमा होती है।"],
      src: [ICSC("0154 (Aug 2003)"), "GHS H280 for gases under pressure (UN GHS, compressed gas)"],
      fa: { inh: ["fa_air", "fa_artresp", "fa_med"], skin: ["fa_frost", "fa_med"], eye: ["fa_eye", "fa_med"] },
      sym: { inh: ["dizzy", "lethargy", "headache", "suffoc"], skin: ["frost"], eye: ["frost"] },
      fire: ["fi_noncomb", "fi_cyl"], media: ["fm_surround", "fm_cool", "fm_shelter"],
      decomp: ["None (inert gas).", "कोई नहीं (निष्क्रिय गैस)।"],
      spill: ["sp_vent", "sp_suit", "sp_jet"],
      handle: ["hd_cyl", "hd_vent"], store: ["st_cyl", "st_fire"],
      oel: [["Exposure limits", "None listed (simple asphyxiant) - keep the oxygen level in the room normal"]],
      ppe: ["pp_cold", "pp_glass"],
      props: [["app", "Colourless gas (cold liquid when liquefied)", "रंगहीन गैस (द्रवित होने पर ठंडा द्रव)"], ["odour", "Odourless", "गंधहीन"], ["bp", "-185.9 °C"], ["mp", "-189.2 °C"], ["sol", "3.4 mL / 100 mL at 20 °C"], ["vd", "1.66"], ["logp", "0.94"]],
      react: ["Chemically inert. Heating raises cylinder pressure - risk of bursting.", "रासायनिक रूप से निष्क्रिय। गर्म होने पर सिलेंडर का दबाव बढ़ता है - फटने का खतरा।"],
      avoid: ["Heat, direct sun, physical damage to cylinders.", "गर्मी, सीधी धूप, सिलेंडर को चोट।"],
      tox: [["Asphyxiation in high concentrations (oxygen deficiency); the liquid causes frostbite.", "ज़्यादा मात्रा में दम घुटना (ऑक्सीजन की कमी); द्रव से शीत-दंश।"], ["No long-term effects listed on ICSC 0154.", "ICSC 0154 पर कोई दीर्घकालिक असर नहीं।"]],
      eco: ["No ecological damage expected (natural part of air).", "पर्यावरण को नुकसान की आशंका नहीं (हवा का प्राकृतिक हिस्सा)।"],
      un: { no: "UN 1006", name: "ARGON, COMPRESSED", cls: "2.2", pg: "-" },
      notes: [["Check the oxygen content before entering a closed area where argon may have leaked.", "जहाँ आर्गन लीक हुई हो, ऐसी बंद जगह में जाने से पहले ऑक्सीजन जाँचें।"]] }
  ];
  C.forEach((c, i) => { c.no = `DM/QA/SDS/${String(i + 1).padStart(2, "0")}`; });

  // ---------- GHS pictogram drawing (canvas) ----------
  function pictogram(g, code, x, y, s) {   // diamond s x s at (x, y)
    g.save(); g.translate(x + s / 2, y + s / 2);
    g.save(); g.rotate(Math.PI / 4); const d = s / Math.SQRT2 * 0.92;
    g.fillStyle = "#ffffff"; g.strokeStyle = "#e30613"; g.lineWidth = s * 0.06; g.beginPath(); g.rect(-d / 2, -d / 2, d, d); g.fill(); g.stroke(); g.restore();
    const k = s / 100; g.scale(k, k); g.fillStyle = "#000"; g.strokeStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
    const flame = (cx, by, sc) => { g.beginPath(); g.moveTo(cx, by); g.bezierCurveTo(cx - 14 * sc, by, cx - 17 * sc, by - 18 * sc, cx - 6 * sc, by - 34 * sc);
      g.bezierCurveTo(cx - 5 * sc, by - 23 * sc, cx, by - 25 * sc, cx + 2 * sc, by - 40 * sc); g.bezierCurveTo(cx + 15 * sc, by - 26 * sc, cx + 17 * sc, by - 9 * sc, cx, by); g.fill(); };
    if (code === "GHS02") { flame(0, 22, 1.05); g.fillRect(-20, 25, 40, 4); }
    else if (code === "GHS03") { g.lineWidth = 4; g.beginPath(); g.arc(0, 14, 12, 0, Math.PI * 2); g.stroke(); flame(0, 4, 0.75); g.fillRect(-20, 30, 40, 4); }
    else if (code === "GHS04") { g.save(); g.rotate(-0.5); g.beginPath(); if (g.roundRect) g.roundRect(-30, -9, 56, 18, 9); else g.rect(-30, -9, 56, 18); g.fill(); g.fillRect(26, -5, 8, 10); g.restore(); }
    else if (code === "GHS05") {
      g.save(); g.translate(-14, -18); g.rotate(0.35); g.fillRect(-4, -14, 8, 24); g.restore(); g.save(); g.translate(14, -18); g.rotate(-0.35); g.fillRect(-4, -14, 8, 24); g.restore();
      [[-10, -2], [-12, 4], [10, -2], [12, 4]].forEach(([dx, dy]) => { g.beginPath(); g.arc(dx, dy, 2.2, 0, Math.PI * 2); g.fill(); });
      g.fillRect(-28, 12, 22, 7); g.beginPath(); g.moveTo(6, 10); g.lineTo(30, 10); g.lineTo(30, 20); g.lineTo(6, 20); g.closePath(); g.fill();
      g.fillRect(-30, 24, 60, 5);
    }
    else if (code === "GHS06") {
      g.beginPath(); g.arc(0, -10, 15, 0, Math.PI * 2); g.fill(); g.fillRect(-8, 2, 16, 8);
      g.fillStyle = "#fff"; g.beginPath(); g.arc(-6, -11, 4.5, 0, Math.PI * 2); g.arc(6, -11, 4.5, 0, Math.PI * 2); g.fill(); g.fillStyle = "#000";
      g.lineWidth = 6; g.beginPath(); g.moveTo(-24, 14); g.lineTo(24, 30); g.moveTo(24, 14); g.lineTo(-24, 30); g.stroke();
    }
    else if (code === "GHS07") { g.fillRect(-5, -28, 10, 38); g.beginPath(); g.arc(0, 22, 6, 0, Math.PI * 2); g.fill(); }
    else if (code === "GHS08") {
      g.beginPath(); g.arc(0, -24, 9, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-22, 32); g.lineTo(-20, -6); g.quadraticCurveTo(0, -18, 20, -6); g.lineTo(22, 32); g.closePath(); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 5 : 12; g.lineTo(Math.cos(a) * r, 10 + Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = "#000";
    }
    else if (code === "GHS09") {
      g.lineWidth = 3.5; g.beginPath(); g.moveTo(-14, 6); g.lineTo(-14, -22); g.moveTo(-14, -12); g.lineTo(-24, -20); g.moveTo(-14, -16); g.lineTo(-4, -26); g.moveTo(-14, -4); g.lineTo(-6, -10); g.stroke();
      g.fillRect(-30, 8, 60, 4);
      g.beginPath(); g.ellipse(8, 22, 12, 5, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(-4, 22); g.lineTo(-12, 16); g.lineTo(-12, 28); g.closePath(); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(14, 21, 1.6, 0, Math.PI * 2); g.fill(); g.fillStyle = "#000";
    }
    g.restore();
  }

  // ---------- page layout on canvas (A4, 200 dpi) ----------
  const PW = 1654, PH = 2339, MX = 110, TOP = 250, BOT = PH - 170;
  const FE = "Poppins, 'Segoe UI', Arial, sans-serif", FH = "'Baloo 2', 'Nirmala UI', 'Noto Sans Devanagari', sans-serif";
  const NAVY = "#0b2545", GOLD = "#c9a227", RED = "#c62828";
  function build(c) {
    const pages = []; let g, y;
    const meas = document.createElement("canvas").getContext("2d");
    const wrap = (txt, font, maxW) => { meas.font = font; const out = []; String(txt).split("\n").forEach(par => { let line = ""; par.split(" ").forEach(w => { const t = line ? line + " " + w : w; if (meas.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; } }); out.push(line); }); return out; };
    const emergency = (() => { try { return localStorage.getItem("sdsEmergency") || ""; } catch (e) { return ""; } })();
    function newPage() {
      const cv = document.createElement("canvas"); cv.width = PW; cv.height = PH; g = cv.getContext("2d"); pages.push(cv);
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, PW, PH);
      g.fillStyle = NAVY; g.fillRect(0, 0, PW, 170); g.fillStyle = GOLD; g.fillRect(0, 170, PW, 8);
      g.fillStyle = "#ffffff"; g.font = `800 46px ${FE}`; g.textAlign = "left"; g.fillText("SAFETY DATA SHEET", MX, 74);
      g.font = `700 36px ${FH}`; g.fillStyle = "#f1d27a"; g.fillText("सुरक्षा डेटा शीट (SDS)", MX, 126);
      g.textAlign = "right"; g.fillStyle = "#ffffff"; g.font = `700 38px ${FE}`; g.fillText(c.en, PW - MX, 74);
      g.font = `600 24px ${FE}`; g.fillStyle = "#cfd8e3"; g.fillText(`${c.no}  ·  Rev. 00  ·  Issue date ${ISSUE}`, PW - MX, 118);
      g.fillText(coTag("QAD-SMS Laboratory"), PW - MX, 152);
      g.textAlign = "left"; y = TOP;
    }
    const ensure = h => { if (y + h > BOT) newPage(); };
    function section(n, en, hi) {
      ensure(230);
      y += 18; g.fillStyle = NAVY; if (g.roundRect) { g.beginPath(); g.roundRect(MX, y, PW - 2 * MX, 64, 10); g.fill(); } else g.fillRect(MX, y, PW - 2 * MX, 64);
      g.fillStyle = GOLD; g.fillRect(MX, y, 14, 64);
      g.fillStyle = "#ffffff"; g.font = `800 30px ${FE}`; g.fillText(`${n}. ${en}`, MX + 34, y + 43);
      meas.font = `800 30px ${FE}`; const w = meas.measureText(`${n}. ${en}`).width;
      g.font = `700 28px ${FH}`; g.fillStyle = "#f1d27a"; g.fillText(`/ ${hi}`, MX + 50 + w, y + 43);
      y += 90;
    }
    function bi(en, hi, opt) {   // English line(s) + Hindi line(s)
      opt = opt || {};
      const x = MX + (opt.indent || 0), w = PW - MX - x - 10;
      const eF = `${opt.bold ? 700 : 500} ${opt.size || 26}px ${FE}`, hF = `600 ${(opt.size || 26) - 1}px ${FH}`;
      const el = en ? wrap(en, eF, w - (opt.bullet ? 30 : 0)) : [], hl = hi ? wrap(hi, hF, w - (opt.bullet ? 30 : 0)) : [];
      const lh = (opt.size || 26) * 1.38, h = (el.length + hl.length) * lh + 10;
      ensure(h);
      if (opt.bullet) { g.fillStyle = opt.color || NAVY; g.beginPath(); g.arc(x + 8, y + lh * 0.45, 6, 0, Math.PI * 2); g.fill(); }
      const tx = x + (opt.bullet ? 30 : 0);
      el.forEach(l => { g.font = eF; g.fillStyle = opt.color || "#14213d"; g.fillText(l, tx, y + lh * 0.72); y += lh; });
      hl.forEach(l => { g.font = hF; g.fillStyle = "#5a6478"; g.fillText(l, tx, y + lh * 0.72); y += lh; });
      y += 10;
    }
    function kv(label, hiLabel, val, hiVal) {   // label column + value column
      const lw = 470, x2 = MX + lw, w2 = PW - MX - x2;
      const vF = `500 26px ${FE}`, lh = 36;
      const vl = wrap(val, vF, w2), hvl = hiVal ? wrap(hiVal, `600 25px ${FH}`, w2) : [];
      const h = Math.max(2, vl.length + hvl.length) * lh + 14;
      ensure(h);
      g.fillStyle = "#f3f6fa"; g.fillRect(MX, y - 4, PW - 2 * MX, h - 6);
      g.font = `700 25px ${FE}`; g.fillStyle = "#14213d"; g.fillText(label, MX + 14, y + 26);
      g.font = `600 23px ${FH}`; g.fillStyle = "#5a6478"; g.fillText(hiLabel, MX + 14, y + 60);
      let yy = y; vl.forEach(l => { g.font = vF; g.fillStyle = "#14213d"; g.fillText(l, x2, yy + 26); yy += lh; });
      hvl.forEach(l => { g.font = `600 25px ${FH}`; g.fillStyle = "#5a6478"; g.fillText(l, x2, yy + 26); yy += lh; });
      y += h;
    }
    const sub = (en, hi) => { ensure(150); g.font = `800 27px ${FE}`; g.fillStyle = "#0b3c7a"; g.fillText(en, MX, y + 26); meas.font = `800 27px ${FE}`;
      const w = meas.measureText(en).width; g.font = `700 25px ${FH}`; g.fillStyle = "#8a6d12"; g.fillText(" / " + hi, MX + w + 6, y + 26); y += 46; };
    const P = k => L[k] || [k, k];
    const symTxt = arr => [arr.map(k => P(k)[0]).join(", "), arr.map(k => P(k)[1]).join(", ")];

    newPage();
    // 1
    section(1, "Identification", "पहचान");
    kv("Product name", "उत्पाद का नाम", c.en, c.hi);
    kv("Formula", "सूत्र", c.f);
    kv("Synonyms", "अन्य नाम", c.syn);
    kv("CAS No. / EC No.", "CAS / EC नंबर", `${c.cas}  /  ${c.ec}`);
    kv("Recommended use", "उपयोग", "Laboratory reagent - chemical analysis (QAD-SMS laboratory)", "प्रयोगशाला अभिकर्मक - रासायनिक विश्लेषण (QAD-SMS लैब)");
    kv("User", "उपयोगकर्ता", (COMPANY.name ? COMPANY.name + " - " : "") + "QAD-SMS Laboratory");
    kv("Emergency contact", "आपातकालीन संपर्क", emergency || "____________________", emergency ? "" : "(भरें)");
    // 2
    section(2, "Hazard identification", "खतरे की पहचान");
    if (c.notClass) bi("Not classified as hazardous (supplier SDS, see Section 16). No GHS pictogram or signal word required.", "खतरनाक वर्गीकृत नहीं (सप्लायर SDS, सेक्शन 16)। कोई GHS चिह्न या संकेत शब्द आवश्यक नहीं।", { bold: true });
    else {
      ensure(260);
      const ps = 170; c.pict.forEach((p, i) => { const px = MX + i * (ps + 40); pictogram(g, p, px, y, ps);
        g.font = `700 20px ${FE}`; g.fillStyle = "#14213d"; g.textAlign = "center"; g.fillText(p, px + ps / 2, y + ps + 22); g.font = `600 19px ${FH}`; g.fillStyle = "#5a6478"; g.fillText(PICT[p][1], px + ps / 2, y + ps + 46); g.textAlign = "left"; });
      y += 170 + 70;
      kv("Signal word", "संकेत शब्द", c.sig.toUpperCase(), c.sig === "Danger" ? "खतरा" : "चेतावनी");
      sub("Hazard statements", "खतरा कथन");
      c.H.forEach(h => { const t = (c.Hx && c.Hx[h]) || HS[h]; bi(`${h}: ${t[0]}`, t[1], { bullet: true, color: RED, indent: 10 }); });
      const pset = new Set(); c.H.forEach(h => (P_FOR[h] || []).forEach(p => pset.add(p)));
      const order = p => { const m = /^P(\d+)/.exec(p); return m ? +m[1] : 999; };
      sub("Precautionary statements", "सावधानी कथन");
      [...pset].sort((a, b) => order(a) - order(b) || a.localeCompare(b)).forEach(p => bi(`${p}: ${PS[p][0]}`, PS[p][1], { bullet: true, indent: 10, size: 24 }));
    }
    if (c.other) { sub("Other hazards", "अन्य खतरे"); bi(c.other[0], c.other[1], { bullet: true, indent: 10 }); }
    // 3
    section(3, "Composition / information on ingredients", "संरचना / अवयव");
    kv("Substance", "पदार्थ", c.conc[0], c.conc[1]);
    kv("CAS No.", "CAS नंबर", c.cas);
    kv("Molar mass", "मोलर द्रव्यमान", c.mm);
    // 4
    section(4, "First-aid measures", "प्राथमिक उपचार");
    [["inh", "Inhalation", "साँस से"], ["skin", "Skin", "त्वचा"], ["eye", "Eyes", "आँखें"], ["ing", "Ingestion", "निगलना"]].forEach(([k, en, hi]) => {
      if (!c.fa[k]) return;
      sub(en, hi);
      if (c.sym && c.sym[k]) { const [se, sh] = symTxt(c.sym[k]); bi(`Symptoms: ${se}.`, `लक्षण: ${sh}।`, { indent: 10, size: 24, color: "#7a1d1d" }); }
      c.fa[k].forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    });
    if (c.faNote) { sub("Note to physician / delayed effects", "डॉक्टर के लिए / देर से असर"); bi(P(c.faNote)[0], P(c.faNote)[1], { indent: 10 }); }
    // 5
    section(5, "Fire-fighting measures", "आग बुझाने के उपाय");
    sub("Hazards", "खतरे"); c.fire.forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    sub("Extinguishing media / advice", "बुझाने के साधन / सलाह"); c.media.forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    sub("Hazardous combustion / decomposition products", "जलने / विघटन से बनने वाले खतरनाक पदार्थ"); bi(c.decomp[0], c.decomp[1], { indent: 10 });
    // 6
    section(6, "Accidental release measures", "रिसाव / फैलाव पर उपाय");
    c.spill.forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    // 7
    section(7, "Handling and storage", "संभालना और भंडारण");
    sub("Safe handling", "सुरक्षित संभालना"); c.handle.forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    sub("Storage", "भंडारण"); c.store.forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    // 8
    section(8, "Exposure controls / personal protection", "संपर्क नियंत्रण / व्यक्तिगत सुरक्षा");
    sub("Occupational exposure limits", "कार्यस्थल संपर्क सीमा"); c.oel.forEach(([a, b]) => kv(a, "सीमा", b));
    sub("Personal protective equipment", "व्यक्तिगत सुरक्षा उपकरण"); c.ppe.forEach(p => bi(P(p)[0], P(p)[1], { bullet: true, indent: 10 }));
    // 9
    section(9, "Physical and chemical properties", "भौतिक और रासायनिक गुण");
    c.props.forEach(([k, v, vh]) => kv(PL[k][0], PL[k][1], v, vh));
    // 10
    section(10, "Stability and reactivity", "स्थिरता और अभिक्रियाशीलता");
    bi(c.react[0], c.react[1]);
    kv("Conditions / materials to avoid", "बचाने योग्य स्थिति / पदार्थ", c.avoid[0], c.avoid[1]);
    kv("Hazardous decomposition", "खतरनाक विघटन उत्पाद", c.decomp[0], c.decomp[1]);
    // 11
    section(11, "Toxicological information", "विषविज्ञान संबंधी जानकारी");
    sub("Short-term exposure", "अल्पकालिक संपर्क"); bi(c.tox[0][0], c.tox[0][1], { indent: 10 });
    sub("Long-term or repeated exposure", "दीर्घकालिक / बार-बार संपर्क"); bi(c.tox[1][0], c.tox[1][1], { indent: 10 });
    // 12
    section(12, "Ecological information", "पर्यावरण संबंधी जानकारी");
    bi(c.eco[0], c.eco[1]);
    // 13
    section(13, "Disposal considerations", "निपटान");
    bi("Dispose of contents / container as hazardous waste in accordance with local and national regulations (in India: Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016, as applicable). Do not pour concentrated chemical into drains.",
      "सामग्री / कंटेनर को स्थानीय और राष्ट्रीय नियमों के अनुसार खतरनाक कचरे के रूप में नष्ट करें (भारत में: खतरनाक और अन्य अपशिष्ट नियम, 2016, जहाँ लागू हो)। सांद्र केमिकल नाली में न डालें।");
    // 14
    section(14, "Transport information", "परिवहन जानकारी");
    if (!c.un) bi("Not regulated as dangerous goods for transport (supplier SDS).", "परिवहन के लिए खतरनाक माल के रूप में विनियमित नहीं (सप्लायर SDS)।");
    else { kv("UN number", "UN नंबर", c.un.no); kv("Proper shipping name", "शिपिंग नाम", c.un.name); kv("Transport hazard class", "खतरा वर्ग", c.un.cls + (c.un.sub ? `  (subsidiary ${c.un.sub})` : "")); kv("Packing group", "पैकिंग ग्रुप", c.un.pg); }
    (c.notes || []).filter(n => /UN /.test(n[0])).forEach(n => bi(n[0], n[1], { indent: 10, size: 24 }));
    // 15
    section(15, "Regulatory information", "नियामक जानकारी");
    bi("Classified and labelled per the UN Globally Harmonized System (GHS) - see Section 16 for the source used.", "संयुक्त राष्ट्र GHS के अनुसार वर्गीकरण और लेबल - स्रोत के लिए सेक्शन 16 देखें।", { bullet: true });
    bi("Use and storage at the workplace per the Factories Act, 1948 and the Manufacture, Storage and Import of Hazardous Chemical Rules, 1989, as applicable.", "कार्यस्थल पर उपयोग और भंडारण: फैक्ट्रीज़ एक्ट, 1948 और खतरनाक केमिकल (निर्माण, भंडारण, आयात) नियम, 1989 के अनुसार, जहाँ लागू हो।", { bullet: true });
    // 16
    section(16, "Other information", "अन्य जानकारी");
    sub("Sources", "स्रोत"); c.src.forEach(s => bi(s, "", { bullet: true, indent: 10, size: 23 }));
    (c.notes || []).filter(n => !/UN /.test(n[0])).forEach(n => { sub("Note", "नोट"); bi(n[0], n[1], { indent: 10 }); });
    kv("Prepared by", "तैयारकर्ता", "Durgesh Mishra, Manager, QAD-SMS");
    kv("Document / revision", "दस्तावेज़ / संशोधन", `${c.no}  ·  Rev. 00  ·  ${ISSUE}`);
    bi("This in-house SDS is a laboratory safety reference compiled from the public sources listed above. Always keep the supplier's own SDS for the batch received, and follow it where it differs.",
      "यह आंतरिक SDS ऊपर बताए सार्वजनिक स्रोतों से तैयार लैब सुरक्षा संदर्भ है। प्राप्त बैच के लिए सप्लायर का अपना SDS हमेशा रखें, और अंतर हो तो उसी का पालन करें।", { size: 23, color: "#5a6478" });
    // footers
    pages.forEach((cv, i) => { const gg = cv.getContext("2d");
      gg.fillStyle = "#e6e9ef"; gg.fillRect(MX, PH - 130, PW - 2 * MX, 3);
      gg.font = `600 22px ${FE}`; gg.fillStyle = "#5a6478"; gg.textAlign = "left"; gg.fillText(`Prepared by Durgesh Mishra, Manager, QAD-SMS  ·  ${c.no}`, MX, PH - 88);
      gg.textAlign = "right"; gg.fillText(`Page ${i + 1} of ${pages.length}`, PW - MX, PH - 88); gg.textAlign = "left"; });
    return pages;
  }
  const ISSUE = "17-10-2026";

  // ---------- UI ----------
  let cur = -1;
  function list() {
    $("sdsList").innerHTML = C.map((c, i) => `<button type="button" class="sdsItem${i === cur ? " sel" : ""}" data-i="${i}"><b>${i + 1}. ${c.en}</b><small>${c.f} · CAS ${c.cas.split(" ")[0]}</small><span class="sdsPicts" data-i="${i}"></span></button>`).join("");
    $("sdsList").querySelectorAll(".sdsPicts").forEach(sp => { const c = C[+sp.dataset.i]; if (!c.pict.length) { sp.textContent = "Not classified"; return; }
      c.pict.forEach(p => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; pictogram(cv.getContext("2d"), p, 2, 2, 60); cv.title = PICT[p][0]; sp.appendChild(cv); }); });
  }
  let pagesCache = {};
  async function fonts() { try { await Promise.all(["500", "600", "700", "800"].map(w => document.fonts.load(`${w} 30px Poppins`)).concat(["600", "700"].map(w => document.fonts.load(`${w} 30px "Baloo 2"`, "सुरक्षा")))); } catch (e) {} }
  async function open(i) {
    cur = i; list();
    $("sdsView").classList.remove("hidden"); $("sdsTitle").textContent = `${C[i].no} - ${C[i].en}`;
    $("sdsPages").innerHTML = '<div style="padding:20px;text-align:center;opacity:.7;">Preparing...</div>';
    await fonts();
    const pages = pagesCache[i] || (pagesCache[i] = build(C[i]));
    $("sdsPages").innerHTML = pages.map((cv, k) => `<img alt="Page ${k + 1}" src="${cv.toDataURL("image/jpeg", 0.7)}">`).join("");
    $("sdsView").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function pdfOf(idxs) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }); let first = true;
    idxs.forEach(i => { const pages = pagesCache[i] || (pagesCache[i] = build(C[i])); pages.forEach(cv => { if (!first) doc.addPage("a4", "portrait"); first = false; doc.addImage(cv.toDataURL("image/jpeg", 0.72), "JPEG", 0, 0, 210, 297, undefined, "FAST"); }); });
    return doc;
  }
  const save = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); };
  $("sdsList").addEventListener("click", e => { const b = e.target.closest(".sdsItem"); if (b) open(+b.dataset.i); });
  $("sdsPdfBtn").addEventListener("click", async () => { if (cur < 0) return; await fonts(); save(pdfOf([cur]).output("blob"), `SDS_${String(cur + 1).padStart(2, "0")}_${C[cur].en.replace(/\W+/g, "_")}.pdf`); });
  $("sdsAllBtn").addEventListener("click", async () => {
    const st = $("sdsStatus"), b = $("sdsAllBtn"); b.disabled = true;
    try { await fonts(); st.textContent = "Making all 16 SDS..."; await new Promise(r => setTimeout(r, 30));
      save(pdfOf(C.map((c, i) => i)).output("blob"), "QAD_SDS_All_16_Chemicals.pdf"); st.textContent = "✅ All 16 SDS saved as one PDF."; }
    catch (e) { st.textContent = "⚠️ " + e.message; } finally { b.disabled = false; }
  });
  const em = $("sdsEmergency");
  try { em.value = localStorage.getItem("sdsEmergency") || ""; } catch (e) {}
  em.addEventListener("change", () => { try { localStorage.setItem("sdsEmergency", em.value.trim()); } catch (e) {} pagesCache = {}; if (cur >= 0) open(cur); });
  let started = false;
  window.sdsStart = async () => { if (started) return; started = true; await fonts(); list(); };
})();
