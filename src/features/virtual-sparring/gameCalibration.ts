/**
 * Oyun modu kalibrasyonu — SAF fonksiyonlar (test edilebilir).
 *
 * NEDEN AYRI: Fight Lab'in kalibrasyonu bir ÖLÇÜM kapısıdır — 1,2 sn kesintisiz
 * kararlılık, 18 kullanılabilir örnek, guard'ın kaldırılmış olması, bileklerin
 * kadraj kenarından uzak durması ve neredeyse hiç titrememe ister. Bunların
 * hepsi ölçümün karşılaştırılabilir olması için doğru; ama OYUN için kapı
 * niteliğinde: pose fps'i 15'in altına düşen bir dizüstünde "18 örnek / 1,2 sn"
 * koşulu hiçbir zaman sağlanamıyor ve kullanıcı oyuna hiç giremiyor.
 *
 * Buradaki sürüm yalnızca oyunun ÇALIŞMASI için gerekli minimumu ister:
 *   • kadrajda bir kişi var
 *   • iki omuz görünüyor (hedef ölçeği buradan geliyor)
 *   • baş görünüyor (savunma hareketleri buradan okunuyor)
 *   • mesafe makul
 * Guard, sabit durma ve kenar payı koşulları KALDIRILDI. Bilekler görünmüyorsa
 * guard noktaları omuzlardan türetiliyor — oyun yine de oynanabilir kalıyor.
 *
 * Ayrıca: birkaç saniye sonra "yine de başla" izni açılır. Oyunun kullanıcıyı
 * kapıda tutması, ölçümün biraz kaba olmasından daha kötüdür.
 */

import { median } from "../camera-fight-lab/statistics";
import { distance3, midpoint3 } from "../camera-fight-lab/vectorMath";
import type {
  CalibrationSnapshot,
  CameraSnapshot,
  PoseSample,
  Vec3,
} from "../camera-fight-lab/types";

export const GAME_CALIBRATION = {
  /** Bu kadar geriye bakılır. */
  windowMs: 900,
  /** Örnekleri "kullanılabilir" sayan görünürlük eşiği (lab: 0.65). */
  minVisibility: 0.4,
  /** Omuzların görünmesi gereken örnek oranı (lab: 0.85). */
  shoulderRatio: 0.5,
  /** Başın görünmesi gereken örnek oranı. */
  headRatio: 0.4,
  /** Kullanılabilir en az örnek — düşük fps'te de dolabilsin diye küçük. */
  minSamples: 4,
  /** Gözlenmesi gereken en kısa süre. */
  minDurationMs: 500,
  /** Omuz genişliği aralığı (lab: 0.14–0.5). */
  minShoulderWidth: 0.05,
  maxShoulderWidth: 0.8,
  /** Bu süreden sonra kullanıcı elle geçebilir. */
  forceAfterMs: 6_000,
} as const;

export type GameCalibrationCheckId = "person" | "shoulders" | "head" | "distance";

export type GameCalibrationCheck = {
  id: GameCalibrationCheckId;
  label: string;
  ok: boolean;
  /** Sorun varsa ne yapılacağı. */
  hint: string;
};

export type GameCalibrationState = {
  ready: boolean;
  progressPct: number;
  checks: GameCalibrationCheck[];
  snapshot: CalibrationSnapshot | null;
  /** Kalibrasyon uzadıysa elle geçme izni açılır. */
  canForce: boolean;
};

function medianVec3(values: readonly Vec3[]): Vec3 | null {
  const x = median(values.map((value) => value.x));
  const y = median(values.map((value) => value.y));
  const z = median(values.map((value) => value.z));
  return x === null || y === null || z === null ? null : { x, y, z };
}

function check(
  id: GameCalibrationCheckId,
  label: string,
  ok: boolean,
  hint: string,
): GameCalibrationCheck {
  return { id, label, ok, hint };
}

/**
 * Bilekler görünmüyorsa guard noktalarını omuzdan türetir: eller çeneye
 * yakın, omuz genişliğinin ~yarısı kadar içeride ve omuz hizasının biraz
 * üstünde. Gerçek guard'ın yerini tam tutmaz ama hedef üretimi ve savunma
 * eşiklerinin ölçeği için yeterli.
 */
