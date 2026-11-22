/* ===================== LIVE CLOCK ===================== */
function updateLiveClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const el = document.getElementById("liveClock");
  if (el) el.textContent = `${hh}:${mm}:${ss}`;
}
updateLiveClock();
setInterval(updateLiveClock, 1000);

/* ===================== DARK MODE ===================== */
function applyDarkModePreference() {
  // Day / Night only for the Clean theme: Day = cream/white, Night = black
  const clean = (localStorage.getItem("themeColor") || "clean") === "clean", night = clean && localStorage.getItem("cleanNight") === "1";
  document.body.classList.toggle("dark-mode", night);
  document.body.classList.toggle("clean-night", night);
  const b = document.getElementById("darkModeToggle");
  b.textContent = night ? "☀️ Day mode" : "🌙 Night mode"; b.style.display = clean ? "" : "none";
}
applyDarkModePreference();

/* ===================== LANGUAGE TOGGLE (nav labels) ===================== */
function applyLanguagePreference() {
  const lang = localStorage.getItem("appLanguage") || "en";
  document.querySelectorAll("[data-en]").forEach(el => {
    el.textContent = lang === "hi" ? el.dataset.hi : el.dataset.en;
  });
  document.getElementById("langToggle").textContent = lang === "hi" ? "🌐 हिं / EN" : "🌐 EN / हिं";
  uiLangApply(lang);
}
function uiLang() { try { return localStorage.getItem("appLanguage") || "en"; } catch (e) { return "en"; } }
// Hindi for everything you actually see: home tiles, inner page tiles, Back buttons,
// menu, bottom bar, section headings and page titles.
function uiHiDict() {
  return {
    "Dashboard": "डैशबोर्ड", "Stock": "स्टॉक", "RM Desc": "आर.एम विवरण", "Off-Spec": "आउट ऑफ स्पेक",
    "ERP Prod": "ईआरपी उत्पादन", "ERP Prod Download": "ईआरपी उत्पादन डाउनलोड", "ERP Entry": "ईआरपी एंट्री", "← Back to ERP Menu": "← ईआरपी मेनू पर वापस", "Debit Note": "डेबिट नोट", "Trends": "ट्रेंड", "Prod Entry": "उत्पादन एंट्री",
    "Heat Cons.": "हीट खपत", "Party TC": "पार्टी टीसी", "New Block": "नया ब्लॉक", "Reports": "रिपोर्ट्स",
    "Edge Crack": "एज क्रैक", "ISO 9001": "आईएसओ 9001", "Quarterly": "तिमाही", "Summary": "सारांश",
    "What-If": "व्हाट-इफ", "Ask Data": "डेटा से पूछें", "Ind Std.": "भारतीय मानक", "SOP/WI": "एसओपी/WI",
    "Daily Summary": "दैनिक सारांश", "Period Summary": "अवधि सारांश", "Month-over-Month": "माह-दर-माह",
    "Yearly Calendar": "वार्षिक कैलेंडर", "Trend Charts": "ट्रेंड चार्ट", "Composition Breakdown": "संरचना विभाजन",
    "Size-wise Breakdown": "साइज़-वार विभाजन", "Chemical Composition": "रासायनिक संरचना",
    "Production Update": "प्रोडक्शन अपडेट", "Hot Out Entry": "हॉट आउट एंट्री", "RHF Billets Entry": "RHF बिलेट एंट्री",
    "Raw Material / Scrap": "कच्चा माल / स्क्रैप", "Logsheet PDF": "लॉगशीट PDF", "Billet Stock Format": "बिलेट स्टॉक फॉर्मेट",
    "Strip Mill": "स्ट्रिप मिल", "Stock Difference (Manual vs ERP)": "स्टॉक अंतर (मैनुअल बनाम ERP)",
    "BIS Doc": "BIS दस्तावेज़", "Test Certificate": "टेस्ट सर्टिफिकेट", "RM / Scrap Report": "आर.एम / स्क्रैप रिपोर्ट",
    "Slag Crusher Report": "स्लैग क्रशर रिपोर्ट", "Monthly MIS": "मासिक MIS", "NCR / CAPA Log": "NCR / CAPA लॉग",
    "Calibration Log": "कैलिब्रेशन लॉग", "Raw Material Report": "कच्चा माल रिपोर्ट", "Sponge Iron Note": "स्पंज आयरन नोट", "Billet Yard Stock": "बिलेट यार्ड स्टॉक", "Monthly ISO Pack": "मासिक ISO पैक", "Prepare ISO Pack": "ISO पैक बनाइए", "Vendor Rating": "वेंडर रेटिंग", "Traceability": "ट्रेसबिलिटी",
    "Quality Objectives": "गुणवत्ता उद्देश्य",
    "← Back to Menu": "← मेनू पर वापस", "← Back to Dashboard Menu": "← डैशबोर्ड मेनू पर वापस",
    "← Back to Trend Charts Menu": "← ट्रेंड चार्ट मेनू पर वापस", "← Back to Production Menu": "← प्रोडक्शन मेनू पर वापस",
    "← Back to Reports Menu": "← रिपोर्ट्स मेनू पर वापस", "← Back to ISO 9001 Menu": "← आईएसओ 9001 मेनू पर वापस",
    "Search": "खोजें", "Get Started": "शुरुआत करें", "File Location": "फ़ाइल लोकेशन", "Settings": "सेटिंग्स", "Download Android App": "एंड्रॉइड ऐप डाउनलोड करें", "Dark Mode": "डार्क मोड",
    "Theme Colour": "थीम रंग", "Icon Style": "आइकन स्टाइल", "Backup & Restore": "बैकअप और रिस्टोर", "Error Log": "एरर लॉग", "Home": "होम", "More": "और", "Fetch": "फ़ेच", "Fetching": "फ़ेच हो रहा",
    "★ Pinned": "★ पिन किए गए", "Production": "उत्पादन", "Quality": "गुणवत्ता", "Stock & Raw Material": "स्टॉक और कच्चा माल",
    "Documents": "दस्तावेज़",
    "Dashboard - Daily Summary": "डैशबोर्ड - दैनिक सारांश", "Dashboard - Period Summary": "डैशबोर्ड - अवधि सारांश",
    "Month-over-Month & Year-over-Year": "माह-दर-माह और वर्ष-दर-वर्ष", "Raw Material Stock Report": "कच्चा माल स्टॉक रिपोर्ट",
    "R.M Description": "आर.एम विवरण", "⚠️ Out of Spec Chemistry": "⚠️ आउट ऑफ स्पेक केमिस्ट्री",
    "🧪 Party Test Reports": "🧪 पार्टी टेस्ट रिपोर्ट", "⚖️ Heat-wise Consumption": "⚖️ हीट-वार खपत",
    "🏢 ERP Production": "🏢 ईआरपी उत्पादन", "🧾 SI Debit Note": "🧾 SI डेबिट नोट",
    "Composition Breakdown (Pie Chart)": "संरचना विभाजन (पाई चार्ट)", "Size-wise Breakdown (130 vs 160)": "साइज़-वार विभाजन (130 बनाम 160)",
    "Chemical Composition Trend": "रासायनिक संरचना ट्रेंड", "Raw Material / Scrap Entry": "कच्चा माल / स्क्रैप एंट्री",
    "Create Next Day Block": "अगला दिन ब्लॉक बनाएं", "Create Next Month File": "अगले महीने की फ़ाइल बनाएं",
    "Logsheet PDF (Prod.)": "लॉगशीट PDF (उत्पादन)", "Billet Stock Format PDF": "बिलेट स्टॉक फॉर्मेट PDF",
    "Stock Difference - Manual vs ERP": "स्टॉक अंतर - मैनुअल बनाम ERP", "Strip Mill PDF": "स्ट्रिप मिल PDF",
    "BIS Doc PDF": "BIS दस्तावेज़ PDF", "Test Certificate (T.C.) PDF": "टेस्ट सर्टिफिकेट (T.C.) PDF",
    "RM / Scrap Report PDF": "आर.एम / स्क्रैप रिपोर्ट PDF", "Slag Crusher Report PDF": "स्लैग क्रशर रिपोर्ट PDF",
    "Monthly MIS (one page)": "मासिक MIS (एक पेज)", "7 QC Tools - Edge Crack Analysis": "7 QC टूल्स - एज क्रैक विश्लेषण",
    "Non-Conformance Report (NCR) & CAPA Log": "नॉन-कन्फॉर्मेंस रिपोर्ट (NCR) और CAPA लॉग",
    "Equipment Calibration Log": "उपकरण कैलिब्रेशन लॉग", "Vendor / Supplier Performance Evaluation": "वेंडर / सप्लायर प्रदर्शन मूल्यांकन",
    "Product Traceability": "उत्पाद ट्रेसबिलिटी", "Quality Objectives Dashboard": "गुणवत्ता उद्देश्य डैशबोर्ड",
    "Quarter Reports - Inward Raw Material (Lumps, Fines & Silico Manganese)": "तिमाही रिपोर्ट - इनवर्ड कच्चा माल (लम्प्स, फाइन्स और सिलिको मैंगनीज़)",
    "Raw Data Report (3 separate PDFs)": "रॉ डेटा रिपोर्ट (3 अलग PDF)", "📖 Smart Summary": "📖 स्मार्ट सारांश",
    "🎯 What-If Simulator": "🎯 व्हाट-इफ सिम्युलेटर", "📚 Indian Standards (Ind Std.)": "📚 भारतीय मानक (Ind Std.)",
    "🧪 Chemicals, Glassware & Instruments": "🧪 केमिकल, ग्लासवेयर और उपकरण", "📋 SOP / Work Instructions": "📋 एसओपी / वर्क इंस्ट्रक्शन",
    "💬 Ask Your Data": "💬 डेटा से पूछें",
    // card style info lines
    "Production overview": "उत्पादन का सार", "Billet & RM stock": "बिलेट और आर.एम स्टॉक", "Raw material details": "कच्चे माल का विवरण",
    "Chemistry out of spec": "स्पेक से बाहर केमिस्ट्री", "ERP production": "ईआरपी उत्पादन", "SI debit notes": "SI डेबिट नोट",
    "Trend charts": "ट्रेंड चार्ट", "WhatsApp / paste entry": "WhatsApp / पेस्ट एंट्री", "Consumption per heat": "प्रति हीट खपत",
    "Party test certificates": "पार्टी टेस्ट सर्टिफिकेट", "Next day blocks": "अगले दिन के ब्लॉक", "PDF reports": "PDF रिपोर्ट्स",
    "Edge crack QC": "एज क्रैक QC", "NCR, calibration, vendors": "NCR, कैलिब्रेशन, वेंडर", "Quarter reports": "तिमाही रिपोर्ट",
    "Smart summary": "स्मार्ट सारांश", "What-if simulator": "व्हाट-इफ सिम्युलेटर", "Ask your data": "डेटा से पूछें",
    "Indian Standards": "भारतीय मानक", "Element": "तत्व", "Solutions, periodic table, safety": "विलयन, आवर्त सारणी, सुरक्षा", "Solution Preparation": "विलयन तैयारी", "Periodic Table": "आवर्त सारणी", "Safety Posters": "सेफ्टी पोस्टर", "SDS (Safety Data Sheets)": "एसडीएस (सुरक्षा डेटा शीट)", "SOP / work instructions": "एसओपी / वर्क इंस्ट्रक्शन",
    // form labels
    "Prod. sheet name": "प्रोडक्शन शीट का नाम", "Or auto-detect by month": "या महीने से अपने-आप ढूँढें",
    "Signature for TC / BIS PDFs and SOP prints": "TC / BIS PDF और SOP प्रिंट के लिए हस्ताक्षर",
    "Date": "तारीख", "From Date": "शुरू की तारीख", "To Date": "आख़िरी तारीख", "This Month": "इस महीने",
    "Sheet name": "शीट का नाम", "Party": "पार्टी", "Vehicle No.": "गाड़ी नंबर", "Prod Sheet Name": "प्रोडक्शन शीट का नाम",
    "Select Date": "तारीख चुनें", "Select date": "तारीख चुनें", "From Date (optional)": "शुरू की तारीख (ज़रूरी नहीं)",
    "To Date (optional)": "आख़िरी तारीख (ज़रूरी नहीं)", "Section": "सेक्शन",
    "Paste message here (Ctrl+V)": "मैसेज यहाँ पेस्ट करें (Ctrl+V)", "Weight": "वज़न",
    "📷 Fill from photo / screenshot of the RM table": "📷 RM टेबल की फोटो / स्क्रीनशॉट से भरें",
    "Quantity (MT)": "मात्रा (MT)", "Grade (optional)": "ग्रेड (ज़रूरी नहीं)", "Sheet": "शीट",
    "Template file (OneDrive path)": "टेम्पलेट फ़ाइल (OneDrive पाथ)", "New month": "नया महीना", "Month": "महीना",
    "File path (from OneDrive root)": "फ़ाइल पाथ (OneDrive रूट से)", "Select a Month": "महीना चुनें",
    "Financial Year (starts April)": "वित्त वर्ष (अप्रैल से शुरू)", "Quarter / Period": "तिमाही / अवधि",
    "Description of Nonconformity": "नॉन-कन्फॉर्मिटी का विवरण", "Root Cause": "मूल कारण",
    "Corrective Action": "सुधारात्मक कार्रवाई", "Responsible Person": "ज़िम्मेदार व्यक्ति",
    "Target Closure Date": "बंद करने की लक्ष्य तारीख", "Equipment Name": "उपकरण का नाम",
    "Equipment ID / Serial No.": "उपकरण ID / सीरियल नंबर", "Last Calibration Date": "पिछले कैलिब्रेशन की तारीख",
    "Next Due Date": "अगली ड्यू तारीख", "Calibrated By / Agency": "किसने कैलिब्रेट किया / एजेंसी",
    "Certificate No.": "सर्टिफिकेट नंबर", "Vendor Name": "वेंडर का नाम", "Evaluation Date": "मूल्यांकन की तारीख",
    "Quality Rating (1-5)": "गुणवत्ता रेटिंग (1-5)", "Delivery Rating (1-5)": "डिलीवरी रेटिंग (1-5)",
    "Price Rating (1-5)": "कीमत रेटिंग (1-5)", "Remarks": "टिप्पणी", "Heat No.": "हीट नंबर",
    "Target: Out-of-Spec Heats (%) should be under": "लक्ष्य: आउट-ऑफ-स्पेक हीट (%) इससे कम हों",
    "From Month": "शुरू का महीना", "To Month": "आख़िरी महीना",
    // buttons
    "📌 Save as Fixed Location": "📌 फ़िक्स लोकेशन सेव करें", "Clear Fixed Location": "फ़िक्स लोकेशन हटाएँ",
    "Find File for this Month": "इस महीने की फ़ाइल ढूँढें", "✍️ Upload signature": "✍️ हस्ताक्षर अपलोड करें",
    "Load Summary": "सारांश लोड करें", "🖼️ JPG (sticky note)": "🖼️ JPG (स्टिकी नोट)", "🖼️ JPG (like PDF)": "🖼️ JPG (PDF जैसा)",
    "Load Period Summary": "अवधि सारांश लोड करें", "Load Comparison": "तुलना लोड करें",
    "Download Chart (PNG)": "चार्ट डाउनलोड (PNG)", "Download PDF (A4 Print)": "PDF डाउनलोड (A4 प्रिंट)",
    "Load Yearly Calendar": "वार्षिक कैलेंडर लोड करें", "Load Stock Report": "स्टॉक रिपोर्ट लोड करें",
    "Download PDF": "PDF डाउनलोड", "⬇️ Download PDF": "⬇️ PDF डाउनलोड", "Load R.M Description": "आर.एम विवरण लोड करें",
    "Load Dashboard": "डैशबोर्ड लोड करें", "Download Full List (PDF)": "पूरी लिस्ट डाउनलोड (PDF)",
    "Show Report": "रिपोर्ट दिखाएँ", "Load Heat-wise Consumption": "हीट-वार खपत लोड करें", "Load Month-wise Consumption": "माह-वार खपत लोड करें", "📅 Month-wise Consumption": "📅 माह-वार खपत", "Select Month": "माह चुनें", "📝 Physical Stock Verification": "📝 भौतिक स्टॉक सत्यापन", "⬇️ Fetch ERP Stock": "⬇️ ERP स्टॉक लाएँ",
    "Load ERP Production": "ईआरपी उत्पादन लोड करें", "Load Debit Note Data": "डेबिट नोट डेटा लोड करें",
    "Download Full List (Excel)": "पूरी लिस्ट डाउनलोड (Excel)", "Download Party-wise PDF": "पार्टी-वार PDF डाउनलोड",
    "Load Trend": "ट्रेंड लोड करें", "Download Line Chart (PNG)": "लाइन चार्ट डाउनलोड (PNG)",
    "Download Pie Chart (PNG)": "पाई चार्ट डाउनलोड (PNG)", "Load Size Breakdown": "साइज़ विभाजन लोड करें",
    "Load Chemical Trend": "केमिकल ट्रेंड लोड करें", "Update Excel": "Excel अपडेट करें", "Clear": "साफ़ करें",
    "📋 Submit All Heats": "📋 सभी हीट सबमिट करें", "📥 Fetch WhatsApp": "📥 WhatsApp फ़ेच करें",
    "⚙️ Inbox Settings": "⚙️ इनबॉक्स सेटिंग", "Submit Hot Out": "हॉट आउट सबमिट करें", "Submit RHF": "RHF सबमिट करें",
    "Next": "अगला", "Skip Item": "आइटम छोड़ें", "Restart from Item 1": "आइटम 1 से फिर शुरू करें",
    "⚡ Create All Next Day Blocks (all 5 sheets)": "⚡ सभी अगले दिन के ब्लॉक बनाएं (पाँचों शीट)",
    "🎨 Fix Colours of Last Block": "🎨 पिछले ब्लॉक के रंग ठीक करें", "📅 Create Next Month File": "📅 अगले महीने की फ़ाइल बनाएं",
    "Preview PDF": "PDF प्रीव्यू", "Use This Month": "यही महीना लें", "Apply": "लागू करें", "Load Analysis": "विश्लेषण लोड करें",
    "Download Full Analysis (PDF)": "पूरा विश्लेषण डाउनलोड (PDF)", "Download Data (CSV)": "डेटा डाउनलोड (CSV)",
    "Download Full Analysis (Excel)": "पूरा विश्लेषण डाउनलोड (Excel)", "Add NCR": "NCR जोड़ें",
    "Add Equipment": "उपकरण जोड़ें", "Add Evaluation": "मूल्यांकन जोड़ें", "Load / Check Objective": "उद्देश्य लोड / जाँचें",
    "Save Target": "लक्ष्य सेव करें", "Download PO vs Actual PDF": "PO बनाम वास्तविक PDF डाउनलोड",
    "Download Raw Data (3 PDFs)": "रॉ डेटा डाउनलोड (3 PDF)", "Generate Summary": "सारांश बनाएं",
    "Load This Month's Fe(M)% (Daily Prod Format)": "इस महीने का Fe(M)% लोड करें (डेली प्रोडक्शन फॉर्मेट)",
    "📋 Show list": "📋 लिस्ट दिखाएँ", "Ask": "पूछें",
    // section headings
    "Inward Billet Stock": "इनवर्ड बिलेट स्टॉक", "Month-wise Breakdown": "महीने-वार विभाजन", "Reason Breakdown": "कारण-वार विभाजन",
    "Flagged Heats": "चिह्नित हीट", "Month-wise ERP Production": "महीने-वार ईआरपी उत्पादन",
    "Party-wise Debit Note Share": "पार्टी-वार डेबिट नोट हिस्सा", "Full List": "पूरी लिस्ट",
    "Total Strip vs Edge Crack": "कुल स्ट्रिप बनाम एज क्रैक", "📊 Dashboard: Where is the Edge Crack coming from?": "📊 डैशबोर्ड: एज क्रैक कहाँ से आ रहा है?",
    "1. Check Sheet": "1. चेक शीट", "2. Pareto Chart (by month, Grand Total)": "2. पैरेटो चार्ट (महीने-वार, कुल)",
    "3. Histogram (Grand WT% distribution across months)": "3. हिस्टोग्राम (महीनों में कुल WT% का फैलाव)",
    "4. Control Chart (Grand WT% over time)": "4. कंट्रोल चार्ट (समय के साथ कुल WT%)",
    "5. Scatter Diagram (Total Strip vs Edge Crack)": "5. स्कैटर डायग्राम (कुल स्ट्रिप बनाम एज क्रैक)",
    "6. Month-wise Trend (is rejection going up or down?)": "6. महीने-वार ट्रेंड (रिजेक्शन बढ़ रहा है या घट रहा है?)",
    "7. Cause & Effect (Fishbone / Ishikawa) Diagram": "7. कारण और प्रभाव (फिशबोन / इशिकावा) डायग्राम",
    // placeholders
    "Paste the production/chemical message copied from WhatsApp here... (you can also paste several heats' messages together, straight from a WhatsApp export, and use 'Submit All Heats' below)":
      "WhatsApp से कॉपी किया प्रोडक्शन/केमिकल मैसेज यहाँ पेस्ट करें... (कई हीट के मैसेज एक साथ भी पेस्ट कर सकते हैं, फिर नीचे 'सभी हीट सबमिट करें' दबाएँ)",
    "e.g. 2025 for FY 2025-26": "जैसे FY 2025-26 के लिए 2025", "What went wrong...": "क्या गलत हुआ...",
    "Why it happened...": "ऐसा क्यों हुआ...", "What was/will be done...": "क्या किया गया / किया जाएगा...",
    "e.g. Spectrometer": "जैसे स्पेक्ट्रोमीटर", "Search (e.g. 1786, sponge, bend)": "खोजें (जैसे 1786, sponge, bend)",
    "Write clauses, limits, sample size etc.": "क्लॉज़, लिमिट, सैंपल साइज़ आदि लिखें",
    "Filter (e.g. sodium silicate, WI/2)": "फ़िल्टर (जैसे sodium silicate, WI/2)",
    "Search (e.g. sulphur, WI/04, sponge, सल्फर)": "खोजें (जैसे sulphur, WI/04, sponge, सल्फर)",
    "Any query... e.g. IS 228 sulphur, fetch whatsapp": "कोई भी सवाल... जैसे IS 228 sulphur, fetch whatsapp"
  };
}
function uiT(en) { if (uiLang() !== "hi") return en; const d = uiHiDict(); return d[en] || en; }
function uiLangApply(lang) {
  lang = lang || uiLang();
  const d = uiHiDict();
  document.querySelectorAll(".navShort, .subLabel, .backBtn, .navDrawerItem > span:last-child, .bottomTabItem > span:last-child, #bottomTabFetchLabel, .navGroupHead, .navSub, .contentArea h2, .contentArea h3, .contentArea label, .contentArea button").forEach(el => {
    if (el.children.length) return;                       // only plain-text labels
    const cur = el.textContent.trim();
    if (!cur) return;
    if (el.dataset.enText === undefined || (cur !== el.dataset.enText && cur !== d[el.dataset.enText])) {
      if (!d[cur] && lang === "hi" && el.dataset.enText === undefined) return;   // nothing to translate
      el.dataset.enText = cur;
    }
    const en = el.dataset.enText;
    const want = lang === "hi" && d[en] ? d[en] : en;
    if (cur !== want) el.textContent = want;              // only touch it when it really changes
  });
  document.querySelectorAll(".contentArea [placeholder]").forEach(el => {
    if (el.dataset.enPh === undefined) el.dataset.enPh = el.getAttribute("placeholder");
    const en = el.dataset.enPh, want = lang === "hi" && d[en] ? d[en] : en;
    if (el.getAttribute("placeholder") !== want) el.setAttribute("placeholder", want);
  });
}
// Buttons that change their own text (e.g. "Loading..." then back) get Hindi again by themselves.
(function uiLangWatch() {
  let t = 0;
  const start = () => {
    const root = document.getElementById("contentArea");
    if (!root) return;
    new MutationObserver(() => {
      if (uiLang() !== "hi" || t) return;
      t = setTimeout(() => { t = 0; uiLangApply("hi"); }, 120);
    }).observe(root, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
document.addEventListener("DOMContentLoaded", () => uiLangApply());
applyLanguagePreference();

/* ===================== FIXED FILE LOCATION ===================== */
function updateFixedPathStatus() {
  const fixed = localStorage.getItem("fixedFilePath");
  const statusEl = document.getElementById("fixedPathStatus");
  if (fixed) {
    statusEl.textContent = `📌 Fixed to: ${fixed} (stays until you change it)`;
  } else {
    statusEl.textContent = "Not fixed yet - showing the default path.";
  }
}
(function applyFixedPathOnLoad() {
  const fixed = localStorage.getItem("fixedFilePath");
  if (fixed) document.getElementById("filePath").value = fixed;
  updateFixedPathStatus();
})();
document.getElementById("saveFixedPathBtn").addEventListener("click", () => {
  const path = document.getElementById("filePath").value.trim();
  if (!path) { alert("Please enter a file path first."); return; }
  localStorage.setItem("fixedFilePath", path);
  updateFixedPathStatus();
});
document.getElementById("clearFixedPathBtn").addEventListener("click", () => {
  localStorage.removeItem("fixedFilePath");
  updateFixedPathStatus();
});

/* ===================== CHANGELOG POPUP ("What's New") ===================== */
// APP_VERSION: in index.html (head), so the service worker can read it from the page
// Newest change FIRST - the What's New popup shows only that one line.
const CHANGELOG_ITEMS = [   // only the first one is shown ("What's new"); the newest few are kept
  "🔒 Fingerprint asked less often: a refresh within a minute does not ask again (slow network), and a Microsoft sign-in renewal waits until the app is unlocked",
  "🥇 Market: Gold and Silver tabs above the daily quote - rates by karat / purity in g, 10 g, 100 g, kg, ounce and tola, charts from 1 week to 10 years, 1 day / week / month / year change, MCX and Comex live rates and bullion news (updated every hour by the cloud sync)",
  "🔥 Crucibles in ONE monthly file: with 2-3 crucibles the file has Prod. / Strip Mill / BIS Doc sheets for each (Prod. B, Prod. C …); Daily Stock, Daily Prod Format and Monthly Prod add all crucibles. Heat messages (F-A/F-B/F-C) go to their crucible's sheet; Logsheet, Strip Mill, BIS Doc and out-of-spec reports cover all crucibles together; dashboards have a Crucible picker",
  "🗂️ Get Started → Excel Formats: set the file name, sheet names and columns where WhatsApp entries go (heat billets + chemistry, consumption, RHF transfer) - for another company's Excel format",
  "🔑 Fixed the occasional \"interaction_in_progress\" sign-in error, and the page no longer shrinks to a desktop-like view (page scrolling works again)",
  "🔔 WhatsApp cloud sync now runs every hour, and can send a notification to this phone when it saves something (Production Update → 🔔 Notify this device)",
  "☁️ WhatsApp sync now runs from the cloud at 04:00 and 12:00 (phone and PC can be off); the MacroDroid auto-open macro is no longer needed",
  "📐 Every WI now has a diagram: the other 48 WIs got a main-steps flowchart with a schematic of the set-up (titration, ignition and weighing, drying, sieving, magnetic separation, OES / ICP / ion chromatograph, pyknometer, viscometer, Nessler cylinders)",
  "🧪 New WI: DM/QA/WI/22 FeO in Slag & Sponge Iron - lab method (0.2 g, Na2CO3 + HCl 1:1 + HF + H3PO4, dichromate; FeO = BR × 0.718 / W); later WIs moved one number up (coal now from WI/23)",
  "📐 Apparatus diagrams added to 16 WIs (carbon / sulphur combustion trains, sulphur evolution, Fe(M) flasks, silver reductor, FeO in slag, VM crucible, Lunge nitrometer, tin flask, ion-exchange column) - in the app and in the print / PDF",
  "🧪 DM/QA/WI/21 is now Ferrous Oxide (FeO) in Slag - HCl in a closed flask under CO2 (sodium bicarbonate), dichromate titration (ISO 9035); no platinum crucible or burner needed",
  "🧪 New WI: DM/QA/WI/21 Ferrous Oxide (FeO) in Sponge Iron - Permanganate method (IS 1493 : 1959, cl. 19); later WIs moved one number up (coal now from WI/22)",
  "🔒 Fingerprint lock is now set by itself at a new sign-in on the phone (the menu option is hidden)",
  "💬 New Get Started → Message Formats: teach Moltrix the words of your WhatsApp messages (heat / consumption / RHF transfer), try a message, save to OneDrive",
  "🧹 Smart Summary tile removed from the home screen",
  "🔒 Fingerprint Lock: a refresh (🔄) no longer asks for the fingerprint - only opening the app, or coming back after more than a minute",
  "🔒 The lock screen is now blank: tap anywhere for the fingerprint; hold 3 seconds to open with the Microsoft account. All app messages are now in English",
  "🔒 New Fingerprint Lock (☰ menu): Moltrix asks for the fingerprint every time it is opened on this phone (Microsoft sign-in stays once); if the fingerprint fails, open with the Microsoft account",
  "🔒 Home and the other screens no longer zoom with two fingers - only the reports zoom (pinch / double-tap inside the report)",
  "🔢 Calibration Log: Sl. No. now runs 1, 2, 3 ... in the list order (no gaps or jumps like 35, 38, 37) - also in its PDF and the ISO pack",
  "📋 Next FY AOP (WIP) now in your new format word for word: A-Q quantities (Budgeted, Consumed (A), Expected (B), A+B, Opening, Pending / To-be / Total indent, Opening March, Annual Consumption / Indent / Inventory Budget, Remark), R empty, S-V value at old / new rate, difference and % variation; SUMMARY E / F / I / N",
  "🏭 ERP Production + RM: the one RM line that lets the ERP save the voucher is now only 0.001 MT; the heat's consumption goes in with RM add",
  "✅ ERP Entry: new 📲 Approve - the Moltrix ERP app approves the day's saved production vouchers (✓ → Approve), so Production QC can go in next",
  "🧾 ERP Entry is shorter: on the phone only the date, Load / Excel and the four 📲 buttons; the entry sheet opens with a tap",
  "📲 ERP from the phone in one tap: new 📲 buttons (Production + RM, RM add, QC, M2M, Indent / Requisition) open the Moltrix ERP app, which logs in, opens the screen and saves the entries by itself",
  "🏗️ Production Update → new Billet Yard Stock: paste the yard stock message - each size's Daily Stock manual pcs (N) is matched to it with +1 / -1 at the end of its formula",
  "🧪 ERP Production QC: if some tests could not go in, press Start again later - the saved QC is opened and only the tests still empty are added (nothing already entered is changed) - this needs Edit rights on Production QC in the ERP",
  "🎨 Clean theme: the paper texture now shows fully behind the tiles - only the tiles themselves are solid (the blurred box behind them and the shade on the left edge are gone)",
  "🧹 App cleaned up: old unused code taken out (lighter, nothing you use changes); the festival stickers on the Home date card also come on their 2027 dates",
  "🧪 ERP Production QC: the tests the ERP has now get entered and the QC is saved; parameters the ERP doesn't have yet (or blank in the BIS Doc) are only listed in the log",
  "🏭 ERP Production + RM: only one RM line goes in now - at most 0.500 MT of the first RM item that has SMS1 stock - and the voucher is saved (quicker); the rest of the consumption goes in with \"Add RM to saved vouchers\"",
  "🛠️ Next FY AOP (WIP): column headings and SUMMARY headings now word for word as in the CCM WIP AOP Excel",
  "🛠️ Next FY AOP (WIP) now in the CCM WIP format: per item Actual / Budgeted rate, consumed till the last month (A), expected opening, expected Nov-Mar (B), pending indent, to-be-indent (shortage), expected opening 31 March, A+B, and the next FY Consumption / Indent / Inventory budget; section totals in the title row, SUMMARY on top. ✅ Move to final AOP makes the final format (as CCM's FY 26-27 sheet)",
  "📱 ERP from the phone: the Moltrix ERP bookmark works only from the address bar suggestion (type Moltrix ERP there) - not from ⋮ → Bookmarks; set-up steps say so now",
  "📱 ERP from the phone: new \"📋 Copy for ERP (phone)\" button (ERP Entry and Indent / Requisition) - open the ERP in phone Chrome, tap the Moltrix ERP bookmark, Paste in the panel and Start; set-up steps under \"ERP from the phone\"",
  "🧾 ERP Entry: shorter \"What to enter\" options, one line each, with a short note below for the chosen one",
  "🧱 Billet Stock Format: \"BILLET END CUT\" in the ERP (Durgesh) file is no longer counted in the ERP billets total - it is shown separately as \"Not counted\"",
  "🔁 ERP: new \"Billet transfer SMS2 → BLRM (M2M)\" in What to enter - one Material to Material Transfer (series BL) per heat and length for the hot charging (R) billets: SMS2 → BLRM (division RM), item F03.. → R06.. (same billet), qty in MT from the production, Dept QAD03, Cost INDF1, batch / Ref No like 4/11/1R, voucher date = heat date. Tick Trial in the ERP panel to fill one voucher without saving",
  "📥 Quarter Reports is now Reports → SI Mn Reports: PO vs Actual & Raw Data (as before) + new Monthly Weight & Average - pick Lumps / Fines / Silico Manganese and months; total weight and weighted averages (weight x result / weight) as PDF or Excel",
  "⭐ Home tiles: the pin star in the corner is gone",
  "🎨 Clean theme: new embossed-paper look (mandala and diya pressed into the page), header in the same paper colour with an orange line; 🌙 Night mode = black, ☀️ Day mode = cream/white - Day / Night is now only for the Clean theme"
];
function maybeShowChangelog() {
  const lastSeen = localStorage.getItem("changelogVersionSeen");
  if (lastSeen === APP_VERSION) return; // already seen this version
  const overlay = document.createElement("div");
  overlay.className = "milestoneOverlay";
  overlay.innerHTML = `
    <div class="milestoneCard" style="max-width:340px;max-height:80vh;overflow:auto;text-align:left;">
      <div class="milestoneEmoji" style="text-align:center;">✨</div>
      <div class="milestoneTitle" style="text-align:center;color:var(--gold);">What's New</div>
      <div style="font-size:14px;line-height:1.5;color:var(--ink);margin:4px 0 6px;">${CHANGELOG_ITEMS[0]}</div>
      <div style="font-size:11px;color:var(--muted);margin:0 0 16px;">Version ${APP_VERSION}</div>
      <button class="primary" id="changelogCloseBtn" style="width:100%;">Got it!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("changelogCloseBtn").addEventListener("click", () => {
    overlay.remove();
    localStorage.setItem("changelogVersionSeen", APP_VERSION);
  });
}

document.getElementById("langToggle").addEventListener("click", () => {
  const current = localStorage.getItem("appLanguage") || "en";
  localStorage.setItem("appLanguage", current === "hi" ? "en" : "hi");
  applyLanguagePreference();
});

/* ===================== PINNED TOOLS (home screen) ===================== */
function getPinnedSections() {
  try { return JSON.parse(localStorage.getItem("pinnedSections") || "[]"); }
  catch (e) { return []; }
}

function applyPinnedOrder() {
  const pinned = getPinnedSections();
  const sidebar = document.getElementById("mainSidebar");
  const banner = document.getElementById("quickInsightsBanner");

  document.querySelectorAll("#mainSidebar > .navItem").forEach(btn => {
    const isPinned = pinned.includes(btn.dataset.section);
    const pinEl = btn.querySelector(".navPin");
    pinEl.textContent = isPinned ? "★" : "☆";
    pinEl.classList.toggle("pinned", isPinned);
  });

  // Reorder: pinned tiles first (in the order they were pinned), then the rest
  // in their original order - banner always stays at the very top.
  const allItems = Array.from(document.querySelectorAll("#mainSidebar > .navItem"));
  const pinnedItems = pinned.map(sec => allItems.find(b => b.dataset.section === sec)).filter(Boolean);
  let restItems = allItems.filter(b => !pinned.includes(b.dataset.section));
  // custom order from "Edit home" (Menu -> Icon Style -> Edit home)
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("homeTileOrder") || "[]"); } catch (e) {}
  if (!window._homeDefaultOrder) window._homeDefaultOrder = allItems.map(b => b.dataset.section);
  if (saved.length) {
    const rank = sec => { const k = saved.indexOf(sec); return k === -1 ? 1000 + window._homeDefaultOrder.indexOf(sec) : k; };
    restItems = restItems.slice().sort((a, b) => rank(a.dataset.section) - rank(b.dataset.section));
  }
  [...pinnedItems, ...restItems].forEach(btn => sidebar.appendChild(btn));
  sidebar.prepend(document.getElementById("homeHeroRow") || banner);
  applyNavGroupOrder();   // "Grouped into sections" icon style
}
applyPinnedOrder();

document.querySelectorAll("#mainSidebar .navPin").forEach(pinEl => {
  pinEl.addEventListener("click", (e) => {
    e.stopPropagation(); // don't trigger the tile's own navigation click
    const section = pinEl.closest(".navItem").dataset.section;
    let pinned = getPinnedSections();
    if (pinned.includes(section)) {
      pinned = pinned.filter(s => s !== section);
    } else {
      pinned.push(section);
    }
    localStorage.setItem("pinnedSections", JSON.stringify(pinned));
    applyPinnedOrder();
  });
});

/* ===================== HOME ICON STYLES (Menu -> Icon Style) ===================== */
// 7 looks for the home grid; the choice is remembered on this device.
// Line icons: Tabler Icons (MIT licence), drawn in the current text colour.
const NAV_SVG = {"aop": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\"/> <path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z\"/> <path d=\"M8 11h8v7h-8z\"/> <path d=\"M8 15h8\"/> <path d=\"M11 11v7\"/>", "dashboard": "<path d=\"M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\"/> <path d=\"M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\"/> <path d=\"M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\"/> <path d=\"M4 20h14\"/>","stock": "<path d=\"M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5\"/> <path d=\"M12 12l8 -4.5\"/> <path d=\"M12 12l0 9\"/> <path d=\"M12 12l-8 -4.5\"/> <path d=\"M16 5.25l-8 4.5\"/>","rmdesc": "<path d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2\"/>","outofspec": "<path d=\"M12 9v4\"/> <path d=\"M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z\"/> <path d=\"M12 16h.01\"/>","erpprod": "<path d=\"M3 21h18\"/> <path d=\"M5 21v-12l5 4v-4l5 4h4\"/> <path d=\"M19 21v-8l-1.436 -9.574a.5 .5 0 0 0 -.495 -.426h-1.145a.5 .5 0 0 0 -.494 .418l-1.43 8.582\"/> <path d=\"M9 17h1\"/> <path d=\"M14 17h1\"/>","debitnote": "<path d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2\"/> <path d=\"M15 7h-6h1a3 3 0 0 1 0 6h-1l3 3\"/> <path d=\"M9 10h6\"/>","trends": "<path d=\"M3 17l6 -6l4 4l8 -8\"/> <path d=\"M14 7l7 0l0 7\"/>","whatsapp": "<path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\"/> <path d=\"M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\"/> <path d=\"M9 12l.01 0\"/> <path d=\"M13 12l2 0\"/> <path d=\"M9 16l.01 0\"/> <path d=\"M13 16l2 0\"/>","heatwiseconsumption": "<path d=\"M7 20l10 0\"/> <path d=\"M6 6l6 -1l6 1\"/> <path d=\"M12 3l0 17\"/> <path d=\"M9 12l-3 -6l-3 6a3 3 0 0 0 6 0\"/> <path d=\"M21 12l-3 -6l-3 6a3 3 0 0 0 6 0\"/>","partyreports": "<path d=\"M9 3l6 0\"/> <path d=\"M10 9l4 0\"/> <path d=\"M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6\"/>","nextday": "<path d=\"M12.5 21h-6.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5\"/> <path d=\"M16 3v4\"/> <path d=\"M8 3v4\"/> <path d=\"M4 11h16\"/> <path d=\"M16 19h6\"/> <path d=\"M19 16v6\"/>","reports": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\"/> <path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z\"/> <path d=\"M9 9l1 0\"/> <path d=\"M9 13l6 0\"/> <path d=\"M9 17l6 0\"/>","edgecrack": "<path d=\"M5 21h14\"/> <path d=\"M6 18h2\"/> <path d=\"M7 18v3\"/> <path d=\"M9 11l3 3l6 -6l-3 -3z\"/> <path d=\"M10.5 12.5l-1.5 1.5\"/> <path d=\"M17 3l3 3\"/> <path d=\"M12 21a6 6 0 0 0 3.715 -10.712\"/>","iso9001": "<path d=\"M15 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/> <path d=\"M13 17.5v4.5l2 -1.5l2 1.5v-4.5\"/> <path d=\"M10 19h-5a2 2 0 0 1 -2 -2v-10c0 -1.1 .9 -2 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -1 1.73\"/> <path d=\"M6 9l12 0\"/> <path d=\"M6 12l3 0\"/> <path d=\"M6 15l2 0\"/>","inwardqc": "<path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\"/> <path d=\"M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\"/> <path d=\"M9 17v-5\"/> <path d=\"M12 17v-1\"/> <path d=\"M15 17v-3\"/>","smartsummary": "<path d=\"M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0\"/> <path d=\"M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0\"/> <path d=\"M3 6l0 13\"/> <path d=\"M12 6l0 13\"/> <path d=\"M21 6l0 13\"/>","whatif": "<path d=\"M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\"/> <path d=\"M12 7a5 5 0 1 0 5 5\"/> <path d=\"M13 3.055a9 9 0 1 0 7.941 7.945\"/> <path d=\"M15 6v3h3l3 -3h-3v-3z\"/> <path d=\"M15 9l-3 3\"/>","askdata": "<path d=\"M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z\"/> <path d=\"M9.5 9h.01\"/> <path d=\"M14.5 9h.01\"/> <path d=\"M9.5 13a3.5 3.5 0 0 0 5 0\"/>","indstd": "<path d=\"M5 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z\"/> <path d=\"M9 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z\"/> <path d=\"M5 8h4\"/> <path d=\"M9 16h4\"/> <path d=\"M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041z\"/> <path d=\"M14 9l4 -1\"/> <path d=\"M16 16l3.923 -.98\"/>","sopwi": "<path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\"/> <path d=\"M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\"/> <path d=\"M9 14l2 2l4 -4\"/>", "element": "<path d=\"M9 3l6 0\"/> <path d=\"M10 9l4 0\"/> <path d=\"M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6\"/>", "msheet": "<path d=\"M4 4h16v16h-16z\"/> <path d=\"M4 10h16\"/> <path d=\"M4 15h16\"/> <path d=\"M10 4v16\"/>", "marketdash": "<path d=\"M6 11v9\"/> <path d=\"M4.5 13.5h3v4h-3z\"/> <path d=\"M12 6v11\"/> <path d=\"M10.5 8.5h3v5.5h-3z\"/> <path d=\"M18 3v9\"/> <path d=\"M16.5 5h3v4.5h-3z\"/> <path d=\"M3 21h18\"/>"};
const NAV_GROUP = { dashboard: "prod", whatsapp: "prod", nextday: "prod", erpprod: "prod", trends: "prod",
  smartsummary: "prod", whatif: "prod", heatwiseconsumption: "prod",
  outofspec: "qual", edgecrack: "qual", partyreports: "qual", iso9001: "qual", inwardqc: "qual",
  stock: "stock", rmdesc: "stock", debitnote: "stock",
  reports: "docs", indstd: "docs", sopwi: "docs", askdata: "docs", element: "qual", marketdash: "prod", aop: "docs" };
const NAV_GROUP_LABEL = { pinned: "★ Pinned", prod: "Production", qual: "Quality", stock: "Stock & Raw Material", docs: "Documents" };
const NAV_SUB = { dashboard: "Production overview", stock: "Billet & RM stock", rmdesc: "Raw material details",
  outofspec: "Chemistry out of spec", erpprod: "ERP production & ERP entry", debitnote: "SI debit notes", trends: "Trend charts",
  whatsapp: "WhatsApp / paste entry", heatwiseconsumption: "Consumption per heat", partyreports: "Party test certificates",
  nextday: "Next day blocks", reports: "PDF reports", edgecrack: "Edge crack QC", iso9001: "NCR, calibration, vendors",
  inwardqc: "Quarter reports", smartsummary: "Smart summary", whatif: "What-if simulator", askdata: "Ask your data",
  indstd: "Indian Standards", sopwi: "SOP / work instructions", element: "Solutions, periodic table, safety", marketdash: "Swing market health (admin)", aop: "Annual operating plan" };
const ICON_STYLES = [
  { id: "classic", name: "Classic", note: "Glossy navy tiles with colour emoji (the current look)" },
  { id: "flat", name: "1. Flat gold line icons", note: "Clean and professional, all icons one set" },
  { id: "group", name: "2. Colour by kind of work", note: "Production blue, Quality green, Stock amber, Documents violet" },
  { id: "ring", name: "3. Round icons, gold ring", note: "Light, phone-style" },
  { id: "outline", name: "4. Emoji with gold outline", note: "Same emoji, simple gold border" },
  { id: "cards", name: "5. Cards with information", note: "Name plus a line of live information" },
  { id: "sections", name: "6. Grouped into sections", note: "Production, Quality, Stock, Documents headings" }
];
window._homeLive = window._homeLive || {};

// Inner page icon grids (Dashboard, Trends, Production Update, Reports, ISO 9001)
const SUB_SVG = {"daily": "<path d=\"M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z\"/> <path d=\"M16 3l0 4\"/> <path d=\"M8 3l0 4\"/> <path d=\"M4 11l16 0\"/> <path d=\"M8 15h2v2h-2z\"/>", "period": "<path d=\"M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\"/> <path d=\"M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\"/> <path d=\"M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\"/> <path d=\"M4 20h14\"/>", "mom": "<path d=\"M4 19l16 0\"/> <path d=\"M4 15l4 -6l4 2l4 -5l4 4\"/>", "calendar": "<path d=\"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z\"/> <path d=\"M16 3v4\"/> <path d=\"M8 3v4\"/> <path d=\"M4 11h16\"/> <path d=\"M11 15h1\"/> <path d=\"M12 15v3\"/>", "linechart": "<path d=\"M4 19l16 0\"/> <path d=\"M4 15l4 -6l4 2l4 -5l4 4\"/>", "pie": "<path d=\"M10 3.2a9 9 0 1 0 10.8 10.8a1 1 0 0 0 -1 -1h-6.8a2 2 0 0 1 -2 -2v-7a.9 .9 0 0 0 -1 -.8\"/> <path d=\"M15 3.5a9 9 0 0 1 5.5 5.5h-4.5a1 1 0 0 1 -1 -1v-4.5\"/>", "sizewise": "<path d=\"M17 3l4 4l-14 14l-4 -4z\"/> <path d=\"M16 7l-1.5 -1.5\"/> <path d=\"M13 10l-1.5 -1.5\"/> <path d=\"M10 13l-1.5 -1.5\"/> <path d=\"M7 16l-1.5 -1.5\"/>", "chemical": "<path d=\"M6.1 15h11.8\"/> <path d=\"M14 3v7.342a6 6 0 0 1 1.318 10.658h-6.635a6 6 0 0 1 1.317 -10.66v-7.34h4z\"/> <path d=\"M9 3h6\"/>", "update": "<path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\"/> <path d=\"M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\"/> <path d=\"M9 12l.01 0\"/> <path d=\"M13 12l2 0\"/> <path d=\"M9 16l.01 0\"/> <path d=\"M13 16l2 0\"/>", "hotout": "<path d=\"M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 3 -4 2z\"/>", "rhf": "<path d=\"M12 4l-8 4l8 4l8 -4l-8 -4\"/> <path d=\"M4 12l8 4l8 -4\"/> <path d=\"M4 16l8 4l8 -4\"/>", "rawmaterial": "<path d=\"M12 17l-2 2l2 2\"/> <path d=\"M10 19h9a2 2 0 0 0 1.75 -2.75l-.55 -1\"/> <path d=\"M8.536 11l-.732 -2.732l-2.732 .732\"/> <path d=\"M7.804 8.268l-4.5 7.794a2 2 0 0 0 1.506 2.89l1.141 .024\"/> <path d=\"M15.464 11l2.732 .732l.732 -2.732\"/> <path d=\"M18.196 11.732l-4.5 -7.794a2 2 0 0 0 -3.256 -.14l-.591 .976\"/>", "logsheet": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\"/> <path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z\"/> <path d=\"M8 11h8v7h-8z\"/> <path d=\"M8 15h8\"/> <path d=\"M11 11v7\"/>", "billetstock": "<path d=\"M7 16.5l-5 -3l5 -3l5 3v5.5l-5 3z\"/> <path d=\"M2 13.5v5.5l5 3\"/> <path d=\"M7 16.545l5 -3.03\"/> <path d=\"M17 16.5l-5 -3l5 -3l5 3v5.5l-5 3z\"/> <path d=\"M12 19l5 3\"/> <path d=\"M17 16.5l5 -3\"/> <path d=\"M12 13.5v-5.5l-5 -3l5 -3l5 3v5.5\"/> <path d=\"M7 5.03v5.455\"/> <path d=\"M12 8l5 -3\"/>", "stripmill": "<path d=\"M4 21c1.147 -4.02 1.983 -8.027 2 -12h6c.017 3.973 .853 7.98 2 12\"/> <path d=\"M12.5 13h4.5c.025 2.612 .894 5.296 2 8\"/> <path d=\"M9 5a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1\"/> <path d=\"M3 21l19 0\"/>", "stockdiff": "<path d=\"M11 16h10\"/> <path d=\"M11 16l4 4\"/> <path d=\"M11 16l4 -4\"/> <path d=\"M13 8h-10\"/> <path d=\"M13 8l-4 4\"/> <path d=\"M13 8l-4 -4\"/>", "bisdoc": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\"/> <path d=\"M5 8v-3a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5\"/> <path d=\"M6 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/> <path d=\"M4.5 17l-1.5 5l3 -1.5l3 1.5l-1.5 -5\"/>", "testcert": "<path d=\"M12 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/> <path d=\"M10 7h4\"/> <path d=\"M10 18v4l2 -1l2 1v-4\"/> <path d=\"M10 19h-2a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-2\"/>", "rmscrap": "<path d=\"M12 17l-2 2l2 2\"/> <path d=\"M10 19h9a2 2 0 0 0 1.75 -2.75l-.55 -1\"/> <path d=\"M8.536 11l-.732 -2.732l-2.732 .732\"/> <path d=\"M7.804 8.268l-4.5 7.794a2 2 0 0 0 1.506 2.89l1.141 .024\"/> <path d=\"M15.464 11l2.732 .732l.732 -2.732\"/> <path d=\"M18.196 11.732l-4.5 -7.794a2 2 0 0 0 -3.256 -.14l-.591 .976\"/>", "slagcrusher": "<path d=\"M19.875 6.27a2.225 2.225 0 0 1 1.125 1.948v7.284c0 .809 -.443 1.555 -1.158 1.948l-6.75 4.27a2.269 2.269 0 0 1 -2.184 0l-6.75 -4.27a2.225 2.225 0 0 1 -1.158 -1.948v-7.285c0 -.809 .443 -1.554 1.158 -1.947l6.75 -3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98h-.033z\"/> <path d=\"M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/>", "mis": "<path d=\"M8 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h5.697\"/> <path d=\"M18 14v4h4\"/> <path d=\"M18 11v-4a2 2 0 0 0 -2 -2h-2\"/> <path d=\"M8 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\"/> <path d=\"M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\"/> <path d=\"M8 11h4\"/> <path d=\"M8 15h3\"/>", "ncr": "<path d=\"M12.802 2.165l5.575 2.389c.48 .206 .863 .589 1.07 1.07l2.388 5.574c.22 .512 .22 1.092 0 1.604l-2.389 5.575c-.206 .48 -.589 .863 -1.07 1.07l-5.574 2.388c-.512 .22 -1.092 .22 -1.604 0l-5.575 -2.389a2.036 2.036 0 0 1 -1.07 -1.07l-2.388 -5.574a2.036 2.036 0 0 1 0 -1.604l2.389 -5.575c.206 -.48 .589 -.863 1.07 -1.07l5.574 -2.388a2.036 2.036 0 0 1 1.604 0z\"/> <path d=\"M12 8v4\"/> <path d=\"M12 16h.01\"/>", "calibration": "<path d=\"M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5\"/>", "vendor": "<path d=\"M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572\"/> <path d=\"M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25\"/> <path d=\"M12.5 15.5l2 2\"/> <path d=\"M15 13l2 2\"/>", "traceability": "<path d=\"M9 15l6 -6\"/> <path d=\"M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464\"/> <path d=\"M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463\"/>", "objectives": "<path d=\"M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\"/> <path d=\"M12 7a5 5 0 1 0 5 5\"/> <path d=\"M13 3.055a9 9 0 1 0 7.941 7.945\"/> <path d=\"M15 6v3h3l3 -3h-3v-3z\"/> <path d=\"M15 9l-3 3\"/>", "pack": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\"/> <path d=\"M5 8v-3a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5\"/> <path d=\"M6 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/> <path d=\"M4.5 17l-1.5 5l3 -1.5l3 1.5l-1.5 -5\"/>", "rmdaily": "<path d=\"M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z\"/> <path d=\"M3 10h18\"/> <path d=\"M3 15h18\"/> <path d=\"M10 3v18\"/>", "spongenote": "<path d=\"M13 20l7 -7\"/> <path d=\"M13 20v-6a1 1 0 0 1 1 -1h6v-7a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7\"/>", "solution": "<path d=\"M9 3l6 0\"/> <path d=\"M10 9l4 0\"/> <path d=\"M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6\"/>", "ptable": "<path d=\"M4 4h6v6h-6z\"/> <path d=\"M14 4h6v6h-6z\"/> <path d=\"M4 14h6v6h-6z\"/> <path d=\"M14 14h6v6h-6z\"/>", "sds": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\"/> <path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z\"/> <path d=\"M12 11l-3 6h6z\"/>", "safety": "<path d=\"M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06\"/> <path d=\"M15 19l2 2l4 -4\"/>"};
const SUBNAV_GROUP = { erpSubNav: "prod", marketSubNav: "prod", elementSubNav: "qual", dashboardSubNav: "prod", trendsSubNav: "prod", whatsappSubNav: "prod", reportsSubNav: "docs", iso9001SubNav: "qual" };
function setupSubNavIcons() {
  document.querySelectorAll(".sidebar.subNav").forEach(sn => {
    sn.dataset.grp = SUBNAV_GROUP[sn.id] || "docs";
    sn.querySelectorAll(":scope > .navItem").forEach(btn => {
      const key = Object.keys(btn.dataset).filter(k => /^sub/.test(k)).map(k => btn.dataset[k])[0];
      const ic = btn.querySelector(".navIcon");
      if (ic && SUB_SVG[key] && !ic.querySelector(".navSvg")) {
        ic.insertAdjacentHTML("beforeend", `<svg class="navSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SUB_SVG[key]}</svg>`);
      }
      // the name is a bare text node - wrap it so every style can place it
      Array.from(btn.childNodes).forEach(n => {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const sp = document.createElement("span"); sp.className = "subLabel"; sp.textContent = n.textContent.trim();
          btn.replaceChild(sp, n);
        }
      });
    });
  });
}

