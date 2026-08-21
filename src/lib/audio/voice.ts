/**
 * Ortak ses katmanı — sesli komut (TTS) + kısa efekt sesleri (WebAudio).
 *
 * Tüm araçlar (Sesli Refleks, Fight Lab, Sanal Rakip, Dövüş Analitiği) bu tek
 * katmanı kullanır; böylece ses seçimi, sustur ayarı ve efektler her yerde
 * aynı davranır.
 *
 * ★ Mobil/iOS kısıtı: AudioContext ve speechSynthesis yalnızca bir KULLANICI
 *   HAREKETİ içinde başlatılabilir. `initAudio()` bu yüzden yalnızca bir
 *   butonun onClick akışından çağrılmalıdır.
 *
 * ★ Sessiz bozulma ilkesi: ses hiç çalışmasa bile antrenman akışı durmaz —
 *   komut her zaman ekranda da yazar.
 */

import { isTurkish, pickVoice, type VoiceLike } from "./voice-select";

const MUTED_KEY = "blackbox.audio.muted";
const VOICE_KEY = "blackbox.audio.voiceURI";

type AudioContextCtor = new () => AudioContext;

let ctx: AudioContext | null = null;
let speechPrimed = false;
let resolvedVoice: SpeechSynthesisVoice | null = null;
let muted = false;
let preferredVoiceURI: string | null = null;
let settingsLoaded = false;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & { webkitAudioContext?: AudioContextCtor };
  return (window.AudioContext as AudioContextCtor | undefined) ?? scope.webkitAudioContext ?? null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadSettings(): void {
  if (settingsLoaded || typeof window === "undefined") return;
  settingsLoaded = true;
  try {
    muted = window.localStorage.getItem(MUTED_KEY) === "1";
    preferredVoiceURI = window.localStorage.getItem(VOICE_KEY);
  } catch {
    /* localStorage kapalı olabilir — varsayılanlarla devam */
  }
}

/**
 * Kullanıcı hareketi içinde çağrılmalı (Başlat butonu). AudioContext açılır ve
 * konuşma motoru sessiz bir cümleyle ısıtılır; böylece ilk gerçek komut
 * yutulmaz.
 */
export function initAudio(): void {
  loadSettings();
  const Ctor = audioContextCtor();
  if (Ctor && !ctx) {
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  if (ctx?.state === "suspended") void ctx.resume().catch(() => {});

  if (!speechPrimed && isSpeechSupported()) {
    try {
      // Ses listesi asenkron yüklenir; ilk çağrı yüklemeyi tetikler.
      window.speechSynthesis.getVoices();
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
      speechPrimed = true;
    } catch {
      speechPrimed = false;
    }
  }
}

/** Seans bitince kaynakları bırak. */
export function releaseAudio(): void {
  stopSpeaking();
  try {
    void ctx?.close();
  } catch {
    /* yoksay */
  }
  ctx = null;
  speechPrimed = false;
}

// ── Sustur ────────────────────────────────────────────────────

export function isMuted(): boolean {
  loadSettings();
  return muted;
}

export function setMuted(value: boolean): void {
  loadSettings();
  muted = value;
  if (value) stopSpeaking();
  try {
    window.localStorage.setItem(MUTED_KEY, value ? "1" : "0");
  } catch {
    /* yoksay */
  }
}

// ── Ses listesi (useSyncExternalStore uyumlu) ─────────────────
//
// ★ Chrome/Edge tarafında getVoices() İLK ÇAĞRIDA BOŞ DÖNER — liste asenkron
//   yüklenir ve voiceschanged olayıyla haber verilir. Tek senkron çağrı yapan
//   kod, Türkçe ses KURULU cihazlarda bile "Türkçe ses yok" sanıp komutları
//   İngilizce motorla okutuyordu.

const EMPTY_VOICES: SpeechSynthesisVoice[] = [];
let voicesCache: SpeechSynthesisVoice[] | null = null;

function listVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return EMPTY_VOICES;
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return EMPTY_VOICES;
  }
}

export function subscribeVoices(onChange: () => void): () => void {
  if (!isSpeechSupported()) return () => {};
  const handler = () => {
    voicesCache = null;
    resolvedVoice = null; // seçim yeniden hesaplansın
    onChange();
  };
  try {
    window.speechSynthesis.addEventListener("voiceschanged", handler);
  } catch {
    return () => {};
  }
  return () => {
    try {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    } catch {
      /* yoksay */
    }
  };
}

export function getVoicesSnapshot(): SpeechSynthesisVoice[] {
  if (voicesCache === null) {
    const list = listVoices();
    // Liste henüz boşsa ÖNBELLEĞE ALMA: voiceschanged göndermeyen
    // tarayıcılarda (Safari) sonraki render doğru listeyi okuyabilsin.
    if (list.length === 0) return EMPTY_VOICES;
    voicesCache = list;
  }
  return voicesCache;
}

