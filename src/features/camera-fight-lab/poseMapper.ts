import { EMPTY_VISIBILITY, type PoseSample, type Vec3 } from "./types";

type LandmarkLike = {
  x?: number;
  y?: number;
  z?: number;
  visibility?: number;
};

type PoseResultLike = {
  landmarks?: LandmarkLike[][];
  worldLandmarks?: LandmarkLike[][];
};

/**
 * MediaPipe handedness (sol/sağ), girdi görüntüsünün AYNALANMIŞ (selfie/ön
 * kamera) olduğunu varsayarak etiketlenir — bkz. Google'ın el/poz landmarker
 * dokümantasyonu: "handedness is determined assuming the input image is
 * mirrored... if it is not the case, swap the output". Bu uygulama modele
 * HAM (aynalanmamış) video karesi veriyor — aynalama yalnızca gösterimde,
 * `coordinates.ts`/CSS `scale-x-[-1]` katmanında uygulanıyor (bkz.
 * poseClient.ts: `detectForVideo(video, …)`, hiç flip yok). Bu yüzden ham
 * indeks 11 (MediaPipe'ın "left_shoulder"ı) burada aslında oyuncunun SAĞ
 * omzuna denk geliyor. Aşağıdaki eşleme bunu telafi etmek için kasıtlı
 * olarak ters çevrilmiş durumda; "düzeltmek" için ham indeksleri MediaPipe
 * sırasına geri döndürmek sol/sağ'ı yeniden bozar.
 */
const INDEX = {
  nose: 0,
  leftShoulder: 12,
  rightShoulder: 11,
  leftElbow: 14,
  rightElbow: 13,
  leftWrist: 16,
  rightWrist: 15,
  leftHip: 24,
  rightHip: 23,
  leftKnee: 26,
  rightKnee: 25,
  leftAnkle: 28,
  rightAnkle: 27,
  leftHeel: 30,
  rightHeel: 29,
  leftFootIndex: 32,
  rightFootIndex: 31,
} as const;

const pointAt = (landmarks: LandmarkLike[] | undefined, index: number): Vec3 | undefined => {
  const point = landmarks?.[index];
  if (
    !point ||
    typeof point.x !== "number" ||
    typeof point.y !== "number" ||
    typeof point.z !== "number"
  ) {
    return undefined;
  }
  return { x: point.x, y: point.y, z: point.z };
};

const visibilityAt = (landmarks: LandmarkLike[] | undefined, index: number): number =>
  landmarks?.[index]?.visibility ?? 0;

export function mapPoseResult(result: PoseResultLike, timestampMs: number): PoseSample {
  const image = result.landmarks?.[0];
  const world = result.worldLandmarks?.[0];
  return {
    timestampMs,
    poseCount: result.landmarks?.length ?? 0,
    image: {
      nose: pointAt(image, INDEX.nose),
      leftShoulder: pointAt(image, INDEX.leftShoulder),
      rightShoulder: pointAt(image, INDEX.rightShoulder),
      leftElbow: pointAt(image, INDEX.leftElbow),
      rightElbow: pointAt(image, INDEX.rightElbow),
      leftWrist: pointAt(image, INDEX.leftWrist),
      rightWrist: pointAt(image, INDEX.rightWrist),
      leftHip: pointAt(image, INDEX.leftHip),
      rightHip: pointAt(image, INDEX.rightHip),
      leftKnee: pointAt(image, INDEX.leftKnee),
      rightKnee: pointAt(image, INDEX.rightKnee),
      leftAnkle: pointAt(image, INDEX.leftAnkle),
      rightAnkle: pointAt(image, INDEX.rightAnkle),
      leftHeel: pointAt(image, INDEX.leftHeel),
      rightHeel: pointAt(image, INDEX.rightHeel),
      leftFootIndex: pointAt(image, INDEX.leftFootIndex),
      rightFootIndex: pointAt(image, INDEX.rightFootIndex),
    },
    world: {
      nose: pointAt(world, INDEX.nose),
      leftShoulder: pointAt(world, INDEX.leftShoulder),
      rightShoulder: pointAt(world, INDEX.rightShoulder),
      leftElbow: pointAt(world, INDEX.leftElbow),
      rightElbow: pointAt(world, INDEX.rightElbow),
      leftWrist: pointAt(world, INDEX.leftWrist),
      rightWrist: pointAt(world, INDEX.rightWrist),
      leftHip: pointAt(world, INDEX.leftHip),
      rightHip: pointAt(world, INDEX.rightHip),
      leftKnee: pointAt(world, INDEX.leftKnee),
      rightKnee: pointAt(world, INDEX.rightKnee),
      leftAnkle: pointAt(world, INDEX.leftAnkle),
      rightAnkle: pointAt(world, INDEX.rightAnkle),
      leftHeel: pointAt(world, INDEX.leftHeel),
      rightHeel: pointAt(world, INDEX.rightHeel),
      leftFootIndex: pointAt(world, INDEX.leftFootIndex),
      rightFootIndex: pointAt(world, INDEX.rightFootIndex),
    },
    visibility: image
      ? {
          nose: visibilityAt(image, INDEX.nose),
          leftShoulder: visibilityAt(image, INDEX.leftShoulder),
          rightShoulder: visibilityAt(image, INDEX.rightShoulder),
          leftElbow: visibilityAt(image, INDEX.leftElbow),
          rightElbow: visibilityAt(image, INDEX.rightElbow),
          leftWrist: visibilityAt(image, INDEX.leftWrist),
          rightWrist: visibilityAt(image, INDEX.rightWrist),
          leftHip: visibilityAt(image, INDEX.leftHip),
          rightHip: visibilityAt(image, INDEX.rightHip),
          leftKnee: visibilityAt(image, INDEX.leftKnee),
          rightKnee: visibilityAt(image, INDEX.rightKnee),
          leftAnkle: visibilityAt(image, INDEX.leftAnkle),
          rightAnkle: visibilityAt(image, INDEX.rightAnkle),
          leftHeel: visibilityAt(image, INDEX.leftHeel),
          rightHeel: visibilityAt(image, INDEX.rightHeel),
          leftFootIndex: visibilityAt(image, INDEX.leftFootIndex),
          rightFootIndex: visibilityAt(image, INDEX.rightFootIndex),
        }
      : { ...EMPTY_VISIBILITY },
  };
}
