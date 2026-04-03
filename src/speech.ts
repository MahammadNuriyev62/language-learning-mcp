let speakingWord = "";
let voiceAvailable = false;
let currentLanguage = "";

export function getSpeakingWord(): string {
  return speakingWord;
}

export function isVoiceAvailable(): boolean {
  return voiceAvailable;
}

export function setLanguage(lang: string) {
  currentLanguage = lang;
  checkVoiceAvailability();
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const langLower = lang.toLowerCase();
  const langPrefix = langLower.split("-")[0];

  const scored = voices
    .map((v) => {
      const vLang = v.lang.toLowerCase();
      const exactLang = vLang === langLower;
      const prefixLang = vLang.startsWith(langPrefix);
      if (!exactLang && !prefixLang) return null;

      let score = exactLang ? 100 : 50;
      const name = v.name.toLowerCase();

      if (name.startsWith("google") && !v.localService) score += 40;
      if (name.includes("premium")) score += 35;
      else if (name.includes("enhanced")) score += 25;
      if (name.includes("neural") || name.includes("natural")) score += 20;
      if (name.includes("compact")) score -= 10;

      return { voice: v, score };
    })
    .filter(Boolean) as { voice: SpeechSynthesisVoice; score: number }[];

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].voice;
}

function checkVoiceAvailability() {
  const voices = speechSynthesis.getVoices();
  if (!currentLanguage) {
    voiceAvailable = voices.length > 0;
    return;
  }
  const langLower = currentLanguage.toLowerCase();
  const langPrefix = langLower.split("-")[0];
  const hasMatch = voices.some((v) => {
    const vLang = v.lang.toLowerCase();
    return vLang === langLower || vLang.startsWith(langPrefix);
  });
  voiceAvailable = hasMatch || voices.length > 0;
}

export function speak(word: string, onUpdate?: () => void): void {
  if (speakingWord || !word || !voiceAvailable) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = currentLanguage;
  utterance.rate = 0.85;

  const voices = speechSynthesis.getVoices();
  const best = pickBestVoice(voices, currentLanguage);
  if (best) utterance.voice = best;

  utterance.onstart = () => {
    speakingWord = word;
    onUpdate?.();
  };

  utterance.onend = () => {
    speakingWord = "";
    onUpdate?.();
  };

  utterance.onerror = () => {
    speakingWord = "";
    onUpdate?.();
  };

  speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  speechSynthesis.cancel();
  speakingWord = "";
}

export function speakButtonHtml(word: string, extraClass = ""): string {
  const isSpeaking = speakingWord === word;
  const disabled = !voiceAvailable;
  return (
    `<button class="speak-btn${isSpeaking ? " speaking" : ""}${extraClass ? " " + extraClass : ""}${disabled ? " disabled" : ""}" ` +
      `data-speak="${escapeAttr(word)}" ` +
      `${disabled ? "disabled" : ""} ` +
      `title="${voiceAvailable ? "Click to hear pronunciation" : "No voice available"}">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>` +
        `<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>` +
      `</svg>` +
    `</button>`
  );
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

speechSynthesis.addEventListener("voiceschanged", checkVoiceAvailability);
checkVoiceAvailability();