function setupNavIcons(root) {
  const sb = root || document.getElementById("mainSidebar");
  if (!sb) return;
  sb.querySelectorAll(":scope > .navItem").forEach(btn => {
    const sec = btn.dataset.section;
    const ic = btn.querySelector(".navIcon");
    if (ic && NAV_SVG[sec] && !ic.querySelector(".navSvg")) {
      ic.insertAdjacentHTML("beforeend", `<svg class="navSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_SVG[sec]}</svg>`);
    }
    btn.dataset.grp = NAV_GROUP[sec] || "docs";
    if (!btn.querySelector(".navSub")) {
      const sub = document.createElement("span");
      sub.className = "navSub";
      btn.appendChild(sub);
    }
  });
  if (!root) {
    ["pinned", "prod", "qual", "stock", "docs"].forEach(g => {
      if (!sb.querySelector(`.navGroupHead[data-grp="${g}"]`)) {
        const h = document.createElement("div");
        h.className = "navGroupHead"; h.dataset.grp = g; h.dataset.enText = NAV_GROUP_LABEL[g]; h.textContent = uiT(NAV_GROUP_LABEL[g]);
        sb.appendChild(h);
      }
    });
  }
  updateNavSubs(sb);
}

// Group order for "Grouped into sections" (CSS order, so pinning keeps working).
function applyNavGroupOrder() {
  const sb = document.getElementById("mainSidebar");
  if (!sb) return;
  const on = sb.dataset.ico === "sections";
  const pinned = (typeof getPinnedSections === "function") ? getPinnedSections() : [];
  const base = { pinned: 100, prod: 200, qual: 300, stock: 400, docs: 500 };
  const items = Array.from(sb.querySelectorAll(":scope > .navItem"));
  items.forEach((btn, i) => {
    if (!on) { btn.style.order = ""; return; }
    const g = pinned.includes(btn.dataset.section) ? "pinned" : (btn.dataset.grp || "docs");
    btn.style.order = String(base[g] + 1 + i);
  });
  sb.querySelectorAll(":scope > .navGroupHead").forEach(h => {
    const g = h.dataset.grp;
    h.style.order = on ? String(base[g]) : "";
    const has = items.some(b => !b.classList.contains("askDataTileHidden") &&
      (g === "pinned" ? pinned.includes(b.dataset.section) : (!pinned.includes(b.dataset.section) && b.dataset.grp === g)));
    h.classList.toggle("hidden", !has);
  });
}

