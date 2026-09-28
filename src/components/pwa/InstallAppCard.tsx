"use client";

import { useSyncExternalStore } from "react";
import {
  notifyInstallChange,
  readInstallMode,
  subscribeInstall,
  type InstallMode,
} from "./install";

/** Sunucuda ve ilk çizimde hiçbir şey gösterme — hidrasyon uyuşmazlığı olmasın. */
function serverSnapshot(): InstallMode {
  return "none";
}

/**
 * "Uygulamayı Yükle" — telefona ve bilgisayara uygulama gibi kurulum.
 *
 *   - Chrome/Edge (Android + masaüstü): düğme sistemin kurulum penceresini açar.
 *   - iPhone/iPad: tarayıcı böyle bir pencere sunmaz; adımlar yazıyla gösterilir.
 *   - Zaten uygulama olarak açıksa ya da kurulum sunulmuyorsa hiçbir şey çizilmez.
 */
export function InstallAppCard({ compact = false }: { compact?: boolean }) {
  const mode = useSyncExternalStore(subscribeInstall, readInstallMode, serverSnapshot);

  async function install() {
    const promptEvent = window.__bbInstallPrompt;
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      // Olay bir kez kullanılabilir; sonrası ne olursa olsun düğme kalksın.
      window.__bbInstallPrompt = null;
      notifyInstallChange();
    }
  }

  if (mode === "installed" || mode === "none") return null;

  const wrapper = compact
    ? "px-3 pb-3"
    : "mt-4 rounded-sm border border-brand-border bg-brand-black/40 p-4";

  if (mode === "prompt") {
    return (
      <div className={wrapper}>
        <button
          type="button"
          onClick={install}
          className="flex min-h-11 w-full items-center justify-center rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow/20"
        >
          Uygulamayı Yükle
        </button>
        {!compact && (
          <p className="mt-2 text-[0.7rem] leading-relaxed text-brand-muted">
            Ana ekrana ya da masaüstüne eklenir, uygulama gibi açılır.
          </p>
        )}
      </div>
    );
  }

  // iOS
  return (
    <div className={wrapper}>
      <details className="text-xs text-brand-muted">
        <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 px-3 py-2 font-bold uppercase tracking-wide text-brand-yellow">
          Uygulamayı Yükle
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 leading-relaxed">
          <li>Safari&apos;de alttaki <strong className="text-brand-white">Paylaş</strong> düğmesine dokun.</li>
          <li><strong className="text-brand-white">Ana Ekrana Ekle</strong>&apos;yi seç.</li>
          <li><strong className="text-brand-white">Ekle</strong>&apos;ye bas — BlackBox ana ekranında görünür.</li>
        </ol>
      </details>
    </div>
  );
}
