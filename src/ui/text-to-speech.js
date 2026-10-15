(function stelleVorlesefunktionBereit(global) {
  "use strict";

  const unterstuetztVorlesen = () => typeof global.speechSynthesis?.speak === 'function'
    && typeof global.speechSynthesis?.cancel === 'function' && typeof global.SpeechSynthesisUtterance === 'function';
  let aktiverButton = null;
  let aktiveAnsage = null;
  const LAUTSPRECHER = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
  const STOPP = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
  function hinweis(button,text) {
    let p = button._vorleseHinweis;
    if (!p) {
      p = document.createElement('span'); p.className='vorlesen-hinweis'; p.setAttribute('role','status');
      button.insertAdjacentElement('afterend',p); button._vorleseHinweis=p;
    }
    p.textContent=text;
  }

  function zeigeBeendet(button) {
    button.classList.remove("spricht");
    button.innerHTML = LAUTSPRECHER;
    button.setAttribute('aria-pressed','false');
    button.setAttribute("aria-label", "Frage vorlesen");
    button.title = "Frage vorlesen";
    if (aktiverButton === button) aktiverButton = null;
  }

  function stoppeVorlesen() {
    aktiveAnsage = null;
    if (unterstuetztVorlesen()) global.speechSynthesis.cancel();
    if (aktiverButton) zeigeBeendet(aktiverButton);
  }

  function starteVorlesen(text, button) {
    if (!unterstuetztVorlesen()) {
      hinweis(button,'Dieser Browser unterstützt das Vorlesen hier nicht. Öffne das Wochenquiz in einem aktuellen normalen Browser statt im eingebauten Messenger-Fenster.');
      return;
    }
    stoppeVorlesen();

    const utterance = new global.SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    let stimmen = [];
    try { stimmen = global.speechSynthesis.getVoices?.() || []; }
    catch { /* Einige WebViews liefern keine Stimmenliste; de-DE bleibt der Fallback. */ }
    const stimme = stimmen.find(v => /^de/i.test(v.lang) && v.localService) || stimmen.find(v => /^de/i.test(v.lang));
    if (stimme) utterance.voice = stimme;
    aktiveAnsage = utterance;
    utterance.onend = () => { if (aktiveAnsage !== utterance) return; aktiveAnsage=null; zeigeBeendet(button); };
    utterance.onerror = () => {
      if (aktiveAnsage !== utterance) return;
      aktiveAnsage=null; zeigeBeendet(button);
      hinweis(button,'Vorlesen konnte nicht gestartet werden. Prüfe die Medienlautstärke und die Sprachfunktion deines Geräts oder probiere einen anderen Browser.');
    };

    aktiverButton = button;
    button.classList.add("spricht");
    button.innerHTML = STOPP;
    button.setAttribute('aria-pressed','true');
    button.setAttribute("aria-label", "Vorlesen stoppen");
    button.title = "Vorlesen stoppen";
    if (button._vorleseHinweis) button._vorleseHinweis.textContent='';
    try { global.speechSynthesis.speak(utterance); }
    catch { utterance.onerror(); }
  }

  function baueVorlesenButton(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vorlesen-button";
    button.setAttribute("aria-label", "Frage vorlesen");
    button.title = "Frage vorlesen";
    button.innerHTML = LAUTSPRECHER;
    button.setAttribute('aria-pressed','false');
    button.addEventListener("click", (ereignis) => {
      ereignis.preventDefault();
      if (button.classList.contains("spricht")) stoppeVorlesen();
      else starteVorlesen(text, button);
    });
    return button;
  }

  global.SchiriQuizTextToSpeech = Object.freeze({
    baueVorlesenButton,
    stoppeVorlesen,
  });
})(globalThis);
