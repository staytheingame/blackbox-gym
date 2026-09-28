"use client";

import { useEffect } from "react";
import {
  notifyInstallChange,
  type BeforeInstallPromptEvent,
} from "./install";

/**
 * Kök düzende bir kez yer alır: (1) çevrimdışı ekranı için service worker'ı
 * kaydeder, (2) tarayıcının "yükle" olayını yakalayıp saklar.
 *
 * Service worker yalnız üretimde kaydedilir; geliştirmede eski bir sürümün
 * takılı kalması "değişiklik görünmüyor" diye saatler yedirir.
 */
export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error: unknown) => {
          console.error("[pwa] service worker kaydedilemedi", error);
        });
    }

    function onBeforeInstall(event: Event) {
      // Tarayıcının kendi küçük çubuğunu bastır; kurulumu panelin düğmesi başlatır.
      event.preventDefault();
      window.__bbInstallPrompt = event as BeforeInstallPromptEvent;
      notifyInstallChange();
    }

    function onInstalled() {
      window.__bbInstallPrompt = null;
      notifyInstallChange();
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