// Second line on the cards: live where the app already knows it, otherwise a short description.
function updateNavSubs(root) {
  const sb = root || document.getElementById("mainSidebar");
  if (!sb) return;
  const L = window._homeLive || {};
  const live = {};
  try {
    const note = localStorage.getItem("waInboxLastNote"), at = parseInt(localStorage.getItem("waInboxLastAt") || "0", 10);
    if (note && at) {
      const d = new Date(at);
      const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      live.whatsapp = `${d.toDateString() === new Date().toDateString() ? "Today " : d.getDate() + "/" + (d.getMonth() + 1) + " "}${t} · ${note}`;
    }
    const lb = localStorage.getItem("lastBlockDate");
    if (lb) live.nextday = "Last block: " + lb;
  } catch (e) {}
  if (typeof L.monthProd === "number") live.dashboard = `Month: ${Math.round(L.monthProd)} MT`;
  if (typeof L.offSpec === "number") live.outofspec = L.offSpec ? `Today: ${L.offSpec} flagged` : "Today: all in spec";
  sb.querySelectorAll(":scope > .navItem").forEach(btn => {
    const el = btn.querySelector(".navSub");
    if (el) { const v = live[btn.dataset.section] || NAV_SUB[btn.dataset.section] || ""; el.dataset.enText = v; el.textContent = uiT(v); }
  });
}

