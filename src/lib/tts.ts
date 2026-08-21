let cachedTrVoice: SpeechSynthesisVoice | null | undefined;

function pickTurkishVoice(): SpeechSynthesisVoice | null {
  if (cachedTrVoice !== undefined) return cachedTrVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedTrVoice =
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("tr")) ?? null;
  return cachedTrVoice;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakTurkish(text: string): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "tr-TR";
  const voice = pickTurkishVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

/** Sesler bazen asenkron yüklenir; ilk çağrıda cache'i tazelemek için. */
export function primeVoices(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedTrVoice = undefined;
  };
}
