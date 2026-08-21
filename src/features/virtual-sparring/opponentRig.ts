/**
 * Sanal rakibin 3B iskeleti — SAF geometri (canvas/DOM yok, test edilebilir).
 *
 * Neden hazır bir 3B kütüphane yok: bu sahnede tek bir insansı figür var ve
 * onu tarayıcıda 2D canvas'a boyamak için perspektif izdüşümü + derinlik
 * sıralaması yetiyor. Böylece paket ağırlığı artmıyor, model dosyası
 * indirilmiyor (araç çevrimdışı da açılıyor) ve animasyon tamamen saf
 * fonksiyonlarla test edilebiliyor.
 *
 * KOORDİNAT SİSTEMİ (rig uzayı, birim ≈ metre):
 *   origin = kalça merkezi, +x EKRANDA SAĞ, +y yukarı,
 *   +z kameraya doğru. Rakip bize DÖNÜK durur; bu yüzden rakibin sağ eli
 *   ekranda SOLDA görünür. Eklem adları rakibin kendi anatomisine göredir.
 */

export type Point3 = { x: number; y: number; z: number };

export type JointName =
  | "head"
  | "neck"
  | "chest"
  | "pelvis"
  | "shoulderL"
  | "shoulderR"
  | "elbowL"
  | "elbowR"
  | "wristL"
  | "wristR"
  | "hipL"
  | "hipR"
  | "kneeL"
  | "kneeR"
  | "ankleL"
  | "ankleR";

export type RigPose = Record<JointName, Point3>;

/** Rakibin hangi eli çalıştığı — savunma yönüyle eşleşir. */
export type AttackSide = "left" | "right" | "center";

export type OpponentAction =
  /** Nötr guard, hafif salınım. */
  | "IDLE"
  /** Vuruş öncesi yüklenme (telegraph). */
  | "TELEGRAPH"
  /** Yumruk yolda. */
  | "COMMIT"
  /** Vuruş indi — sporcu geç kaldı. */
  | "LAND"
  /** Sporcu doğru yanıtı yetiştirdi; rakip geri çekiliyor. */
  | "BEATEN"
  /** Sporcunun kontrası isabet etti. */
  | "HURT";

const point = (x: number, y: number, z: number): Point3 => ({ x, y, z });

/** Nötr boks duruşu — diğer tüm pozlar bunun üzerine kurulur. */
export const GUARD_POSE: RigPose = {
  pelvis: point(0, 0, 0),
  hipL: point(0.13, 0, 0),
  hipR: point(-0.13, 0, 0),
  kneeL: point(0.16, -0.44, 0.04),
  kneeR: point(-0.16, -0.44, -0.02),
  ankleL: point(0.18, -0.88, 0.1),
  ankleR: point(-0.2, -0.88, -0.12),
  chest: point(0, 0.4, 0),
  neck: point(0, 0.54, 0),
  head: point(0, 0.72, 0.02),
  shoulderL: point(0.21, 0.48, 0.01),
  shoulderR: point(-0.21, 0.48, 0.01),
  elbowL: point(0.25, 0.22, 0.12),
  elbowR: point(-0.25, 0.22, 0.12),
  wristL: point(0.13, 0.55, 0.22),
  wristR: point(-0.13, 0.55, 0.22),
};

export const JOINT_NAMES = Object.keys(GUARD_POSE) as JointName[];

/** Çizilecek kemikler ve yarıçapları (birim: metre). */
export const BONES: readonly { from: JointName; to: JointName; radius: number }[] = [
  { from: "pelvis", to: "chest", radius: 0.115 },
  { from: "chest", to: "neck", radius: 0.075 },
  { from: "chest", to: "shoulderL", radius: 0.07 },
  { from: "chest", to: "shoulderR", radius: 0.07 },
  { from: "shoulderL", to: "elbowL", radius: 0.055 },
  { from: "shoulderR", to: "elbowR", radius: 0.055 },
  { from: "elbowL", to: "wristL", radius: 0.05 },
  { from: "elbowR", to: "wristR", radius: 0.05 },
  { from: "pelvis", to: "hipL", radius: 0.075 },
  { from: "pelvis", to: "hipR", radius: 0.075 },
  { from: "hipL", to: "kneeL", radius: 0.075 },
  { from: "hipR", to: "kneeR", radius: 0.075 },
  { from: "kneeL", to: "ankleL", radius: 0.055 },
  { from: "kneeR", to: "ankleR", radius: 0.055 },
];