// "Month: N MT" line on the Dashboard card (Cards icon style only, one read of the Prod. sheet).
let _homeProdLoading = false;
async function loadHomeMonthProd() {
  const sb = document.getElementById("mainSidebar");
  let signedIn = false;
  try { signedIn = !!account; } catch (e) { signedIn = false; }   // not set up yet while the page is loading
  let wantProd = false;
  try { wantProd = sb && (sb.dataset.ico === "cards" || !!sb.querySelector(":scope > .navItem.tileWide") ||
    parseFloat(localStorage.getItem("monthProdTarget") || "0") > 0); } catch (e) {}
  if (!sb || !wantProd || !signedIn || _homeProdLoading || typeof (window._homeLive || {}).monthProd === "number") return;
  // the home screen re-reads the Excel file at most every 2 hours (saved figure in between)
  const ymKey = (() => { const d = new Date(); return d.getFullYear() + "-" + d.getMonth(); })();
  try {
    const c = JSON.parse(localStorage.getItem("homeMonthProdCache") || "null");
    if (c && c.ym === ymKey && typeof c.v === "number" && Date.now() - c.t < 2 * 3600000) {
      window._homeLive = Object.assign(window._homeLive || {}, { monthProd: c.v }); updateNavSubs();
      try { window.dispatchEvent(new Event("homeLive")); } catch (e) {}
      return;
    }
  } catch (e) {}
  _homeProdLoading = true;
  try {
    const token = await getToken(); if (!token) return;
    const now = new Date();
    const path = await detectFilePathForMonth(token, now.getFullYear(), now.getMonth());
    if (!path) return;
    const wb = await resolveWorkbook(token, path);
    const prod = await getMonthProductionFromProdSheet(wb, token, true);
    if (typeof prod === "number" && prod > 0) { try { localStorage.setItem("homeMonthProdCache", JSON.stringify({ ym: ymKey, v: prod, t: Date.now() })); } catch (e) {} window._homeLive = Object.assign(window._homeLive || {}, { monthProd: prod }); updateNavSubs(); try { window.dispatchEvent(new Event("homeLive")); } catch (e) {} }
  } catch (e) { /* the card keeps its short description */ }
  finally { _homeProdLoading = false; }
}

function applyIconStyle(id) {
  if (!ICON_STYLES.some(s => s.id === id)) id = "classic";
  const sb = document.getElementById("mainSidebar");
  if (sb) sb.dataset.ico = id;
  document.querySelectorAll(".sidebar.subNav").forEach(sn => { sn.dataset.ico = id; });   // inner pages follow the same style
  try { localStorage.setItem("homeIconStyle", id); } catch (e) {}
  applyNavGroupOrder();
  document.querySelectorAll("#iconStyleList .icoOpt").forEach(b => b.classList.toggle("sel", b.dataset.ico === id));
  if (id === "cards") mzAfterLoad(loadHomeMonthProd);   // at start: only after every part of the app has loaded
}

function buildIconStyleList() {
  const list = document.getElementById("iconStyleList");
  if (!list || list.children.length) return;
  const sb = document.getElementById("mainSidebar");
  const sample = ["dashboard", "stock", "outofspec"].map(sec => sb.querySelector(`:scope > .navItem[data-section="${sec}"]`)).filter(Boolean);
  ICON_STYLES.forEach(st => {
    const opt = document.createElement("button");
    opt.type = "button"; opt.className = "icoOpt"; opt.dataset.ico = st.id;
    opt.innerHTML = `<b>${st.name}</b><small>${st.note}</small>`;
    const prev = document.createElement("div");
    prev.className = "sidebar icoPrev"; prev.dataset.ico = st.id;
    sample.forEach((b, i) => {
      const c = b.cloneNode(true);
      c.classList.remove("active"); if (i === 0) c.classList.add("active");
      c.removeAttribute("id"); c.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
      c.removeAttribute("data-section");   // preview only - must never be picked up as a real menu tile
      c.style.order = "";
      prev.appendChild(c);
    });
    updateNavSubs(prev);
    opt.appendChild(prev);
    opt.addEventListener("click", () => applyIconStyle(st.id));
    list.appendChild(opt);
  });
}
function openIconStylePicker() {
  buildIconStyleList();
  applyIconStyle(localStorage.getItem("homeIconStyle") || "classic");
  document.getElementById("iconStyleOverlay").classList.remove("hidden");
}
(function initIconStyles() {
  // Greeting card + day card share one row (side by side in Classic / Outline,
  // stacked full width in the other styles via display:contents).
  const sb0 = document.getElementById("mainSidebar");
  if (sb0 && !document.getElementById("homeHeroRow")) {
    const row = document.createElement("div");
    row.id = "homeHeroRow"; row.className = "homeHeroRow";
    const ban = document.getElementById("quickInsightsBanner"), day = document.getElementById("dayStickerWrap");
    sb0.prepend(row);
    if (ban) row.appendChild(ban);
    if (day) row.appendChild(day);
  }
  setupNavIcons();
  setupSubNavIcons();
  try { uiLangApply(); } catch (e) {}
  let saved = "classic";
  try { saved = localStorage.getItem("homeIconStyle") || "classic"; } catch (e) {}
  applyIconStyle(saved);
  const ov = document.getElementById("iconStyleOverlay");
  document.getElementById("iconStyleCloseBtn").addEventListener("click", () => ov.classList.add("hidden"));
  ov.addEventListener("click", e => { if (e.target === ov) ov.classList.add("hidden"); });
})();

document.getElementById("darkModeToggle").addEventListener("click", (evt) => {
  const wipe = document.getElementById("themeWipe");
  const btnRect = evt.currentTarget.getBoundingClientRect();
  const originX = btnRect.left + btnRect.width / 2;
  const originY = btnRect.top + btnRect.height / 2;
  wipe.style.left = originX + "px";
  wipe.style.top = originY + "px";

  if ((localStorage.getItem("themeColor") || "clean") !== "clean") return;   // Day / Night is only for the Clean theme
  const nightNext = !document.body.classList.contains("clean-night");
  wipe.style.background = nightNext ? "#0f0f11" : "#f3ede3";
  wipe.classList.remove("wiping");
  void wipe.offsetWidth; // restart animation
  wipe.classList.add("wiping");
  localStorage.setItem("cleanNight", nightNext ? "1" : "0");
  if (typeof window.applyTheme === "function") window.applyTheme("clean"); else applyDarkModePreference();
});

