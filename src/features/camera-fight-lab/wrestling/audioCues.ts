/**
 * Wrestling Lab ses katmanı — SAF eşleme fonksiyonları (tarayıcı API'si yok).
 *
 * Cue etiketleri protokolde İngilizce enum olarak duruyor (LEFT_SINGLE,
 * DOUBLE_LEG…). Minderdeki sporcu Türkçe komut duymalı, bu yüzden konuşma
 * metni ekrandaki etiketten ayrı üretilir.
 *
 * ★ Boxing tarafındaki `audioCues.ts` ile aynı ölçüm uyarısı geçerli: "voice"
 *   kademesi cue'yu okuduğu için test görsel-işitsel hâle gelir. FAKE/REAL
 *   ayrımı ise HİÇBİR kademede seslendirilmez — sahtesini sesle söylemek
 *   tanıma testinin ölçtüğü şeyi yok ederdi.
 */

import type { AudioMode } from "../types";
import type { WrestlingDirection, WrestlingStimulus, ShotAttack } from "./protocolTypes";

export type { AudioMode };

export const WRESTLING_AUDIO_MODE_LABELS: Record<AudioMode, string> = {
  off: "Sessiz",
  cues: "Efekt",
  voice: "Sesli komut",
};

export function speakAttack(attack: ShotAttack): string {
  if (attack === "LEFT_SINGLE") return "Sol tek dalış";
  if (attack === "RIGHT_SINGLE") return "Sağ tek dalış";
  return "Çift dalış";
}

export function speakDirection(direction: WrestlingDirection): string {
  switch (direction) {
    case "LEFT":
      return "Sola";
    case "RIGHT":
      return "Sağa";
    case "FORWARD":
      return "İleri";
    case "BACK":
      return "Geri";
    case "CIRCLE_LEFT":
      return "Sola dön";
    case "CIRCLE_RIGHT":
      return "Sağa dön";
    case "LEVEL":
      return "Seviye düş";
    case "SPRAWL":
      return "Sprawl";
    case "STAND":
      return "Ayağa kalk";
    default:
      return "";
  }
}

/**
 * Cue'nun sesli okunacak metni. `null` = bu cue seslendirilmez.
 */
export function wrestlingCueSpeech(stimulus: WrestlingStimulus): string | null {
  switch (stimulus.kind) {
    case "SHOT":
    case "CHOICE":
      return speakAttack(stimulus.attack);
    case "SPRAWL":
      return "Sprawl";
    case "RECOGNITION":
      // Sahte/gerçek ayrımı KASTEN sessiz — tanıma testinin ölçtüğü şey bu.
      return null;
    case "VIRTUAL_WRESTLER":
      // Rakip hamlesini sesle söylemek okuma testini bozar; yalnız efekt çalar.
      return null;
    case "MOVEMENT":
    case "SCRAMBLE":
      return speakDirection(stimulus.command);
    case "STANCE":
      return "Duruşu koru";
    case "HAND_FIGHTING":
      if (stimulus.target === "LEFT_WRIST") return "Sol bilek";
      if (stimulus.target === "RIGHT_WRIST") return "Sağ bilek";
      if (stimulus.target === "COLLAR_TIE") return "Ense çek";
      return "İçeri gir";
    case "CHAIN":
      return stimulus.sequence.map(speakDirection).filter(Boolean).join(", ");
    case "FATIGUE":
      return wrestlingCueSpeech(stimulus.nested);
    case "PATTERN":
      return null;
    default:
      return null;
  }
}

/**
 * Cue anında çalınacak nötr efekt. Rakip temelli protokollerde saldırı sesi
 * kullanılır — hangi hamle olduğunu sızdırmaz, yalnız "geliyor" der.
 */
export function wrestlingCueBeep(stimulus: WrestlingStimulus): "go" | "attack" {
  return stimulus.kind === "VIRTUAL_WRESTLER" ||
    stimulus.kind === "RECOGNITION" ||
    stimulus.kind === "PATTERN"
    ? "attack"
    : "go";
}
