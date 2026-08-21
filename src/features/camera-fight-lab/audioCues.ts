/**
 * Fight Lab ses katmanı — SAF eşleme fonksiyonları (tarayıcı API'si yok).
 *
 * ★ ÖLÇÜM UYARISI: bu protokollerin bir kısmı GÖRSEL tepki testidir. Cue
 *   metnini sesli okumak testi görsel-işitsel (bimodal) bir tatbikata
 *   çevirir; ölçülen tepki süresi saf görsel tepkiyle karşılaştırılamaz.
 *   Bu yüzden ses üç kademeli:
 *     - "off"   : hiç ses yok
 *     - "cues"  : yalnızca efekt sesleri (cue anında nötr bip, geri bildirim
 *                 tonları). Hangi hedefin/elin geldiğini SIZDIRMAZ, bu yüzden
 *                 ölçüm karşılaştırılabilir kalır.
 *     - "voice" : efektler + komutun sesli okunması. Antrenman için istenen
 *                 mod; ölçüm bimodal olur.
 *   Seçilen kademe seans dışa aktarımına yazılır (bkz. sessionExport).
 *
 * Peripheral protokolünde hedefin YÖNÜ hiçbir kademede seslendirilmez —
 * amacı çevresel görüş; yönü söylemek testi anlamsız kılardı.
 */

import type { BeepKind } from "@/lib/audio/voice";
import type { CanvasFeedback } from "./canvasRenderer";
import type { AudioMode, DefenseAction, Hand, TrialStimulus } from "./types";

export type { AudioMode };

export const AUDIO_MODE_LABELS: Record<AudioMode, string> = {
  off: "Sessiz",
  cues: "Efekt",
  voice: "Sesli komut",
};

export const AUDIO_MODE_HINTS: Record<AudioMode, string> = {
  off: "Hiç ses çalınmaz.",
  cues: "Cue anında nötr bip ve geri bildirim tonları — komut sızdırılmaz, ölçüm saf görsel kalır.",
  voice: "Komut sesli okunur. Antrenman için idealdir; ölçüm görsel-işitsel olur.",
};

export const DEFAULT_AUDIO_MODE: AudioMode = "voice";

export function speakDefenseAction(action: DefenseAction): string {
  if (action === "SLIP_LEFT") return "Sola slip";
  if (action === "SLIP_RIGHT") return "Sağa slip";
  return "Çömel";
}

export function speakHand(hand: Hand): string {
  return hand === "left" ? "Sol" : "Sağ";
}

export function speakCombo(sequence: readonly Hand[]): string {
  return sequence.map(speakHand).join(" ");
}

/**
 * Bir stimulusun sesli okunacak metni. `null` dönmesi "bu cue için konuşma"
 * demektir (peripheral: yön sızdırılmaz).
 */
export function cueSpeech(stimulus: TrialStimulus): string | null {
  switch (stimulus.kind) {
    case "SIMPLE":
      return "Vur";
    case "CHOICE":
      return stimulus.requiredHand === "left" || stimulus.requiredHand === "right"
        ? speakHand(stimulus.requiredHand)
        : null;
    case "GO":
      return "Vur";
    case "NO_GO":
      return "Dur";
    case "PERIPHERAL":
      // Yön kasten söylenmez — çevresel görüş testinin ölçtüğü şey bu.
      return null;
    case "COMBO":
      return stimulus.comboSequence ? speakCombo(stimulus.comboSequence) : "Vur";
    case "GUARD_RETURN":
      return "Vur";
    case "DEFENSE":
      return stimulus.defenseAction ? speakDefenseAction(stimulus.defenseAction) : null;
    case "VIRTUAL_OPPONENT":
      if (stimulus.virtualOpponentResponseChannel === "DEFEND") {
        return stimulus.defenseAction ? speakDefenseAction(stimulus.defenseAction) : null;
      }
      return stimulus.comboSequence ? speakCombo(stimulus.comboSequence) : "Kontra";
    default:
      return null;
  }
}

/** Cue anında çalınacak nötr bip — hangi cue olduğunu sızdırmaz. */
export function cueBeep(stimulus: TrialStimulus): BeepKind {
  return stimulus.kind === "VIRTUAL_OPPONENT" ? "attack" : "go";
}

/** Geri bildirim tonu → efekt sesi. `null` ise ses çalınmaz. */
export function feedbackBeep(feedback: CanvasFeedback): BeepKind | null {
  if (!feedback) return null;
  switch (feedback.tone) {
    case "hit":
      return "hit";
    case "miss":
      return "miss";
    case "early":
      return "wrong";
    case "slow":
      return "miss";
    case "tracking":
      return null;
    default:
      return null;
  }
}