/* ===================== SETTINGS MENU ===================== */
const settingsMenuBtn = document.getElementById("settingsMenuBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsBackdrop = document.getElementById("settingsBackdrop");
function openSettingsPanel() {
  settingsPanel.classList.remove("closed");
  settingsBackdrop.classList.remove("closed");
}
function closeSettingsPanel() {
  settingsPanel.classList.add("closed");
  settingsBackdrop.classList.add("closed");
}
settingsMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (settingsPanel.classList.contains("closed")) openSettingsPanel();
  else closeSettingsPanel();
});
settingsBackdrop.addEventListener("click", closeSettingsPanel);
// Close the menu after any action inside it, so it doesn't stay open
// covering the screen once the user has made their choice.
settingsPanel.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", closeSettingsPanel);
});

document.getElementById("fileLocationMenuBtn").addEventListener("click", () => {
  document.querySelectorAll("#mainSidebar > .navItem").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".sectionPanel").forEach(p => p.classList.add("hidden"));
  document.getElementById("section-filelocation").classList.remove("hidden");
  document.getElementById("mainSidebar").classList.add("hidden");
  document.getElementById("contentArea").classList.remove("hidden");
  if (typeof gsShowTiles === "function") gsShowTiles();
  window.scrollTo({ top: 0, behavior: "instant" });
});

document.getElementById("refreshPageBtn").addEventListener("click", () => {
  location.reload();
});
document.getElementById("refreshCornerBtn").addEventListener("click", (e) => {
  e.currentTarget.classList.add("busy");   // spin like the Fetch button while the page reloads
  location.reload();
});

/* ===================== VIBRATION TOGGLE ===================== */
const vibrationToggle = document.getElementById("vibrationToggle");
let vibrationEnabled = localStorage.getItem("vibrationEnabled") !== "false"; // default ON
function updateVibrationLabel() {
  vibrationToggle.textContent = `📳 Vibration: ${vibrationEnabled ? "ON" : "OFF"}`;
}
updateVibrationLabel();
vibrationToggle.addEventListener("click", () => {
  vibrationEnabled = !vibrationEnabled;
  localStorage.setItem("vibrationEnabled", vibrationEnabled ? "true" : "false");
  updateVibrationLabel();
  if (vibrationEnabled && navigator.vibrate) navigator.vibrate(40);
});
// Call this anywhere a tap/action should give haptic feedback, e.g. on
// button presses or when a report finishes loading:
//   vibrateIfEnabled(30)
function vibrateIfEnabled(ms = 30) {
  if (vibrationEnabled && navigator.vibrate) navigator.vibrate(ms);
}

// Animate a number from its current text up/down to a target value.
// Use anywhere a total/stock figure is dropped in, e.g.:
//   animateCountUp(el, 376.567)
function animateCountUp(el, target, duration = 700, decimals = 3) {
  const startText = (el.textContent || "0").replace(/[^0-9.\-]/g, "");
  const start = parseFloat(startText) || 0;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = start + (target - start) * eased;
    el.textContent = value.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(decimals);
  }
  requestAnimationFrame(tick);
}

// Briefly flash a stock cell green (increase) or red (decrease) the first
// time a value renders, drawing the eye to what changed.
function flashCell(el, isIncrease) {
  el.classList.remove("numberPulseUp", "numberPulseDown");
  void el.offsetWidth;
  el.classList.add(isIncrease ? "numberPulseUp" : "numberPulseDown");
}

