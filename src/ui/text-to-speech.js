(function stelleVorlesefunktionBereit(global) {
  "use strict";

  const unterstuetztVorlesen = "speechSynthesis" in global;
  let aktiverButton = null;

  function zeigeBeendet(button) {
    button.classList.remove("spricht");
    button.textContent = "🔊";
    button.setAttribute("aria-label", "Frage vorlesen");
    button.title = "Frage vorlesen";
    if (aktiverButton === button) aktiverButton = null;
  }

  function stoppeVorlesen() {
    if (!unterstuetztVorlesen) return;
    global.speechSynthesis.cancel();
    if (aktiverButton) zeigeBeendet(aktiverButton);
  }

  function starteVorlesen(text, button) {
    if (!unterstuetztVorlesen) return;
    stoppeVorlesen();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.onend = () => zeigeBeendet(button);
    utterance.onerror = () => zeigeBeendet(button);

    aktiverButton = button;
    button.classList.add("spricht");
    button.textContent = "⏹";
    button.setAttribute("aria-label", "Vorlesen stoppen");
    button.title = "Vorlesen stoppen";
    global.speechSynthesis.speak(utterance);
  }

  function baueVorlesenButton(text) {
    if (!unterstuetztVorlesen) return null;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "vorlesen-button";
    button.setAttribute("aria-label", "Frage vorlesen");
    button.title = "Frage vorlesen";
    button.textContent = "🔊";
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