function deriveGuard(shoulder: Vec3, center: Vec3, shoulderWidth: number): Vec3 {
  const inward = (center.x - shoulder.x) * 0.45;
  return {
    x: shoulder.x + inward,
    y: shoulder.y - shoulderWidth * 0.25,
    z: shoulder.z,
  };
}

export function evaluateGameCalibration(input: {
  samples: readonly PoseSample[];
  camera: CameraSnapshot;
  nowMs: number;
  /** Kalibrasyon ekranında geçen süre — "yine de başla" iznini açar. */
  elapsedMs: number;
}): GameCalibrationState {
  const { samples: allSamples, camera, nowMs, elapsedMs } = input;
  const canForce = elapsedMs >= GAME_CALIBRATION.forceAfterMs;
  const samples = allSamples.filter(
    (sample) => sample.timestampMs >= nowMs - GAME_CALIBRATION.windowMs,
  );

  const withPerson = samples.filter((sample) => sample.poseCount >= 1);
  if (withPerson.length === 0) {
    return {
      ready: false,
      progressPct: 0,
      canForce: false, // kimse yokken zorla başlatmanın anlamı yok
      snapshot: null,
      checks: [
        check("person", "Kadrajdasın", false, "Kameranın karşısına geç, tüm üst gövden görünsün."),
        check("shoulders", "Omuzların görünüyor", false, "Omuzlarını kameraya dönük tut."),
        check("head", "Başın görünüyor", false, "Yüzün kadrajda olsun."),
        check("distance", "Mesafe uygun", false, "Kameradan 1,5–2,5 metre uzakta dur."),
      ],
    };
  }

  const visible = GAME_CALIBRATION.minVisibility;
  const usable = withPerson.filter(
    (sample) =>
      sample.visibility.leftShoulder >= visible &&
      sample.visibility.rightShoulder >= visible &&
      !!sample.world.leftShoulder &&
      !!sample.world.rightShoulder &&
      !!sample.image.leftShoulder &&
      !!sample.image.rightShoulder,
  );

  const shouldersOk = usable.length >= withPerson.length * GAME_CALIBRATION.shoulderRatio;
  const headSamples = withPerson.filter(
    (sample) => sample.visibility.nose >= visible && !!sample.world.nose && !!sample.image.nose,
  );
  const headOk = headSamples.length >= withPerson.length * GAME_CALIBRATION.headRatio;

  const leftShoulderImage = medianVec3(
    usable.flatMap((sample) => (sample.image.leftShoulder ? [sample.image.leftShoulder] : [])),
  );
  const rightShoulderImage = medianVec3(
    usable.flatMap((sample) => (sample.image.rightShoulder ? [sample.image.rightShoulder] : [])),
  );
  const shoulderWidth =
    leftShoulderImage && rightShoulderImage
      ? Math.abs(leftShoulderImage.x - rightShoulderImage.x)
      : 0;
  const distanceOk =
    shoulderWidth >= GAME_CALIBRATION.minShoulderWidth &&
    shoulderWidth <= GAME_CALIBRATION.maxShoulderWidth;

  const observedDuration =
    usable.length >= 2 ? usable[usable.length - 1].timestampMs - usable[0].timestampMs : 0;
  const enoughData =
    usable.length >= GAME_CALIBRATION.minSamples &&
    observedDuration >= GAME_CALIBRATION.minDurationMs;

  const checks = [
    check("person", "Kadrajdasın", true, ""),
    check(
      "shoulders",
      "Omuzların görünüyor",
      shouldersOk,
      "Omuzlarını kameraya dönük tut, ışığı artır.",
    ),
    check("head", "Başın görünüyor", headOk, "Yüzünü kadrajda tut — savunma buradan okunuyor."),
    check(
      "distance",
      "Mesafe uygun",
      distanceOk,
      shoulderWidth > GAME_CALIBRATION.maxShoulderWidth
        ? "Kameradan biraz uzaklaş."
        : "Kameraya biraz yaklaş.",
    ),
  ];

  const passedChecks = checks.filter((item) => item.ok).length;
  const dataProgress = enoughData
    ? 1
    : Math.min(
        1,
        Math.max(
          usable.length / GAME_CALIBRATION.minSamples,
          observedDuration / GAME_CALIBRATION.minDurationMs,
        ),
      );
  const progressPct = Math.round(((passedChecks / checks.length) * 0.7 + dataProgress * 0.3) * 100);

  const snapshot = buildSnapshot({ usable, headSamples, camera, nowMs, shoulderWidth });
  const ready = shouldersOk && headOk && distanceOk && enoughData && snapshot !== null;

  return { ready, progressPct, checks, snapshot, canForce: canForce && snapshot !== null };
}

