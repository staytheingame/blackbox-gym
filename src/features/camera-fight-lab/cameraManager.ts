import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import type { CameraSnapshot } from "./types";

export type CameraSession = {
  stream: MediaStream;
  snapshot: CameraSnapshot;
  devices: MediaDeviceInfo[];
};

export function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : "Kamera başlatılamadı.";
  }
  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden bu siteye izin verip tekrar dene.";
    case "NotFoundError":
      return "Kullanılabilir bir kamera bulunamadı.";
    case "NotReadableError":
      return "Kamera başka bir uygulama tarafından kullanılıyor olabilir. Diğer uygulamaları kapatıp tekrar dene.";
    case "OverconstrainedError":
      return "Kamera istenen ayarları desteklemiyor. Daha düşük ayarlarla tekrar dene.";
    default:
      return `Kamera başlatılamadı: ${error.message}`;
  }
}

export async function openCamera(deviceId?: string): Promise<CameraSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Bu tarayıcı kamera erişimini desteklemiyor veya sayfa güvenli bağlantıda değil.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: PERFORMANCE_CONFIG.camera.idealWidth },
      height: { ideal: PERFORMANCE_CONFIG.camera.idealHeight },
      frameRate: {
        ideal: PERFORMANCE_CONFIG.camera.idealFrameRate,
        min: PERFORMANCE_CONFIG.camera.acceptableFrameRate,
      },
      facingMode: deviceId ? undefined : { ideal: "user" },
      deviceId: deviceId ? { exact: deviceId } : undefined,
    },
  });
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === "videoinput",
  );
  return {
    stream,
    devices,
    snapshot: {
      deviceId: settings.deviceId,
      deviceLabel: track.label || "Kamera",
      width: settings.width ?? PERFORMANCE_CONFIG.camera.idealWidth,
      height: settings.height ?? PERFORMANCE_CONFIG.camera.idealHeight,
      frameRate: settings.frameRate ?? 0,
      facingMode: settings.facingMode,
    },
  };
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