/** Sunucu render'ında ses yok — kararlı boş referans. */
export function getServerVoicesSnapshot(): SpeechSynthesisVoice[] {
  return EMPTY_VOICES;
}

export function setPreferredVoiceURI(uri: string | null): void {
  loadSettings();
  preferredVoiceURI = uri && uri.length > 0 ? uri : null;
  resolvedVoice = null;
  try {
    if (preferredVoiceURI) window.localStorage.setItem(VOICE_KEY, preferredVoiceURI);
    else window.localStorage.removeItem(VOICE_KEY);
  } catch {
    /* yoksay */
  }
}

export function getPreferredVoiceURI(): string | null {
  loadSettings();
  return preferredVoiceURI;
}

function resolveVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  if (resolvedVoice) return resolvedVoice;
  loadSettings();

  const voices = listVoices();
  if (voices.length === 0) return null;

  if (preferredVoiceURI) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredVoiceURI);
    if (chosen) {
      resolvedVoice = chosen;
      return resolvedVoice;
    }
    // Seçilen ses cihazdan kalkmışsa sessizce otomatik seçime dön.
  }

  const picked = pickVoice(voices as readonly VoiceLike[], true);
  resolvedVoice = (picked as SpeechSynthesisVoice | null) ?? null;
  return resolvedVoice;
}

/** Türkçe ses yüklü mü — yoksa komutlar aksanlı okunur, akış bozulmaz. */
export function turkishVoiceAvailable(): boolean {
  return listVoices().some(isTurkish);
}

/** Şu an kullanılacak sesin adı (UI etiketi için). */
export function activeVoiceName(): string | null {
  return resolveVoice()?.name ?? null;
}

// ── Konuşma ───────────────────────────────────────────────────

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* yoksay */
  }
}

export type SpeakOptions = {
  /** Konuşma hızı (1 = normal). Komutlar hafif hızlı okunur. */
  rate?: number;
  /** Ton kalınlığı. Cihazda erkek ses yoksa düşürülerek kalınlaştırılabilir. */
  pitch?: number;
  /**
   * Devam eden konuşmayı kesip bunu okur (varsayılan). Geç kalan bir
   * seslendirme yeni komutun üzerine binmemeli.
   */
  interrupt?: boolean;
};

export function speak(text: string, options: SpeakOptions = {}): void {
  loadSettings();
  if (muted || !text || !isSpeechSupported()) return;
  const { rate = 1.05, pitch = 1, interrupt = true } = options;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    const voice = resolveVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ses yoksa antrenman yine de sürer */
  }
}

// ── Efekt sesleri ─────────────────────────────────────────────

export type BeepKind =
  /** geri sayım tik sesi */
  | "tick"
  /** seans / round başlangıcı */
  | "go"
  /** doğru tepki */
  | "hit"
  /** kaçırılan tepki */
  | "miss"
  /** yanlış el / yanlış yön / erken çıkış */
  | "wrong"
  /** dinlenme başlangıcı */
  | "rest"
  /** seans sonu */
  | "finish"
  /** rakip saldırıya çıktı (telegraph) */
  | "attack"
  /** rakibin vuruşu isabet etti */
  | "impact";

type ToneSpec = {
  /** [frekans, süre(sn)] çiftleri — sırayla çalınır. */
  steps: readonly (readonly [number, number])[];
  type: OscillatorType;
  gain: number;
};

const TONES: Record<BeepKind, ToneSpec> = {
  tick: { steps: [[660, 0.09]], type: "sine", gain: 0.22 },
  go: { steps: [[990, 0.18]], type: "sine", gain: 0.28 },
  hit: {
    steps: [
      [880, 0.07],
      [1320, 0.1],
    ],
    type: "sine",
    gain: 0.26,
  },
  miss: { steps: [[300, 0.16]], type: "sine", gain: 0.22 },
  wrong: {
    steps: [
      [220, 0.1],
      [165, 0.16],
    ],
    type: "square",
    gain: 0.18,
  },
  rest: { steps: [[440, 0.22]], type: "sine", gain: 0.24 },
  finish: {
    steps: [
      [660, 0.12],
      [880, 0.12],
      [1180, 0.22],
    ],
    type: "sine",
    gain: 0.26,
  },
  attack: {
    steps: [
      [520, 0.07],
      [400, 0.09],
    ],
    type: "sawtooth",
    gain: 0.2,
  },
  impact: { steps: [[140, 0.22]], type: "square", gain: 0.26 },
};

/**
 * Kısa efekt sesi. `initAudio()` çağrılmadıysa (yani kullanıcı hareketi yoksa)
 * sessizce hiçbir şey yapmaz — tarayıcı zaten çalmasına izin vermezdi.
 */
export function beep(kind: BeepKind = "tick"): void {
  loadSettings();
  if (muted || !ctx) return;
  const spec = TONES[kind];
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    let at = ctx.currentTime;
    for (const [frequency, duration] of spec.steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(spec.gain, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + duration + 0.02);
      at += duration;
    }
  } catch {
    /* ses yoksa antrenman yine de sürer */
  }
}