export const HEAD_RADIUS = 0.13;
export const GLOVE_RADIUS = 0.085;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Hareket eğrileri. Doğrusal ilerleme robot gibi duruyordu: gerçek bir yumruk
 * yavaş yüklenip patlayarak açılır, geri çekilme ise hızlı başlayıp yavaşlar.
 * Eğriler uçları (0 ve 1) korur, bu yüzden zaman çizelgesini kaydırmaz.
 */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInQuart(t: number): number {
  return t ** 4;
}

function easeOutBack(t: number): number {
  // Hafif "geri sekme" — vuruş sonrası omuz bir tık fazla geri gidip yerleşir.
  const c1 = 1.7;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function lerpPoint(a: Point3, b: Point3, t: number): Point3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function lerpPose(a: RigPose, b: RigPose, t: number): RigPose {
  const factor = clamp01(t);
  const out = {} as RigPose;
  for (const joint of JOINT_NAMES) out[joint] = lerpPoint(a[joint], b[joint], factor);
  return out;
}

function withOverrides(base: RigPose, overrides: Partial<RigPose>): RigPose {
  return { ...base, ...overrides };
}

/** Vuruş öncesi yüklenme: omuz geri, ağırlık arka ayağa. */
function telegraphPose(side: AttackSide): RigPose {
  if (side === "center") {
    // Kroşe/overhand yüklenmesi — gövde yana yatar, vuran kol dışarı açılır.
    return withOverrides(GUARD_POSE, {
      chest: point(-0.05, 0.39, -0.04),
      head: point(-0.06, 0.71, -0.02),
      elbowR: point(-0.33, 0.3, 0.02),
      wristR: point(-0.24, 0.6, 0.1),
    });
  }
  const sign = side === "left" ? 1 : -1;
  const shoulder = point(0.24 * sign, 0.47, -0.06);
  const elbow = point(0.3 * sign, 0.26, -0.02);
  const wrist = point(0.19 * sign, 0.56, 0.08);
  const torso = {
    chest: point(-0.04 * sign, 0.39, -0.05),
    head: point(-0.05 * sign, 0.71, -0.03),
  };
  return side === "left"
    ? withOverrides(GUARD_POSE, { ...torso, shoulderL: shoulder, elbowL: elbow, wristL: wrist })
    : withOverrides(GUARD_POSE, { ...torso, shoulderR: shoulder, elbowR: elbow, wristR: wrist });
}

/** Yumruk tam uzanmış: eldiven kameraya doğru gelir (+z büyür). */
function extendedPose(side: AttackSide): RigPose {
  if (side === "center") {
    return withOverrides(GUARD_POSE, {
      chest: point(0.05, 0.4, 0.06),
      head: point(0.05, 0.7, 0.08),
      elbowR: point(-0.12, 0.42, 0.34),
      wristR: point(0.06, 0.5, 0.62),
    });
  }
  const sign = side === "left" ? 1 : -1;
  const shoulder = point(0.17 * sign, 0.5, 0.14);
  const elbow = point(0.14 * sign, 0.5, 0.4);
  const wrist = point(0.06 * sign, 0.52, 0.72);
  const torso = {
    chest: point(0.05 * sign, 0.41, 0.07),
    head: point(0.04 * sign, 0.71, 0.09),
  };
  return side === "left"
    ? withOverrides(GUARD_POSE, { ...torso, shoulderL: shoulder, elbowL: elbow, wristL: wrist })
    : withOverrides(GUARD_POSE, { ...torso, shoulderR: shoulder, elbowR: elbow, wristR: wrist });
}

/** Sporcu yetişti: rakip geri çekilir, gard kapanır. */
const BEATEN_POSE: RigPose = withOverrides(GUARD_POSE, {
  pelvis: point(0, -0.03, -0.18),
  chest: point(0, 0.36, -0.2),
  head: point(0, 0.68, -0.22),
  wristL: point(0.11, 0.62, 0.1),
  wristR: point(-0.11, 0.62, 0.1),
  elbowL: point(0.2, 0.3, 0.06),
  elbowR: point(-0.2, 0.3, 0.06),
});

/** Kontra isabet etti: baş yana savrulur, gard açılır. */
const HURT_POSE: RigPose = withOverrides(GUARD_POSE, {
  pelvis: point(-0.05, -0.06, -0.24),
  chest: point(-0.11, 0.33, -0.26),
  head: point(-0.2, 0.62, -0.3),
  neck: point(-0.09, 0.5, -0.26),
  wristL: point(0.2, 0.36, 0.12),
  wristR: point(-0.28, 0.34, 0.05),
  elbowL: point(0.29, 0.16, 0.06),
  elbowR: point(-0.33, 0.14, 0.02),
});

/**
 * Bir eylemin `progress` (0→1) anındaki pozu.
 *
 * IDLE dışındaki eylemler tek yönlüdür: TELEGRAPH guard'dan yüklenmeye,
 * COMMIT yüklenmeden tam uzanmaya gider. Böylece sporcu rakibin hareketini
 * ekranda GÖREREK okuyabiliyor — oyunun tepki testinden farkı bu.
 */
export function opponentPose(
  action: OpponentAction,
  progress: number,
  side: AttackSide,
  timeMs = 0,
): RigPose {
  const t = clamp01(progress);
  switch (action) {
    case "TELEGRAPH":
      // Yüklenme hızlı başlar, sonra bekler: sporcunun okuması gereken an bu.
      return lerpPose(idlePose(timeMs), telegraphPose(side), easeOutCubic(t));
    case "COMMIT":
      // Yumruk patlar: son çeyrekte mesafenin çoğu kapanır.
      return lerpPose(telegraphPose(side), extendedPose(side), easeInQuart(t));
    case "LAND":
      // Vuruş indi, kol hızlı toparlanır.
      return lerpPose(extendedPose(side), idlePose(timeMs), easeOutCubic(t));
    case "BEATEN":
      return lerpPose(telegraphPose(side), BEATEN_POSE, easeOutBack(t));
    case "HURT":
      return lerpPose(HURT_POSE, idlePose(timeMs), easeOutCubic(t));
    case "IDLE":
    default:
      return idlePose(timeMs);
  }
}

/**
 * Nötr salınım. Tek bir sinüs "yukarı-aşağı zıplayan mankene" benziyordu;
 * gerçek bir boksör aynı anda üç ayrı ritim taşır:
 *   • ring ritmi   — kalçadan gelen hafif diz salınımı (en baskın)
 *   • nefes        — göğsün yavaş inip kalkması
 *   • gard titremesi — ellerin küçük, hızlı, bağımsız oynaması
 * Frekanslar birbirinin katı DEĞİL, böylece döngü gözle yakalanamıyor.
 */
export function idlePose(timeMs: number): RigPose {
  const bounce = Math.sin(timeMs / 340) * 0.02;
  const sway = Math.sin(timeMs / 780) * 0.016;
  const breath = Math.sin(timeMs / 1_150) * 0.012;
  const guardJitterX = Math.sin(timeMs / 210) * 0.008;
  const guardJitterY = Math.cos(timeMs / 260) * 0.009;

  const pose = {} as RigPose;
  for (const joint of JOINT_NAMES) {
    const base = GUARD_POSE[joint];
    // Ağırlık aktarımı yukarı doğru azalarak yayılır: ayaklar neredeyse sabit,
    // baş en çok salınan yer.
    const height = (base.y + 0.9) / 1.7;
    const isHand = joint === "wristL" || joint === "wristR";
    const isChest = joint === "chest" || joint === "shoulderL" || joint === "shoulderR";
    pose[joint] = {
      x: base.x + sway * height + (isHand ? guardJitterX : 0),
      y:
        base.y +
        bounce * height +
        (isChest ? breath : 0) +
        (isHand ? guardJitterY : 0),
      z: base.z + (isChest ? breath * 0.5 : 0),
    };
  }
  return pose;
}

// ── Perspektif izdüşümü ───────────────────────────────────────

export type RigCamera = {
  /** Kameranın rig uzayındaki konumu. */
  eye: Point3;
  /** Odak uzaklığı (canvas pikseli cinsinden ölçek). */
  focalLength: number;
};

/**
 * Varsayılan kamera. Odak ve yükseklik, TÜM gövdenin (ayaklar dâhil) kadraja
 * sığacağı şekilde seçildi: figür y ekseninde yaklaşık -0.98 (ayakkabı altı)
 * ile +0.85 (saç üstü) arasında duruyor, yani ~1,83 birim. Ölçek kısa kenara
 * göre hesaplandığı için 16:9 bir tuvalde bile taşma olmuyor.
 */
export const DEFAULT_RIG_CAMERA: RigCamera = {
  eye: { x: 0, y: -0.02, z: 2.6 },
  focalLength: 1.08,
};

export type Projected = { x: number; y: number; depth: number; scale: number };

/**
 * Rig noktasını canvas pikseline çevirir. `depth` kameradan uzaklık —
 * çizim sırası buna göre yapılır (uzak olan önce boyanır).
 *
 * Kameranın ARKASINA düşen noktalar (depth ≤ 0) küçük bir pozitif değere
 * kırpılır; aksi hâlde izdüşüm işaret değiştirip figürü ters çeviriyor.
 */
export function projectPoint(
  local: Point3,
  camera: RigCamera,
  canvas: { width: number; height: number },
): Projected {
  const depth = Math.max(0.05, camera.eye.z - local.z);
  const unit = Math.min(canvas.width, canvas.height);
  const scale = (camera.focalLength * unit) / depth;
  return {
    x: canvas.width / 2 + (local.x - camera.eye.x) * scale,
    y: canvas.height / 2 - (local.y - camera.eye.y) * scale,
    depth,
    scale,
  };
}

/**
 * Rakibi, ekranda verilen noktaya GÖĞSÜ gelecek şekilde konumlandıran kamera.
 *
 * Kontra kanalında sporcunun vuracağı hedef, kalibrasyondan (erişim bölgesi)
 * üretiliyor — figürü oraya oturtunca "rakibin gövdesine vur" talimatı ekranda
 * gerçekten doğru yere denk geliyor. Hedef yoksa varsayılan kamera kullanılır.
 */
export function cameraForScreenPoint(
  screen: { x: number; y: number },
  canvas: { width: number; height: number },
  base: RigCamera = DEFAULT_RIG_CAMERA,
): RigCamera {
  const unit = Math.min(canvas.width, canvas.height);
  const depth = Math.max(0.05, base.eye.z - GUARD_POSE.chest.z);
  const scale = (base.focalLength * unit) / depth;
  return {
    focalLength: base.focalLength,
    eye: {
      x: GUARD_POSE.chest.x - (screen.x - canvas.width / 2) / scale,
      y: GUARD_POSE.chest.y + (screen.y - canvas.height / 2) / scale,
      z: base.eye.z,
    },
  };
}

export type ProjectedPose = Record<JointName, Projected>;

export function projectPose(
  pose: RigPose,
  camera: RigCamera,
  canvas: { width: number; height: number },
): ProjectedPose {
  const out = {} as ProjectedPose;
  for (const joint of JOINT_NAMES) out[joint] = projectPoint(pose[joint], camera, canvas);
  return out;
}

/**
 * Uzaktan yakına sıralanmış kemik listesi — 2D canvas'ta derinlik tamponu
 * olmadığı için ressam algoritması kullanılır.
 */
export function depthSortedBones(
  projected: ProjectedPose,
): readonly { from: JointName; to: JointName; radius: number; depth: number }[] {
  return BONES.map((bone) => ({
    ...bone,
    depth: (projected[bone.from].depth + projected[bone.to].depth) / 2,
  })).sort((a, b) => b.depth - a.depth);
}