/* ===================== DAILY STREAK ===================== */
// Celebration pop-ups (badges like "Data Champion" and day-streak milestones). false = no pop-up, no sound, no vibration.
// Counting, the streak and the entry in the bell list still work. Change to true to get the pop-ups back.
const SHOW_CELEBRATION_POPUPS = false;
const STREAK_MILESTONES = [7, 30, 100, 365];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoYesterday(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayStreak() {
  const streak = parseInt(localStorage.getItem("streakCount") || "0", 10);
  const badge = document.getElementById("streakBadge");
  if (!badge) return;
  if (streak > 0) {
    badge.textContent = `🔥 ${streak} day${streak > 1 ? "s" : ""} streak - keep it going!`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// Called after any successful production/consumption update - the
// meaningful "daily active use" action for this app.
function recordDailyStreak() {
  const today = todayISO();
  const lastActive = localStorage.getItem("lastActiveDate");
  let streak = parseInt(localStorage.getItem("streakCount") || "0", 10);

  if (lastActive === today) {
    // Already recorded today - nothing changes, just refresh the display.
  } else if (lastActive === isoYesterday(today)) {
    streak += 1; // consecutive day
  } else {
    streak = 1; // broke the streak, or first-ever entry
  }

  localStorage.setItem("lastActiveDate", today);
  localStorage.setItem("streakCount", String(streak));
  displayStreak();

  if (STREAK_MILESTONES.includes(streak)) showMilestoneCelebration(streak);
}

function showMilestoneCelebration(streak) {
  addNotification(`${streak}-day streak reached!`, "🏆");
  if (!SHOW_CELEBRATION_POPUPS) return;
  const overlay = document.createElement("div");
  overlay.className = "milestoneOverlay";
  overlay.innerHTML = `
    <div class="milestoneCard">
      <div class="milestoneEmoji">🏆</div>
      <div class="milestoneTitle">${streak}-Day Streak!</div>
      <div class="milestoneSub">You've updated production data ${streak} days in a row. Great consistency!</div>
      <button class="primary" id="milestoneCloseBtn">Nice!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("milestoneCloseBtn").addEventListener("click", () => overlay.remove());
  setTimeout(() => { if (document.body.contains(overlay)) overlay.remove(); }, 6000);
}

displayStreak();

/* ===================== OFFLINE INDICATOR ===================== */
function updateOnlineStatus() {
  document.getElementById("offlineBanner").classList.toggle("hidden", navigator.onLine);
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

/* ===================== DISABLE NATIVE PULL-TO-REFRESH ===================== */
// Some browsers/WebViews still trigger their own pull-to-refresh even with
// overscroll-behavior set in CSS - this blocks the actual gesture: only
// prevents default when at the very top of the page and pulling downward,
// so normal scrolling elsewhere is untouched.
(function blockNativePullToRefresh() {
  let startY = 0;
  document.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    // Skip this guard entirely for touches inside the side drawer (or any
    // other internally-scrollable panel) - otherwise, once the drawer's own
    // list is scrolled, this handler sees the outer page's scrollY as 0 and
    // wrongly blocks further scrolling inside the drawer itself.
    if (e.target.closest && e.target.closest("#navDrawer, .settingsPanel, .notifPanelBox, .pdfModal, .cmdPaletteBox")) {
      return;
    }
    const pullingDown = e.touches[0].clientY > startY;
    if (window.scrollY === 0 && pullingDown) {
      e.preventDefault();
    }
  }, { passive: false });
})();

/* ===================== RECENT ACTIVITY LOG ===================== */
/* ===================== ANIMATED NUMBER COUNTERS ===================== */
// Counts up from 0 to the final value over ~700ms - purely a visual touch
// for dashboard-style stat cards.
function animateNumber(elementId, finalValue, decimals = 0, suffix = "") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const numericFinal = parseFloat(finalValue);
  if (isNaN(numericFinal)) { el.textContent = finalValue; return; } // non-numeric (e.g. "N/A") - just show as-is
  const duration = 700;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = numericFinal * eased;
    el.textContent = current.toFixed(decimals) + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = numericFinal.toFixed(decimals) + suffix; // exact final value
  }
  requestAnimationFrame(step);
}

function formatTimeAgo(isoTime) {
  const diffMs = Date.now() - new Date(isoTime).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
// Activity entries now live in the same Notification Center as everything
// else (achievements, alerts) - addNotification is defined just below.
function recordActivity(description) {
  addNotification(description, "📝");
}

/* ===================== NOTIFICATION CENTER ===================== */
/* ===================== ISO 9001 - NCR / CAPA LOG ===================== */
function getNcrList() {
  try { return JSON.parse(localStorage.getItem("iso9001_ncr") || "[]"); } catch (e) { return []; }
}
function saveNcrList(list) { localStorage.setItem("iso9001_ncr", JSON.stringify(list)); }
function renderNcrTable() {
  const list = getNcrList();
  const table = document.getElementById("ncrTable");
  table.innerHTML = "<tr><th>#</th><th>Date</th><th>Description</th><th>Root Cause</th><th>Action</th><th>Responsible</th><th>Target</th><th>Status</th><th></th></tr>";
  const E = htmlEsc;
  table.innerHTML += list.map((r, idx) => `<tr>
      <td>${idx + 1}</td><td>${E(r.date)}</td><td>${E(r.description)}</td><td>${E(r.rootCause)}</td>
      <td>${E(r.action)}</td><td>${E(r.responsible)}</td><td>${E(r.targetDate)}</td>
      <td>${r.status === "closed" ? "✅ Closed" : "🟠 Open"}</td>
      <td><button class="secondary" onclick="toggleNcrStatus(${idx})" style="padding:4px 8px;font-size:11px;">${r.status === "closed" ? "Reopen" : "Close"}</button></td>
    </tr>`).join("");
}
function toggleNcrStatus(idx) {
  const list = getNcrList();
  list[idx].status = list[idx].status === "closed" ? "open" : "closed";
  saveNcrList(list);
  renderNcrTable();
}
document.getElementById("ncrAddBtn").addEventListener("click", () => {
  const date = document.getElementById("ncrDate").value;
  const description = document.getElementById("ncrDescription").value.trim();
  if (!date || !description) { alert("Please fill in at least Date and Description."); return; }
  const list = getNcrList();
  list.push({
    date, description,
    rootCause: document.getElementById("ncrRootCause").value.trim(),
    action: document.getElementById("ncrAction").value.trim(),
    responsible: document.getElementById("ncrResponsible").value.trim(),
    targetDate: document.getElementById("ncrTargetDate").value,
    status: "open"
  });
  saveNcrList(list);
  ["ncrDate", "ncrDescription", "ncrRootCause", "ncrAction", "ncrResponsible", "ncrTargetDate"].forEach(id => document.getElementById(id).value = "");
  renderNcrTable();
});
document.getElementById("ncrPdfBtn").addEventListener("click", () => {
  const list = getNcrList();
  if (list.length === 0) { alert("No NCR records to export yet."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(31, 56, 100);
  doc.text("Non-Conformance Report (NCR) & CAPA Log", doc.internal.pageSize.getWidth() / 2, 30, { align: "center" });
  doc.autoTable({
    startY: 45,
    head: [["#", "Date", "Description", "Root Cause", "Corrective Action", "Responsible", "Target Date", "Status"]],
    body: list.map((r, i) => [i + 1, r.date, r.description, r.rootCause, r.action, r.responsible, r.targetDate, r.status === "closed" ? "Closed" : "Open"]),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [31, 56, 100] },
    theme: "grid"
  });
  stampLogoOnAllPages(doc);
  showPdfPreview(doc, "NCR_CAPA_Log.pdf", "NCR & CAPA Log");
});

/* ===================== ISO 9001 - EQUIPMENT CALIBRATION LOG ===================== */
function getCalList() {
  try { return JSON.parse(localStorage.getItem("iso9001_cal") || "[]"); } catch (e) { return []; }
}
function saveCalList(list, localOnly) {   // a change you make is copied to OneDrive
  list.forEach((r, i) => { r.sl = i + 1; });   // Sl. runs 1, 2, 3 ... in the log's order (no gaps after a removal / merge)
  localStorage.setItem("iso9001_cal", JSON.stringify(list));
  if (!localOnly) { try { localStorage.setItem("calSavedAt", new Date().toISOString()); } catch (e) {} calQueuePush(); }
}
function calStatusFor(dueDate) {
  if (!dueDate) return { text: "⚪ Date not entered", cls: "" };
  const days = (new Date(dueDate) - new Date(todayISO())) / 86400000;
  if (days < 0) return { text: "🔴 Overdue", cls: "" };
  if (days <= 30) return { text: "🟠 Due Soon", cls: "" };
  return { text: "🟢 OK", cls: "" };
}
// Equipment list from MIPPL_SMS_QAD_CALIBRATION_STATUS_RECORD (Oct 2026). Calibration dates and
// certificate numbers are left blank on purpose - they are entered by hand (Edit).
// Merged once into the log on every device: an instrument already in the log (same ID) keeps its dates.
const CAL_SEED_KEY = "calSeed_2026_10";
const CAL_SEED = [{"sl": 1, "name": "Analog Vernier Caliper", "id": "MIPPL-VC/SMS/01", "make": "Mitutoyo", "model": "532-121", "range": "0 to 300 mm /.02mm", "agency": "TrueCal"}, {"sl": 2, "name": "Steel Scale", "id": "MIPPL-SS/SMS/01", "make": "Ajanta", "model": "", "range": "0 to 30 cm /0.1 cm", "agency": "TrueCal"}, {"sl": 3, "name": "Measuring Tape", "id": "MIPPL-MT/SMS/01", "make": "Freemans", "model": "IND/09/98/220", "range": "0 to 15 mtr / 1 mm", "agency": "TrueCal"}, {"sl": 4, "name": "Measuring Cylinder", "id": "MIPPL-MC1/SMS/01", "make": "", "model": "", "range": "100 to 1000 ml/10 ml", "agency": "TrueCal"}, {"sl": 5, "name": "Measuring Cylinder", "id": "MIPPL-MC2/SMS/01", "make": "", "model": "", "range": "10 to 100 ml/01 ml", "agency": "TrueCal"}, {"sl": 6, "name": "Measuring Cylinder", "id": "MIPPL-MC3/SMS/01", "make": "", "model": "", "range": "10 to 50 ml /01 ml", "agency": "TrueCal"}, {"sl": 7, "name": "Bulb Pipette", "id": "MIPPL-BP1/SMS/01", "make": "Borosil", "model": "", "range": "50 ml", "agency": "TrueCal"}, {"sl": 10, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/01", "make": "Glassco", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 11, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/02", "make": "Glassco", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 12, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/03", "make": "Borosilicate", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 13, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/04", "make": "Glassco", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 14, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/05", "make": "Glassco", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 15, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/06", "make": "Borosilicate", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 16, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/07", "make": "Borosilicate", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 17, "name": "Volumetric Flask", "id": "MIPPL-VF1/SMS/08", "make": "Glassco", "model": "", "range": "500 ml", "agency": "TrueCal"}, {"sl": 18, "name": "Volumetric Flask", "id": "MIPPL-VF2/SMS/01", "make": "Fisher brand", "model": "", "range": "1000 ml", "agency": "TrueCal"}, {"sl": 19, "name": "Volumetric Flask", "id": "MIPPL-VF2/SMS/02", "make": "Glassco", "model": "", "range": "1000 ml", "agency": "TrueCal"}, {"sl": 20, "name": "Volumetric Flask", "id": "MIPPL-VF2/SMS/03", "make": "Glassco", "model": "", "range": "1000 ml", "agency": "TrueCal"}, {"sl": 21, "name": "Volumetric Flask", "id": "MIPPL-VF2/SMS/04", "make": "Glassco", "model": "", "range": "1000 ml", "agency": "TrueCal"}, {"sl": 22, "name": "Volumetric Flask", "id": "MIPPL-VF2/SMS/05", "make": "Glassco", "model": "", "range": "1000 ml", "agency": "TrueCal"}, {"sl": 23, "name": "Volumetric Flask", "id": "MIPPL-VF2/SMS/06", "make": "Glassco", "model": "", "range": "1000 ml", "agency": "TrueCal"}, {"sl": 24, "name": "Burette", "id": "MIPPL-BU1/SMS/01", "make": "Omsons", "model": "", "range": "0 to 50 ml / 0.1 ml", "agency": "TrueCal"}, {"sl": 25, "name": "Burette", "id": "MIPPL-BU1/SMS/02", "make": "Omsons", "model": "", "range": "0 to 50 ml / 0.1 ml", "agency": "TrueCal"}, {"sl": 26, "name": "Burette", "id": "MIPPL-BU1/SMS/03", "make": "Borosil", "model": "", "range": "0 to 50 ml / 0.1 ml", "agency": "TrueCal"}, {"sl": 27, "name": "Burette", "id": "MIPPL-BU1/SMS/04", "make": "Borosil", "model": "", "range": "0 to 50 ml / 0.1 ml", "agency": "TrueCal"}, {"sl": 28, "name": "Burette", "id": "MIPPL-BU1/SMS/05", "make": "Borosil", "model": "", "range": "0 to 50 ml / 0.1 ml", "agency": "TrueCal"}, {"sl": 29, "name": "Burette", "id": "MIPPL-BU1/SMS/06", "make": "Borosil", "model": "", "range": "0 to 50 ml / 0.1 ml", "agency": "TrueCal"}, {"sl": 30, "name": "Glass Thermometer", "id": "MIPPL-TM/SMS/01", "make": "Borosil", "model": "", "range": "10 to 50 °C / 1 °C", "agency": "TrueCal"}, {"sl": 31, "name": "Digital Weighing Balance", "id": "MIPPL-WB/SMS/03", "make": "Prime", "model": "", "range": "0 to 30 kg / 0.002 kg", "agency": "TrueCal"}, {"sl": 32, "name": "Electronic Weighing Balance", "id": "MIPPL-WB/SMS/02", "make": "Saffron", "model": "SES.224", "range": "0 to 220 g / 0.0001 g", "agency": "TrueCal"}, {"sl": 33, "name": "Indicator of Hot Air Oven", "id": "MIPPL-HAO/SMS/01", "make": "D.K Scientific", "model": "", "range": "0 to 300 °C / 1 °C", "agency": "TrueCal"}, {"sl": 34, "name": "Hot Plate", "id": "MIPPL-HP/SMS/01", "make": "Kishore", "model": "", "range": "0 to 300 °C / 10 °C", "agency": "TrueCal"}, {"sl": 35, "name": "Indicator of Muffle Furnace", "id": "MIPPL-MF/SMS/01", "make": "Kishore", "model": "", "range": "0 to 1200 °C / 1 °C", "agency": "TrueCal"}, {"sl": 36, "name": "Temperature Indicator", "id": "MIPPL-TI/SMS/01", "make": "Thermotech", "model": "TIC-4000", "range": "As per Manufacturer Specifications", "agency": "TrueCal"}, {"sl": 37, "name": "Optical Emission Spectrometer", "id": "MIPPL-OES/SMS/01", "make": "Shimadzu", "model": "PDA-5000", "range": "", "agency": "Shimadzu"}];
(function calSeed() {
  try {
    if (localStorage.getItem(CAL_SEED_KEY)) return;
    const norm = t => String(t || "").replace(/\s+/g, "").toUpperCase();
    const list = getCalList();
    CAL_SEED.forEach(e => {
      const cur = list.find(r => norm(r.id) === norm(e.id));
      if (cur) Object.assign(cur, { sl: e.sl, name: e.name, id: e.id, make: e.make, model: e.model, range: e.range, agency: cur.agency || e.agency });
      else list.push({ sl: e.sl, name: e.name, id: e.id, make: e.make, model: e.model, range: e.range, lastDate: "", dueDate: "", agency: e.agency, certNo: "" });
    });
    list.sort((a, b) => (a.sl || 9999) - (b.sl || 9999));
    saveCalList(list, true);
    localStorage.setItem(CAL_SEED_KEY, String(Date.now()));
  } catch (e) {}
})();
let calEditIdx = -1;
const CAL_FORM = { name: "calEquipName", id: "calEquipId", make: "calMake", model: "calModel", range: "calRange", lastDate: "calLastDate", dueDate: "calDueDate", agency: "calAgency", certNo: "calCertNo" };
function renderCalTable() {
  const list = getCalList();
  const table = document.getElementById("calTable");
  const e = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const d = iso => iso ? iso.split("-").reverse().join("-") : "-";
  table.innerHTML = "<tr><th>Sl.</th><th>Equipment</th><th>ID</th><th>Make</th><th>Model</th><th>Range / Accuracy</th><th>Last Cal.</th><th>Due Date</th><th>Agency</th><th>Cert No.</th><th>Certificate</th><th>Status</th><th></th></tr>" +
    list.map((r, idx) => `<tr${idx === calEditIdx ? ' style="outline:2px solid var(--gold);"' : ""}>
      <td>${idx + 1}</td><td>${e(r.name)}</td><td style="white-space:nowrap;">${e(r.id)}</td><td>${e(r.make || "")}</td><td>${e(r.model || "")}</td><td>${e(r.range || "")}</td>
      <td style="white-space:nowrap;">${d(r.lastDate)}</td><td style="white-space:nowrap;">${d(r.dueDate)}</td><td>${e(r.agency)}</td><td>${e(r.certNo)}</td><td>${r.certFile ? `<button class="secondary" onclick="calDownloadCert(${idx})" style="padding:4px 8px;font-size:11px;" title="Download ${e(r.certFile)}">📄 PDF</button>` : "-"}</td><td style="white-space:nowrap;">${calStatusFor(r.dueDate).text}</td>
      <td style="white-space:nowrap;"><button class="secondary" onclick="editCalEntry(${idx})" style="padding:4px 8px;font-size:11px;">Edit</button>
        <button class="secondary" onclick="deleteCalEntry(${idx})" style="padding:4px 8px;font-size:11px;">Remove</button></td>
    </tr>`).join("");
}
function deleteCalEntry(idx) {
  const list = getCalList();
  if (!confirm(`Remove ${list[idx] ? list[idx].name + " (" + list[idx].id + ")" : "this entry"} from the Calibration Log?`)) return;
  list.splice(idx, 1);
  saveCalList(list);
  if (calEditIdx === idx) calEndEdit(); else if (calEditIdx > idx) calEditIdx--;
  renderCalTable();
}
function calEndEdit() {
  calEditIdx = -1;
  Object.values(CAL_FORM).forEach(id => { document.getElementById(id).value = ""; });
  document.getElementById("calAddBtn").textContent = "Add Equipment";
  document.getElementById("calCancelEditBtn").classList.add("hidden");
}
function editCalEntry(idx) {
  const r = getCalList()[idx]; if (!r) return;
  calEditIdx = idx;
  Object.entries(CAL_FORM).forEach(([k, id]) => { document.getElementById(id).value = r[k] || ""; });
  document.getElementById("calAddBtn").textContent = "Save Changes";
  document.getElementById("calFormBox").open = true;
  document.getElementById("calCancelEditBtn").classList.remove("hidden");
  renderCalTable();
  document.getElementById("calEquipName").scrollIntoView({ behavior: "smooth", block: "center" });
}
document.getElementById("calCancelEditBtn").addEventListener("click", () => { calEndEdit(); renderCalTable(); });
document.getElementById("calAddBtn").addEventListener("click", () => {
  const v = {}; Object.entries(CAL_FORM).forEach(([k, id]) => { v[k] = document.getElementById(id).value.trim(); });
  if (!v.name) { alert("Please fill in at least the Equipment Name."); return; }
  if (v.lastDate && v.dueDate && v.dueDate < v.lastDate) { alert("Next Due Date is before the Last Calibration Date - please check."); return; }
  const list = getCalList();
  if (calEditIdx >= 0 && list[calEditIdx]) Object.assign(list[calEditIdx], v);
  else list.push(v);
  saveCalList(list);
  calEndEdit();
  renderCalTable();
  checkCalibrationReminders();
});
document.getElementById("calPdfBtn").addEventListener("click", () => {
  const list = getCalList();
  if (list.length === 0) { alert("No calibration records to export yet."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(31, 56, 100);
  doc.text("Equipment Calibration Log", doc.internal.pageSize.getWidth() / 2, 30, { align: "center" });
  const d = iso => iso ? iso.split("-").reverse().join("-") : "";
  doc.autoTable({
    startY: 45,
    head: [["Sl.", "Equipment", "ID", "Make", "Model", "Range / Accuracy", "Last Cal.", "Due Date", "Agency", "Cert No.", "Status"]],
    body: list.map((r, i) => [i + 1, r.name, r.id, r.make || "", r.model || "", r.range || "", d(r.lastDate), d(r.dueDate), r.agency, r.certNo, calStatusFor(r.dueDate).text.replace(/[🔴🟠🟢⚪]/gu, "").trim()]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [31, 56, 100] },
    margin: { left: 20, right: 20, bottom: 30 },
    theme: "grid"
  });
  stampLogoOnAllPages(doc);
  showPdfPreview(doc, "Equipment_Calibration_Log.pdf", "Equipment Calibration Log");
});

/* ===================== EASIER TO USE (all tiles) ===================== */
(function uxPolish() {
  // 1. a message from one tile is not left showing in the next one
  const navSel = "[data-section],[data-subdash],[data-subelem],[data-subgs],[data-subiso],[data-submkt],[data-subreport],[data-substock],[data-subtrend],[data-subwhatsapp],[data-subaop],.backBtn,.bottomTabItem";
  document.addEventListener("click", e => {
    if (!e.target.closest || !e.target.closest(navSel)) return;
    const st = document.getElementById("status");
    if (st && st.className !== "wait") { st.className = ""; st.textContent = ""; }
  }, true);
  // 2. long help text at the top of a card: two lines + "More"
  const clamp = () => document.querySelectorAll(".card > p").forEach(p => {
    if (p.dataset.ux || p.closest(".hidden.keepOpen")) return;
    const card = p.parentElement, kids = [...card.children], at = kids.indexOf(p);
    const firstCtl = kids.findIndex(k => k.matches("input,select,textarea,button,label,.btnRow,.psvGrid,table,.tableScroll,details") || k.querySelector("input,select,textarea,button"));
    if (firstCtl >= 0 && at > firstCtl) return;            // only the description above the form
    if (p.querySelector("input,select,button,a") || p.textContent.trim().length < 170) return;
    p.dataset.ux = "1"; p.classList.add("uxClamp");
    const b = document.createElement("button"); b.type = "button"; b.className = "uxMore"; b.textContent = "ℹ️ More";
    b.addEventListener("click", () => { const open = p.classList.toggle("uxClamp"); b.textContent = open ? "ℹ️ More" : "▲ Less"; });
    p.after(b);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", clamp); else clamp();
})();
/* ===================== CALIBRATION: instrument IDs from the certificates, OneDrive copy, certificate upload ===================== */
// Instrument IDs / names / makes / ranges as written on the Aug-2026 calibration certificates (the certificate is the record).
// Where a certificate leaves make / model blank, the log's value is kept. TI (Thermotech TIC-4000) = the Muffle Furnace
// controller -> one line (MF). Tube Furnace added. Runs once per log (device copy and OneDrive copy).
const CAL_MIG_TAG = "2026_11";
const CAL_MIG = [
  ["MIPPL-VC/SMS/01", "MIPPL/VC/SMS/01", "Vernier Caliper", "Mitutoyo", "", "(0-300) mm / 0.02 mm"],
  ["MIPPL-SS/SMS/01", "MIPPL/SS/SMS/01", "Steel Scale", "Ajanta", "", "(0-300) mm / 1 mm"],
  ["MIPPL-MT/SMS/01", "MIPPL/MT/SMS/01", "Measuring Tape", "Freemans", "", "(0-10000) mm / 1 mm"],
  ["MIPPL-MC1/SMS/01", "MIPPL/MC/SMS/03", "Measuring Cylinder", "Borosil", "", "500 ml / 10 ml"],
  ["MIPPL-MC2/SMS/01", "MIPPL/MC/SMS/02", "Measuring Cylinder", "Borosil", "", "100 ml / 1 ml"],
  ["MIPPL-MC3/SMS/01", "MIPPL/MC/SMS/01", "Measuring Cylinder", "", "", "50 ml / 1 ml"],
  ["MIPPL-BP1/SMS/01", "MIPPL/BP/SMS/01", "One Mark Pipette", "Borosil", "", "50 ml"],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(k => [`MIPPL-VF1/SMS/0${k}`, `MIPPL/VF/SMS/${String(k + 6).padStart(2, "0")}`, "Volumetric Flask", k === 5 ? "" : "Glassco", "", "500 ml"]),
  ...["Fisherbrand", "Glassco", "Fisherbrand", "Glassco", "Glassco", "Borosilicate"].map((mk, k) => [`MIPPL-VF2/SMS/0${k + 1}`, `MIPPL/VF/SMS-0${k + 1}`, "Volumetric Flask", mk, "", "1000 ml"]),
  ...[1, 2, 3, 4, 5, 6].map(k => [`MIPPL-BU1/SMS/0${k}`, `MIPPL/BU/SMS/0${k}`, "Burette", "Borosil", "", "50 ml / 0.1 ml"]),
  ["MIPPL-TM/SMS/01", "MIPPL/TM/SMS/01", "Glass Thermometer", "", "", "(-10 to 50) °C / 1 °C"],
  ["MIPPL-WB/SMS/03", "MIPPL/DB/SMS/01", "Digital Balance", "Prime", "PS-TT", "30000 g / 2 g"],
  ["MIPPL-WB/SMS/02", "MIPPL/DWB/SMS/02", "Digital Weighing Balance", "Saffron", "SES 224", "220 g / 0.0001 g"],
  ["MIPPL-HAO/SMS/01", "MIPPL/HAO/SMS/01", "Digital Temperature Controller with Sensor of Hot Air Oven", "i-Therm", "AI-7781", "Upto 250 °C / 1 °C"],
  ["MIPPL-HP/SMS/01", "MIPPL/HP/SMS/01", "Thermostatic Controller with Sensor of Hot Plate", "Kishore", "", "Upto 300 °C / 10 °C"],
  ["MIPPL-MF/SMS/01", "MIPPL/MF/SMS/01", "Digital Temperature Controller with Sensor of Muffle Furnace", "Thermotech", "TIC-4000", "Upto 1000 °C / 1 °C"]
];
const calNid = t => String(t || "").replace(/\s+/g, "").toUpperCase();
function calMigrate(list) {
  let changed = false;
  CAL_MIG.forEach(([from, id, name, make, model, range]) => {
    const r = list.find(x => calNid(x.id) === calNid(from)); if (!r) return;
    Object.assign(r, { id, name, range }); if (make) r.make = make; if (model) r.model = model; changed = true;
  });
  const ti = list.findIndex(x => calNid(x.id) === "MIPPL-TI/SMS/01"), mf = list.find(x => calNid(x.id) === "MIPPL/MF/SMS/01");
  if (ti >= 0 && mf) { const t = list[ti]; ["lastDate", "dueDate", "agency", "certNo"].forEach(k => { if (!mf[k] && t[k]) mf[k] = t[k]; }); list.splice(ti, 1); changed = true; }
  if (!list.some(x => calNid(x.id) === "MIPPL/TF/SMS/01")) {
    const at = list.findIndex(x => calNid(x.id) === "MIPPL/MF/SMS/01");
    const row = { sl: 38, name: "Tube Furnace", id: "MIPPL/TF/SMS/01", make: "", model: "", range: "1200 °C (Fixed)", lastDate: "", dueDate: "", agency: "", certNo: "" };
    if (at >= 0) list.splice(at + 1, 0, row); else list.push(row);
    changed = true;
  }
  return changed;
}
(function calMigrateLocal() {
  try {
    if (localStorage.getItem("calMigrate_" + CAL_MIG_TAG)) return;
    const list = getCalList();
    if (list.length && calMigrate(list)) saveCalList(list, true);
    localStorage.setItem("calMigrate_" + CAL_MIG_TAG, String(Date.now()));
  } catch (e) {}
})();

/* ---- OneDrive copy of the log (Apps -> Calibration), so every device and the certificates stay together ---- */
const CAL_DIR = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/Calibration";
const CAL_LOG_URL = `${CAL_DIR}/calibration_log.json:/content`;
let _calPushT = null;
function calQueuePush() {
  try { localStorage.setItem("calDirty", "1"); } catch (e) {}
  clearTimeout(_calPushT);
  _calPushT = setTimeout(() => { calCloudPush().catch(() => {}); }, 1200);
}
async function calCloudPush() {
  if (!account || isViewer()) return;
  const token = await getToken(); if (!token) return;
  const savedAt = localStorage.getItem("calSavedAt") || new Date().toISOString();
  const body = JSON.stringify({ v: 1, mig: [CAL_MIG_TAG], savedAt, list: getCalList() });
  const r = await fetch(CAL_LOG_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body });
  if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
  try { localStorage.removeItem("calDirty"); } catch (e) {}
}
async function calCloudSync() {
  if (!account) return;
  try {
    if (!isViewer() && localStorage.getItem("calDirty")) { await calCloudPush(); return; }
    const token = await getToken(); if (!token) return;
    const r = await fetch(CAL_LOG_URL, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    if (r.status === 404) { if (!isViewer()) await calCloudPush(); return; }
    if (!r.ok) return;
    const j = await r.json();
    const list = Array.isArray(j) ? j : (j.list || []);
    // never let an older OneDrive copy replace newer entries on this device
    const mine = localStorage.getItem("calSavedAt") || "", theirs = (!Array.isArray(j) && j.savedAt) || "";
    const certs = l => l.filter(x => x.certFile || x.certNo || x.lastDate).length;
    if (!isViewer() && (mine > theirs || (!theirs && certs(getCalList()) > certs(list)))) { await calCloudPush(); return; }
    if (theirs) try { localStorage.setItem("calSavedAt", theirs); } catch (e) {}
    const migrated = !Array.isArray(j) && (j.mig || []).includes(CAL_MIG_TAG);
    if (!migrated) calMigrate(list);
    localStorage.setItem("iso9001_cal", JSON.stringify(list));
    if (!migrated && !isViewer()) await calCloudPush();
    renderCalTable(); checkCalibrationReminders();
  } catch (e) {}
}

/* ---- certificate files: Apps -> Calibration -> Certificates ---- */
const calSafe = t => String(t || "").replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "");
async function calPutFile(name, bytes) {
  const token = await getToken(); if (!token) throw new Error("not signed in");
  const path = `${CAL_DIR}/Certificates/${name.split("/").map(encodeURIComponent).join("/")}`;
  if (bytes.byteLength <= 3.5 * 1024 * 1024) {
    const r = await fetch(`${path}:/content`, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/pdf" }, body: bytes });
    if (!r.ok) throw new Error("OneDrive upload failed (" + r.status + ")");
    return;
  }
  const s = await fetch(`${path}:/createUploadSession`, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) });
  if (!s.ok) throw new Error("OneDrive upload failed (" + s.status + ")");
  const { uploadUrl } = await s.json(), CH = 10 * 327680, u8 = new Uint8Array(bytes);
  for (let o = 0; o < u8.length; o += CH) {
    const part = u8.subarray(o, Math.min(o + CH, u8.length));
    const r = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Range": `bytes ${o}-${o + part.length - 1}/${u8.length}` }, body: part });
    if (!r.ok && r.status !== 202) throw new Error("OneDrive upload failed (" + r.status + ")");
  }
}
async function calDownloadCert(idx) {
  const r0 = getCalList()[idx], st = document.getElementById("status");
  if (!r0 || !r0.certFile) return;
  try {
    st.className = "wait"; st.textContent = `Getting the certificate of ${r0.name}...`;
    const token = await getToken(); if (!token) return;
    const r = await fetch(`${CAL_DIR}/Certificates/${encodeURIComponent(r0.certFile)}:/content`, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error(r.status === 404 ? "the certificate file is not in OneDrive (Apps → Calibration → Certificates)" : "OneDrive read failed (" + r.status + ")");
    const blob = new Blob([await r.arrayBuffer()], { type: "application/pdf" });
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = r0.certFile; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 15000);
    st.className = "ok"; st.textContent = `Downloaded ${r0.certFile}`;
  } catch (e) { st.className = "err"; st.textContent = "Certificate: " + e.message; }
}

/* ---- certificates as clear as the original print: text darkened, paper pure white, scan dots removed ---- */
// Levels (60 -> black, 215 -> white, gamma 1.35) on every colour channel, so stamps and logos keep their colour;
// then a dark dot with fewer than 8 dark pixels around it (7 x 7) is a scan speck and is made white.
function calEnhanceCanvas(cv) {
  const w = cv.width, h = cv.height, ctx = cv.getContext("2d"), id = ctx.getImageData(0, 0, w, h), d = id.data;
  const B = 60, W = 215, G = 1.35, lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) { const t = Math.min(1, Math.max(0, (v - B) / (W - B))); lut[v] = Math.round(Math.pow(t, G) * 255); }
  const dark = new Uint8Array(w * h);
  for (let i = 0, q = 0; i < w * h; i++, q += 4) { const r = lut[d[q]], g = lut[d[q + 1]], b = lut[d[q + 2]]; d[q] = r; d[q + 1] = g; d[q + 2] = b; dark[i] = (0.299 * r + 0.587 * g + 0.114 * b) < 200 ? 1 : 0; }
  const W1 = w + 1, I = new Int32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += dark[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
  const R = 3, MIN = 8;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!dark[i]) continue;
      const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
      if (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0] < MIN) { const q = 4 * i; d[q] = d[q + 1] = d[q + 2] = 255; }
    }
  }
  ctx.putImageData(id, 0, 0);
}
// pages of a pdf.js document -> one clear PDF (same page size), as bytes
async function calMakeCleanPdf(pdf, pageNums) {
  const { jsPDF } = window.jspdf;
  let doc = null;
  for (const n of pageNums) {
    const pg = await pdf.getPage(n), base = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 2400 / Math.min(base.width, base.height) });   // about 280 dpi on A4
    const cv = document.createElement("canvas"); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: cx, viewport: vp }).promise;
    calEnhanceCanvas(cv);
    const jpg = new Uint8Array(await (await new Promise(res => cv.toBlob(res, "image/jpeg", 0.82))).arrayBuffer());
    const ori = base.width > base.height ? "l" : "p";
    if (!doc) doc = new jsPDF({ unit: "pt", format: [base.width, base.height], orientation: ori, compress: true });
    else doc.addPage([base.width, base.height], ori);
    doc.addImage(jpg, "JPEG", 0, 0, base.width, base.height, undefined, "FAST");
    cv.width = cv.height = 0;
  }
  return doc.output("arraybuffer");
}
// certificates saved before (scans as they came) -> clear copies; the scan is kept in Certificates/Scans
async function calEnhanceSaved() {
  const st = document.getElementById("status"), say = (t, c) => { st.className = c || "wait"; st.textContent = t; };
  if (isViewer()) { say("👁️ View-only account - certificates can't be changed.", "err"); return; }
  const list = getCalList(), todo = list.filter(r => r.certFile && !r.certEnh);
  if (!todo.length) { say("✅ All saved certificates are already clear.", "ok"); return; }
  if (!confirm(`Make ${todo.length} saved certificate(s) clear (dark text, white paper)? The scanned copies are kept in OneDrive → Apps → Calibration → Certificates → Scans.`)) return;
  try {
    const pdfjsLib = await loadPdfJs();
    let n = 0;
    for (const r of todo) {
      n++; say(`Making certificate ${n} of ${todo.length} clear (${r.id})...`);
      const token = await getToken(); if (!token) return;
      const g = await fetch(`${CAL_DIR}/Certificates/${encodeURIComponent(r.certFile)}:/content`, { headers: { Authorization: "Bearer " + token } });
      if (!g.ok) continue;
      const bytes = await g.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
      const pages = []; for (let p = 1; p <= pdf.numPages; p++) pages.push(p);
      const clean = await calMakeCleanPdf(pdf, pages);
      await calPutFile("Scans/" + r.certFile, bytes);
      await calPutFile(r.certFile, clean);
      r.certEnh = 1;
      saveCalList(list, true);
    }
    await calCloudPush(); renderCalTable();
    say(`✅ ${n} certificate(s) are now clear - 📄 in the log downloads the clear copy.`, "ok");
  } catch (e) { say("Certificate clean-up: " + e.message, "err"); }
}
/* ---- upload: one PDF (several certificates merged) -> pages read (OCR) -> check -> saved ---- */
// The certificates are scans, so the text is read with OCR (Tesseract, in the browser). Every value is shown for checking
// before anything is saved; a value that could not be read stays empty.
const CAL_PDFLIB = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
function calLoadPdfLib() {
  if (window.PDFLib) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = CAL_PDFLIB; s.integrity = "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI"; s.crossOrigin = "anonymous"; s.onload = res; s.onerror = () => rej(new Error("PDF library could not load (internet needed)")); document.head.appendChild(s); });
}
// Reads the certificate fields out of the OCR text (left half, right half, whole width). Empty string = not found.
function calParse(texts) {
  const all = texts.filter(Boolean).join("\n").replace(/[|\[\]{}]/g, " ").replace(/[ \t]+/g, " ");
  const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const DATE = "(?:[lIH|]\\s*|1\\s+)?(\\d{1,2})\\s*[.\\-\\/,:]\\s*(\\d{1,2}|[A-Za-z]{3})\\s*[.\\-\\/,:]\\s*(\\d{4})(?!\\d)";
  const iso = m => { if (!m) return ""; const d = +m[1]; let mo = /^\d+$/.test(m[2]) ? +m[2] : MON.indexOf(m[2].toLowerCase()) + 1; let y = +m[3]; if (y < 100) y += 2000;
    if (!(d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100)) return ""; return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
  const date = re => iso(new RegExp(re + "[^\\d\\n]{0,8}?(?:\\n[^\\d\\n]{0,40}){0,2}?" + DATE, "i").exec(all));
  const line = re => { const m = new RegExp("(?:^|\\n)[^\\S\\n]*" + re + "[^\\S\\n]*[:;.,+©t]*[^\\S\\n]*:?[^\\S\\n]*([^\\n]*)", "i").exec(all); return m ? m[1].trim() : ""; };
  const cut = (v, re) => { const m = re.exec(v); return (m ? v.slice(0, m.index) : v).replace(/^[\s:;.,+©~\-–—_]+|[\s:;.,|\-–—_]+$/g, "").trim(); };
  const STOP = /\s+(?:[1lI]D\s*No|Envi\w*|Environmental|During|Calibration|Condition|Range|Resolution|Recommended|Receipt|Issue|ULR|Water|\(Comparison|\(Gravimetric|Sr\.?\s*No|Class|Discipline|Frequency)\b/i;
  const junk = v => !v || !/[A-Za-z]{3,}/.test(v) || /^[-–—_.:;|\s'"`~]*$/.test(v) || (/^[A-Za-z]{1,4}$/.test(v)) || /^(?:dees|tees|tenn|women|wo+men|hes?|hr)$/i.test(v);
  const r = {};
  let m = /Certificate\s*No\.?[\s:;.,+©\-]*((?:MTC|NCL)[-\/][^\s]*)/i.exec(all) || /Certificate\s*No\.?\s*[:;.,+©]?\s*([A-Z0-9][A-Z0-9\/\-.]{5,})/i.exec(all);
  r.certNo = m ? m[1].replace(/[.,;:]+$/, "").toUpperCase().replace(/O(?=\d)/g, "0") : "";
  m = /\b(M[I1l]PPL\s*[\/\-]\s*[A-Z0-9]{1,4}\s*[\/\-]\s*SMS\s*[\/\-]\s*\d{1,2})/i.exec(all);
  r.id = m ? m[1].toUpperCase().replace(/\s+/g, "").replace(/^M[1L]PPL/, "MIPPL") : "";
  r.calDate = date("(?:Calibration\\s*Date|Date\\s*of\\s*Calibration)");
  r.dueDate = date("(?:Recommended\\s*Date(?:[^\\S\\n]*for\\s*Next\\s*Calibration)?|Calibration\\s*Due\\s*On|Due\\s*On)") || date("Next\\s*Calibration");
  r.issueDate = date("Issue\\s*Date");
  let name = line("Item\\s*Description") || line("Name");
  name = cut(name, /\s+(?:Envi|Issue|Receipt|Calib|ULR)/i).replace(/(\S{3,})\s+[A-Za-z]{1,2}\.?$/, "$1");
  const nm = /Item\s*Description[^\n]*\n[^\S\n]*([A-Z][A-Z ]{3,})(?:\n|$)/.exec(all);   // second line in capitals (e.g. "WITH SENSOR OF HOT AIR OVEN")
  if (nm && /^[A-Z ]+$/.test(name) && !/^(ID|MAKE|MODEL)\b/.test(nm[1].trim())) name += " " + nm[1].trim();
  r.name = name.replace(/\s+/g, " ").trim();
  let v = cut(line("Make"), STOP).replace(/(\S{3,})\s+[A-Za-z]{1,4}\.?$/, "$1"); r.make = junk(v) ? "" : v;
  v = cut(line("Model"), STOP); v = v.replace(/^No\.?\s*:?\s*/i, ""); r.model = /\d/.test(v) && !junk(v) ? v.replace(/^Al-/, "AI-") : "";
  v = cut(line("Range") || line("Max\\S*\\s*Capacity\\s*:?"), STOP); v = v.replace(/^[1lI|!]\s+(?=[\d(])/, ""); r.range = /\d/.test(v) ? v : "";
  v = cut(line("Least\\s*Count") || line("Resolution"), STOP); r.lc = /\d/.test(v) && /[a-z°%]/i.test(v) ? v : "";
  // other layouts (e.g. Shimadzu: "Ref.:", "Date:", "Calibration Validity Period:", "Instrument:", "Model No.:", "Serial No.:")
  const other = !/Certificate\s*No/i.test(all);
  if (!r.certNo && other) { m = /\bRef(?:erence)?\.?\s*(?:No\.?)?\s*[:.]+\s*([A-Z0-9][A-Z0-9\/\-.]{4,})/i.exec(all); if (m) r.certNo = m[1].replace(/[.,;:]+$/, "").toUpperCase(); }
  if (!r.calDate && other) r.calDate = date("\\bDate(?=\\s*[:.])");
  if (!r.dueDate) r.dueDate = date("(?:Validity\\s*Period|Valid\\s*(?:up\\s*to|upto|till))");
  if (!r.name) { m = /Instrument\s*(?:Name)?\s*:\s*([A-Za-z][^\n:]{3,60}?)(?=\s{2,}|\n|$)/.exec(all); if (m) r.name = m[1].trim(); }
  if (!r.make) { m = /\bMake\s*:\s*([A-Za-z][A-Za-z0-9 .&-]{2,30}?)(?=\s{2,}|\n|$)/.exec(all); if (m && !junk(m[1].trim())) r.make = m[1].trim(); }
  if (!r.model) { m = /\bModel\s*(?:No\.?)?\s*:\s*([A-Z0-9][A-Z0-9 .\-]{1,20}?)(?=\s{2,}|\s+Serial|\n|$)/i.exec(all); if (m && /\d/.test(m[1])) r.model = m[1].trim(); }
  m = /\bSerial\s*No\.?\s*:?\s*([A-Z0-9][A-Z0-9\-\/]{4,}(?:\s[A-Z]{1,3}\b)?)/i.exec(all); r.serial = m ? m[1].trim() : "";
  if (!r.range) { m = /Wavelength\s*Range\s*:\s*([^\n|]+?)(?=\s{2,}|\n|$)/i.exec(all); if (m) r.range = m[1].trim(); }
  r.agency = /SHIMADZU/i.test(all) ? "Shimadzu Analytical (India) Pvt. Ltd." : /M[I1]?AINTECH|^MTC-/i.test(all + "\n" + r.certNo) || /^MTC-/.test(r.certNo) ? "Maintech Calibrators Pvt. Ltd." : (/NEWTECH|NUTECH/i.test(all) || /^NCL\//.test(r.certNo) ? "Newtech Calibration Laboratory" : "");
  if (r.calDate && r.issueDate && r.calDate > r.issueDate) r.calDate = "";
  if (r.calDate && r.dueDate && (r.dueDate <= r.calDate || +r.dueDate.slice(0, 4) - +r.calDate.slice(0, 4) > 3)) r.dueDate = "";
  return r;
}
// header of a page -> canvases for OCR: whole width, and left / right of the table's middle line (grey and black & white)
function calHeaderCanvases(page) {
  const W = page.width, H = page.height, y0 = Math.round(H * 0.06), h = Math.round(H * 0.36);
  const g = page.getContext("2d").getImageData(0, y0, W, h).data, lum = new Uint8ClampedArray(W * h);
  for (let i = 0; i < W * h; i++) lum[i] = 0.299 * g[4 * i] + 0.587 * g[4 * i + 1] + 0.114 * g[4 * i + 2];
  let best = -1, bx = Math.round(W * 0.52);
  for (let x = Math.round(W * 0.45); x < Math.round(W * 0.58); x++) { let d = 0; for (let y = 0; y < h; y += 2) if (lum[y * W + x] < 110) d++; if (d > best) { best = d; bx = x; } }
  const make = (x0, x1, bw) => {
    const w = x1 - x0, c = document.createElement("canvas"); c.width = w; c.height = h;
    const cx = c.getContext("2d"), id = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = lum[y * W + x0 + x]; if (bw) v = v > 160 ? 255 : 0; const k = 4 * (y * w + x); id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
    cx.putImageData(id, 0, 0); return c;
  };
  return { GL: make(0, bx - 3, false), GR: make(bx + 3, W, false), L: make(0, bx - 3, true), R: make(bx + 3, W, true), F: make(0, W, false) };
}
function calLev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
// which log line a certificate belongs to: same ID (one wrong letter allowed, e.g. VE / VF)
function calMatchRow(list, id, cert) {
  const n = t => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), k = n(id);
  let best = -1, bd = 2;
  if (k) list.forEach((r, i) => { const d = calLev(k, n(r.id)); if (d < bd) { bd = d; best = i; } });
  if (best < 0 && cert) {
    if (n(cert.model).length >= 3) best = list.findIndex(r => n(r.model) && n(r.model) === n(cert.model));
    if (best < 0 && n(cert.name).length >= 5) best = list.findIndex(r => n(r.name) === n(cert.name));
  }
  return best;
}
const CAL_UP = { bytes: null, name: "", certs: [], pdf: null };
const calDraftDb = () => new Promise((res, rej) => { const q = indexedDB.open("calUpload", 1); q.onupgradeneeded = () => q.result.createObjectStore("d"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
async function calDraftPut(withBytes) {
  try {
    const db = await calDraftDb(), tx = db.transaction("d", "readwrite"), st = tx.objectStore("d");
    st.put({ name: CAL_UP.name, certs: CAL_UP.certs, at: Date.now() }, "meta");
    if (withBytes) st.put(CAL_UP.bytes, "bytes");
    await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
  } catch (e) {}
}
async function calDraftGet() {
  try { const db = await calDraftDb(), st = db.transaction("d").objectStore("d"), g = k => new Promise(r => { const q = st.get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
    const meta = await g("meta"); if (!meta || !meta.certs || !meta.certs.length) return null; return { meta, bytes: await g("bytes") }; } catch (e) { return null; }
}
async function calDraftClear() { try { const db = await calDraftDb(), tx = db.transaction("d", "readwrite"); tx.objectStore("d").clear(); await new Promise(r => { tx.oncomplete = r; tx.onerror = r; }); } catch (e) {} }
let _calDraftT = null;
const calDraftSoon = () => { clearTimeout(_calDraftT); _calDraftT = setTimeout(() => calDraftPut(false), 600); };
// on opening the Calibration Log: an upload that was read but not saved yet is offered again
async function calDraftOffer() {
  const box = document.getElementById("calUpBox");
  if (!box || CAL_UP.certs.length) return;
  const d = await calDraftGet(); if (!d || !d.bytes) return;
  box.classList.remove("hidden");
  box.innerHTML = `<div class="calUpMsg">⚠️ ${htmlEsc(d.meta.name)}: ${d.meta.certs.length} certificate(s) were read but <b>not saved yet</b>.</div>` +
    `<div class="btnRow"><button class="primary" id="calDraftGo" type="button">↩ Continue checking &amp; save</button><button class="secondary" id="calDraftDrop" type="button">🗑 Discard</button></div>`;
  document.getElementById("calDraftGo").onclick = async () => {
    try {
      const pdfjsLib = await loadPdfJs(); await calLoadPdfLib();
      Object.assign(CAL_UP, { name: d.meta.name, certs: d.meta.certs, bytes: d.bytes, pdf: await pdfjsLib.getDocument({ data: new Uint8Array(d.bytes.slice(0)) }).promise });
      calUpRender();
    } catch (e) { const st = document.getElementById("status"); st.className = "err"; st.textContent = "Could not open the saved upload: " + e.message; }
  };
  document.getElementById("calDraftDrop").onclick = async () => { if (!confirm("Discard these certificates? (Nothing was saved in the log.)")) return; await calDraftClear(); box.classList.add("hidden"); box.innerHTML = ""; };
}
window.addEventListener("beforeunload", e => { if (CAL_UP.certs.length) { e.preventDefault(); e.returnValue = ""; } });
async function calUploadPdf(file) {
  const st = document.getElementById("status"), box = document.getElementById("calUpBox");
  const say = (t, cls) => { st.className = cls || "wait"; st.textContent = t; const p = document.getElementById("calUpMsg"); if (p) p.textContent = t; };
  try {
    if (!/\.pdf$/i.test(file.name)) throw new Error("please choose a PDF file");
    box.classList.remove("hidden");
    box.innerHTML = `<div id="calUpMsg" class="calUpMsg">Opening ${htmlEsc(file.name)}...</div>`;
    CAL_UP.bytes = await file.arrayBuffer(); CAL_UP.name = file.name; CAL_UP.certs = [];
    say("Loading the PDF and OCR tools (first time takes a little longer)...");
    const [pdfjsLib] = await Promise.all([loadPdfJs(), rmLoadOcr(), calLoadPdfLib()]);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(CAL_UP.bytes.slice(0)) }).promise;
    CAL_UP.pdf = pdf;
    const worker = await Tesseract.createWorker("eng");
    const pages = [];
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        say(`Reading page ${p} of ${pdf.numPages}...`);
        const pg = await pdf.getPage(p), base = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 1700 / base.width });
        const cv = document.createElement("canvas"); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        const C = calHeaderCanvases(cv), T = {};
        await worker.setParameters({ tessedit_pageseg_mode: "6" });
        for (const k of ["GL", "GR"]) T[k] = (await worker.recognize(C[k])).data.text;
        await worker.setParameters({ tessedit_pageseg_mode: "3" });
        T.F = (await worker.recognize(C.F)).data.text;
        let r = calParseBest(T);
        if (!r.certNo || !r.id || !r.calDate || !r.dueDate || !r.issueDate) {   // something missing: read it once more in black & white
          await worker.setParameters({ tessedit_pageseg_mode: "6" });
          for (const k of ["L", "R"]) T[k] = (await worker.recognize(C[k])).data.text;
          r = calParseBest(T);
        }
        if (!r.certNo || !r.calDate || !r.dueDate) {   // another layout (e.g. Shimadzu): read the whole page
          await worker.setParameters({ tessedit_pageseg_mode: "3" });
          const pc = document.createElement("canvas"); pc.width = cv.width; pc.height = cv.height;
          const px = pc.getContext("2d"); px.filter = "grayscale(1)"; px.drawImage(cv, 0, 0);
          T.P = (await worker.recognize(pc)).data.text; pc.width = pc.height = 0;
          r = calParseBest(T);
        }
        const th = document.createElement("canvas"); th.width = 260; th.height = Math.round(260 * cv.height / cv.width);
        th.getContext("2d").drawImage(cv, 0, 0, th.width, th.height);
        pages.push({ p, r, thumb: th.toDataURL("image/jpeg", 0.7) });
      }
    } finally { try { await worker.terminate(); } catch (e) {} }
    // pages -> certificates: a page with no certificate no. and no ID belongs to the certificate before it
    pages.forEach(pg => {
      const last = CAL_UP.certs[CAL_UP.certs.length - 1];
      if (last && (!pg.r.certNo && !pg.r.id || (pg.r.certNo && pg.r.certNo === last.r.certNo))) last.pages.push(pg.p);
      else CAL_UP.certs.push({ pages: [pg.p], r: pg.r, thumb: pg.thumb });
    });
    calUpRender();
    await calDraftPut(true);
    say(`${CAL_UP.certs.length} certificate(s) read from ${pdf.numPages} page(s). Not saved yet - check the values, then press ✅ Save (the button stays at the bottom of the screen).`, "ok");
  } catch (e) { say("Certificate upload: " + e.message, "err"); }
}
function calParseBest(T) {   // grey halves + whole width first; the black & white halves (if read) only fill what is still missing
  const a = calParse([T.GL, T.GR, T.F]), f = calParse([T.F]);
  if (T.L !== undefined) { const b = calParse([T.L, T.R, T.GL, T.GR, T.F]); Object.keys(b).forEach(k => { if (!a[k]) a[k] = b[k]; }); }
  if (T.P !== undefined) { const c = calParse([T.P]); Object.keys(c).forEach(k => { if (!a[k]) a[k] = c[k]; }); }
  return Object.assign({}, a, { id: f.id || a.id });
}
function calUpRender() {
  const box = document.getElementById("calUpBox"), list = getCalList(), e = htmlEsc;
  const opts = sel => `<option value="new"${sel === -1 ? " selected" : ""}>➕ New line in the log</option><option value="skip">— Don't save —</option>` +
    list.map((r, i) => `<option value="${i}"${sel === i ? " selected" : ""}>${e(r.id)} · ${e(r.name)}</option>`).join("");
  const F = [["certNo", "Certificate No."], ["id", "Equipment ID"], ["name", "Equipment"], ["make", "Make"], ["model", "Model"], ["range", "Range / Accuracy"],
    ["calDate", "Calibration date", "date"], ["dueDate", "Next due date", "date"], ["issueDate", "Issue date", "date"], ["agency", "Calibrated by / Agency"]];
  box.innerHTML = `<div id="calUpMsg" class="calUpMsg"></div><h3 style="margin:8px 0;font-size:15px;">📄 ${e(CAL_UP.name)} - ${CAL_UP.certs.length} certificate(s)</h3>` +
    CAL_UP.certs.map((c, i) => {
      const r = c.r, row = calMatchRow(list, r.id, r);
      if (c.row === undefined) {
        c.row = row; c.v = Object.assign({}, r, { range: [r.range, r.lc].filter(Boolean).join(" / ") });
        if (row >= 0) ["id", "name", "make", "model", "range"].forEach(k => { if (list[row][k]) c.v[k] = list[row][k]; });   // the log line already has the instrument's details
      }
      const miss = F.filter(([k]) => ["certNo", "id", "calDate", "dueDate"].includes(k) && !c.v[k]).map(f => f[1]);
      const yr = c.v.calDate && c.v.dueDate && (+c.v.calDate.slice(0, 4) + 1) + c.v.calDate.slice(4) !== c.v.dueDate;
      return `<div class="calCert" data-i="${i}"><div class="calCertTop"><img src="${c.thumb}" alt="page ${c.pages[0]}" data-zoom="${i}" title="Tap to see the page bigger">` +
        `<div><b>Page ${c.pages.join(", ")}</b><br>${miss.length ? `<span class="calWarn">⚠️ Not read: ${e(miss.join(", "))}</span>` : `<span class="calOk">✅ Main details read - please check</span>`}` + (yr ? `<br><span class="calWarn">⚠️ Due date is not 12 months after the calibration date - check it on the page</span>` : "") +
        `<label>Log line<select data-k="row">${opts(c.row)}</select></label></div></div>` +
        `<div class="calCertGrid">` + F.map(([k, l, t]) => `<label>${l}<input type="${t || "text"}" data-k="${k}" value="${e(c.v[k] || "")}"></label>`).join("") + `</div></div>`;
    }).join("") +
    `<div class="btnRow halfRow calSaveBar"><button class="primary" id="calUpSave" type="button">✅ Save ${CAL_UP.certs.length} certificate(s)</button><button class="secondary" id="calUpCancel" type="button">✖ Cancel</button></div>`;
}
async function calUpSave() {
  const st = document.getElementById("status");
  const say = (t, cls) => { st.className = cls || "wait"; st.textContent = t; const p = document.getElementById("calUpMsg"); if (p) p.textContent = t; };
  const todo = CAL_UP.certs.filter(c => c.row !== "skip");
  const bad = todo.filter(c => !c.v.certNo || !c.v.calDate || !c.v.dueDate);
  if (bad.length && !confirm(`${bad.length} certificate(s) have no certificate no. / calibration date / due date. Save them anyway?`)) return;
  const dup = {}; todo.forEach(c => { if (c.row !== "new" && c.row >= 0) dup[c.row] = (dup[c.row] || 0) + 1; });
  const twice = Object.keys(dup).filter(k => dup[k] > 1);
  if (twice.length) { say(`Two certificates are set to the same log line (${twice.map(k => getCalList()[k].id).join(", ")}) - please choose the right line.`, "err"); return; }
  try {
    const src = await PDFLib.PDFDocument.load(CAL_UP.bytes.slice(0), { ignoreEncryption: true });
    const list = getCalList();
    let n = 0;
    for (const c of todo) {
      n++; say(`Saving certificate ${n} of ${todo.length} to OneDrive...`);
      const d = await PDFLib.PDFDocument.create();
      (await d.copyPages(src, c.pages.map(p => p - 1))).forEach(pg => d.addPage(pg));
      const bytes = await d.save();
      const v = c.v, fileName = `${calSafe(v.id || v.name) || "certificate"}_${calSafe(v.certNo) || c.pages[0]}.pdf`;
      await calPutFile("Scans/" + fileName, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));   // the scan as it came
      say(`Saving certificate ${n} of ${todo.length}: making it clear...`);
      await calPutFile(fileName, await calMakeCleanPdf(CAL_UP.pdf, c.pages));                                               // the clear copy (📄 downloads this)
      let row;
      if (c.row === "new" || c.row < 0) { row = { sl: (Math.max(0, ...list.map(x => +x.sl || 0)) + 1), lastDate: "", dueDate: "", agency: "", certNo: "" }; list.push(row); }
      else row = list[c.row];
      if (row.certFile && row.certNo && row.certNo !== v.certNo) (row.history = row.history || []).push({ certNo: row.certNo, lastDate: row.lastDate, dueDate: row.dueDate, agency: row.agency, certFile: row.certFile });
      // the certificate's details go into the log; an empty value keeps what the log had
      ["id", "name", "make", "model", "range"].forEach(k => { if (v[k]) row[k] = v[k]; });
      Object.assign(row, { lastDate: v.calDate || row.lastDate, dueDate: v.dueDate || row.dueDate, agency: v.agency || row.agency, certNo: v.certNo || row.certNo, issueDate: v.issueDate || row.issueDate || "", certFile: fileName, certEnh: 1 });
    }
    saveCalList(list);
    await calCloudPush();
    renderCalTable(); checkCalibrationReminders();
    document.getElementById("calUpBox").classList.add("hidden"); document.getElementById("calUpBox").innerHTML = "";
    CAL_UP.certs = []; CAL_UP.bytes = null; await calDraftClear();
    say(`✅ ${todo.length} certificate(s) saved: details in the Calibration Log, PDFs in OneDrive → Apps → Calibration → Certificates (📄 in the log to download).`, "ok");
  } catch (e) { say("Save error: " + e.message, "err"); }
}
document.getElementById("calEnhanceBtn").addEventListener("click", calEnhanceSaved);
document.getElementById("calUploadBtn").addEventListener("click", () => { const f = document.getElementById("calUploadFile"); f.value = ""; f.click(); });
document.getElementById("calUploadFile").addEventListener("change", ev => { const f = ev.target.files && ev.target.files[0]; if (f) calUpUploadGuard(f); });
function calUpUploadGuard(f) { if (isViewer()) { const st = document.getElementById("status"); st.className = "err"; st.textContent = "👁️ View-only account - certificates can't be added."; return; } calUploadPdf(f); }
document.getElementById("calUpBox").addEventListener("input", ev => {
  const t = ev.target, card = t.closest(".calCert"); if (!card) return;
  const c = CAL_UP.certs[+card.dataset.i], k = t.dataset.k;
  if (k === "row") {
    c.row = t.value === "new" || t.value === "skip" ? t.value : +t.value;
    const r = typeof c.row === "number" ? getCalList()[c.row] : null;
    if (r) ["id", "name", "make", "model", "range"].forEach(f => { const inp = card.querySelector(`[data-k="${f}"]`); if (r[f] && inp) { inp.value = r[f]; c.v[f] = r[f]; } });   // that line's instrument details
  }
  else if (k) c.v[k] = t.value.trim();
  calDraftSoon();
});
document.getElementById("calUpBox").addEventListener("click", async ev => {
  if (ev.target.id === "calUpSave") return calUpSave();
  if (ev.target.id === "calUpCancel") { if (!confirm("Cancel? These certificates will not be saved.")) return; const b = document.getElementById("calUpBox"); b.classList.add("hidden"); b.innerHTML = ""; CAL_UP.certs = []; await calDraftClear(); return; }
  const z = ev.target.closest("[data-zoom]"); if (!z) return;
  // the page, bigger
  const c = CAL_UP.certs[+z.dataset.zoom]; if (!c || !CAL_UP.pdf) return;
  const pg = await CAL_UP.pdf.getPage(c.pages[0]), base = pg.getViewport({ scale: 1 }), w = Math.min(window.innerWidth - 24, 900);
  const vp = pg.getViewport({ scale: (w / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
  const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height; cv.style.width = w + "px";
  await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
  const ov = document.createElement("div"); ov.className = "calZoom"; ov.title = "Tap to close"; ov.appendChild(cv);
  ov.addEventListener("click", () => ov.remove()); document.body.appendChild(ov);
});

