"use client";

/**
 * Ortak ses kontrolü — sustur düğmesi + Türkçe ses seçici.
 *
 * Kameralı ve sesli araçların hepsi bunu kullanır; ayarlar localStorage'da
 * tutulduğu için bir araçta seçilen ses diğerlerinde de geçerlidir.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  getPreferredVoiceURI,
  getServerVoicesSnapshot,
  getVoicesSnapshot,
  isMuted,
  isSpeechSupported,
  setMuted,
  setPreferredVoiceURI,
  speak,
  subscribeVoices,
} from "@/lib/audio/voice";
import { isTurkish, sortVoicesForPicker, voiceLabel } from "@/lib/audio/voice-select";

type Props = {
  /** Sustur durumu değişince haber ver — bileşen kendi state'ini tazeleyebilsin. */
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  /** Ses seçiciyi gizlemek için (dar başlıklarda). */
  compact?: boolean;
  className?: string;
};

export function SoundControls({ muted, onMutedChange, compact = false, className = "" }: Props) {
  const voices = useSyncExternalStore(
    subscribeVoices,
    getVoicesSnapshot,
    getServerVoicesSnapshot,
  );
  /**
   * Ses listesi ve kayıtlı seçim yalnızca tarayıcıda bilinebiliyor. Bunları
   * ilk render'da okumak sunucu HTML'iyle uyuşmazlığa (hydration hatası) yol
   * açıyordu; bu yüzden seçici DOM'a oturduktan sonra gösteriliyor.
   */
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setSelected(getPreferredVoiceURI() ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const toggle = useCallback(() => {
    const next = !muted;
    setMuted(next);
    onMutedChange(next);
    // Açılış kullanıcı hareketi içinde olduğu için burada kısa bir doğrulama
    // cümlesi güvenle okunabilir — kullanıcı sesin geldiğini duyar.
    if (!next) speak("Ses açık");
  }, [muted, onMutedChange]);

  const turkishVoices = voices.filter(isTurkish);
  const showPicker = mounted && !compact && isSpeechSupported();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!muted}
        className={`rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
          muted
            ? "border-white/10 bg-white/[.04] text-zinc-400 hover:text-white"
            : "border-brand-yellow bg-brand-yellow text-black"
        }`}
      >
        {muted ? "Ses kapalı" : "Ses açık"}
      </button>

      {showPicker && voices.length > 0 && (
        <select
          aria-label="Komut sesi"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setPreferredVoiceURI(event.target.value || null);
            speak("Komut sesi seçildi");
          }}
          className="rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-zinc-200"
        >
          <option value="">Otomatik (Türkçe, erkek öncelikli)</option>
          {sortVoicesForPicker(voices).map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voiceLabel(voice)}
            </option>
          ))}
        </select>
      )}

      {showPicker && voices.length > 0 && turkishVoices.length === 0 && (
        <span className="text-xs text-amber-400">
          Cihazda Türkçe ses yok — komutlar aksanlı okunur, listeden başka bir ses seçebilirsin.
        </span>
      )}

      {mounted && !compact && !isSpeechSupported() && (
        <span className="text-xs text-amber-400">
          Tarayıcı sesli okumayı desteklemiyor — komutlar yalnızca ekranda görünür.
        </span>
      )}
    </div>
  );
}

/** Sustur durumunu ilk render'da localStorage'dan okumak için yardımcı. */
export function initialMuted(): boolean {
  return typeof window === "undefined" ? false : isMuted();
}
