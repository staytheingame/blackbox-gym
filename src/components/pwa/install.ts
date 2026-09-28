/**
 * Uygulama kurulumu — tarayıcı tarafı ortak yardımcılar.
 *
 * `beforeinstallprompt` sayfa başına yalnız BİR kez ve yükleme sırasında
 * ateşlenir. Düğme başka bir sayfada (ör. panel yan menüsü) sonradan
 * açılırsa olayı kaçırırdı; bu yüzden olay kök düzendeki `PwaRegister`
 * tarafından yakalanıp `window`da saklanır, düğmeler oradan okur.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __bbInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const INSTALL_EVENT = "bb-install-change";

export type InstallMode =
  /** Zaten uygulama olarak açık (ya da kuruldu) — düğme gösterilmez. */
  | "installed"
  /** Tarayıcı kurulum penceresini açabilir. */
  | "prompt"
  /** iPhone/iPad: kurulum menüden elle yapılır. */
  | "ios"
  /** Kurulum sunulmuyor (ör. masaüstü Firefox). */
  | "none";

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosStandalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ Mac gibi görünür; dokunmatik ekranı ondan ayırır.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function readInstallMode(): InstallMode {
  if (isStandalone()) return "installed";
  if (window.__bbInstallPrompt) return "prompt";
  if (isIos()) return "ios";
  return "none";
}

export function subscribeInstall(onChange: () => void): () => void {
  window.addEventListener(INSTALL_EVENT, onChange);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(INSTALL_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

export function notifyInstallChange(): void {
  window.dispatchEvent(new Event(INSTALL_EVENT));
}