/**
 * Elde ne varsa ondan bir snapshot kurar. Omuzlar olmadan oyun oynanamaz —
 * o durumda `null` döner ve "yine de başla" da kapalı kalır.
 */
function buildSnapshot(input: {
  usable: readonly PoseSample[];
  headSamples: readonly PoseSample[];
  camera: CameraSnapshot;
  nowMs: number;
  shoulderWidth: number;
}): CalibrationSnapshot | null {
  const { usable, headSamples, camera, nowMs, shoulderWidth } = input;
  if (usable.length === 0) return null;

  const leftShoulderImage = medianVec3(
    usable.flatMap((sample) => (sample.image.leftShoulder ? [sample.image.leftShoulder] : [])),
  );
  const rightShoulderImage = medianVec3(
    usable.flatMap((sample) => (sample.image.rightShoulder ? [sample.image.rightShoulder] : [])),
  );
  const leftShoulderWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.leftShoulder ? [sample.world.leftShoulder] : [])),
  );
  const rightShoulderWorld = medianVec3(
    usable.flatMap((sample) => (sample.world.rightShoulder ? [sample.world.rightShoulder] : [])),
  );
  if (!leftShoulderImage || !rightShoulderImage || !leftShoulderWorld || !rightShoulderWorld) {
    return null;
  }

  const shoulderCenterImage = midpoint3(leftShoulderImage, rightShoulderImage);
  const shoulderCenterWorld = midpoint3(leftShoulderWorld, rightShoulderWorld);
  const shoulderWidthM = distance3(leftShoulderWorld, rightShoulderWorld);

  // Baş görünmüyorsa omuz merkezinin bir omuz genişliği üstü varsayılır.
  const headNeutralImage =
    medianVec3(headSamples.flatMap((sample) => (sample.image.nose ? [sample.image.nose] : []))) ??
    { ...shoulderCenterImage, y: shoulderCenterImage.y - shoulderWidth * 0.75 };
  const headNeutralWorld =
    medianVec3(headSamples.flatMap((sample) => (sample.world.nose ? [sample.world.nose] : []))) ??
    { ...shoulderCenterWorld, y: shoulderCenterWorld.y + shoulderWidthM * 0.75 };

  const leftGuardImage =
    medianVec3(usable.flatMap((sample) => (sample.image.leftWrist ? [sample.image.leftWrist] : []))) ??
    deriveGuard(leftShoulderImage, shoulderCenterImage, shoulderWidth);
  const rightGuardImage =
    medianVec3(
      usable.flatMap((sample) => (sample.image.rightWrist ? [sample.image.rightWrist] : [])),
    ) ?? deriveGuard(rightShoulderImage, shoulderCenterImage, shoulderWidth);
  const leftGuardWorld =
    medianVec3(usable.flatMap((sample) => (sample.world.leftWrist ? [sample.world.leftWrist] : []))) ??
    deriveGuard(leftShoulderWorld, shoulderCenterWorld, shoulderWidthM);
  const rightGuardWorld =
    medianVec3(
      usable.flatMap((sample) => (sample.world.rightWrist ? [sample.world.rightWrist] : [])),
    ) ?? deriveGuard(rightShoulderWorld, shoulderCenterWorld, shoulderWidthM);

  const duration =
    usable.length >= 2 ? usable[usable.length - 1].timestampMs - usable[0].timestampMs : 0;

  return {
    completedAt: nowMs,
    shoulderWidthM,
    shoulderWidthNormalized: shoulderWidth,
    leftShoulderWorld,
    rightShoulderWorld,
    leftShoulderImage,
    rightShoulderImage,
    leftGuardWorld,
    rightGuardWorld,
    leftGuardImage,
    rightGuardImage,
    torsoCenterWorld: shoulderCenterWorld,
    torsoCenterImage: shoulderCenterImage,
    headNeutralWorld,
    headNeutralImage,
    // Oyun modunda gürültü ölçülmüyor; alan şema uyumu için doldurulur.
    leftWristNoiseM: 0,
    rightWristNoiseM: 0,
    camera,
    estimatedProcessingFps:
      duration > 0 ? ((usable.length - 1) * 1_000) / duration : 0,
  };
}
