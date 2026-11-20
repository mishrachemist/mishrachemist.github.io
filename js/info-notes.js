/* ===================== ⓘ INFO NOTES =====================
   A longer explanation on a screen (class "mzInfoNote") is hidden behind a small ⓘ next to its heading;
   a tap on ⓘ shows / hides it. Heading = data-info-for (selector), else the nearest heading before the note. ===== */
(function infoNotes() {
  function attach(note) {
    if (note.dataset.mzInfo) return;
    note.dataset.mzInfo = "1";
    let host = note.dataset.infoFor ? document.querySelector(note.dataset.infoFor) : null;
    if (!host) { let el = note.previousElementSibling; while (el && !/^(H1|H2|H3|H4|SUMMARY)$/.test(el.tagName)) el = el.previousElementSibling; host = el; }
    const b = document.createElement("span");
    b.className = "mzInfoBtn" + (note.dataset.infoBtnClass ? " " + note.dataset.infoBtnClass : "");
    b.setAttribute("role", "button"); b.tabIndex = 0; b.setAttribute("aria-label", "Info"); b.setAttribute("aria-expanded", "false");
    b.textContent = "i";
    const toggle = e => { e.preventDefault(); e.stopPropagation(); const open = note.classList.toggle("mzInfoOpen"); b.setAttribute("aria-expanded", String(open)); };
    b.addEventListener("click", toggle);
    b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") toggle(e); });
    if (host) host.appendChild(b); else note.parentNode.insertBefore(b, note);
  }
  document.querySelectorAll(".mzInfoNote").forEach(attach);
  window.mzInfoAttach = root => (root || document).querySelectorAll(".mzInfoNote").forEach(attach);
})();
