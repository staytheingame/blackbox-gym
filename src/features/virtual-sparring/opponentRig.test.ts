import { describe, expect, it } from "vitest";
import {
  DEFAULT_RIG_CAMERA,
  cameraForScreenPoint,
  GUARD_POSE,
  JOINT_NAMES,
  depthSortedBones,
  idlePose,
  lerpPose,
  opponentPose,
  projectPoint,
  projectPose,
} from "./opponentRig";

const canvas = { width: 960, height: 540 };

describe("lerpPose", () => {
  it("uç noktalarda kaynak pozları verir", () => {
    const target = opponentPose("TELEGRAPH", 1, "left");
    expect(lerpPose(GUARD_POSE, target, 0)).toEqual(GUARD_POSE);
    expect(lerpPose(GUARD_POSE, target, 1)).toEqual(target);
  });

  it("aralık dışındaki t değerlerini kırpar", () => {
    const target = opponentPose("TELEGRAPH", 1, "left");
    expect(lerpPose(GUARD_POSE, target, -3)).toEqual(GUARD_POSE);
    expect(lerpPose(GUARD_POSE, target, 9)).toEqual(target);
  });
});

describe("opponentPose", () => {
  it("her eylemde tüm eklemleri döndürür", () => {
    for (const action of ["IDLE", "TELEGRAPH", "COMMIT", "LAND", "BEATEN", "HURT"] as const) {
      const pose = opponentPose(action, 0.5, "left", 1_000);
      expect(Object.keys(pose).sort()).toEqual([...JOINT_NAMES].sort());
    }
  });

  it("yumruk uzandıkça eldiven kameraya yaklaşır", () => {
    const start = opponentPose("COMMIT", 0, "left");
    const end = opponentPose("COMMIT", 1, "left");
    expect(end.wristL.z).toBeGreaterThan(start.wristL.z);
  });

  it("vuran el, istenen tarafa göre değişir", () => {
    const left = opponentPose("COMMIT", 1, "left");
    const right = opponentPose("COMMIT", 1, "right");
    expect(left.wristL.z).toBeGreaterThan(left.wristR.z);
    expect(right.wristR.z).toBeGreaterThan(right.wristL.z);
  });

  it("yumruk doğrusal değil, sona doğru patlayarak açılır", () => {
    const start = opponentPose("COMMIT", 0, "left").wristL.z;
    const half = opponentPose("COMMIT", 0.5, "left").wristL.z;
    const end = opponentPose("COMMIT", 1, "left").wristL.z;
    const midpoint = (start + end) / 2;
    // Yarı zamanda mesafenin yarısından ÇOK AZI kapanmış olmalı.
    expect(half).toBeLessThan(midpoint);
    expect(half - start).toBeLessThan((end - start) * 0.25);
  });

  it("yüklenme erken oturur — sporcunun okuyacağı an burası", () => {
    const quarter = opponentPose("TELEGRAPH", 0.25, "left", 0);
    const full = opponentPose("TELEGRAPH", 1, "left", 0);
    const start = opponentPose("TELEGRAPH", 0, "left", 0);
    const covered = Math.abs(quarter.shoulderL.z - start.shoulderL.z);
    const total = Math.abs(full.shoulderL.z - start.shoulderL.z);
    expect(covered).toBeGreaterThan(total * 0.4);
  });

  it("BEATEN pozunda rakip geri çekilir", () => {
    const beaten = opponentPose("BEATEN", 1, "left");
    expect(beaten.chest.z).toBeLessThan(GUARD_POSE.chest.z);
  });
});

describe("idlePose", () => {
  it("zamanla salınır ama iskeleti dağıtmaz", () => {
    const a = idlePose(0);
    const b = idlePose(600);
    expect(a.head.y).not.toBe(b.head.y);
    expect(Math.abs(b.head.y - GUARD_POSE.head.y)).toBeLessThan(0.05);
  });
});

describe("projectPoint", () => {
  it("origin çevresindeki noktayı canvas merkezine yakın koyar", () => {
    // Kameranın tam baktığı nokta her zaman merkeze düşmeli (kamera ayarları
    // değişse de geçerli olsun diye eye değerinden okunuyor).
    const projected = projectPoint(
      { x: DEFAULT_RIG_CAMERA.eye.x, y: DEFAULT_RIG_CAMERA.eye.y, z: 0 },
      DEFAULT_RIG_CAMERA,
      canvas,
    );
    expect(projected.x).toBeCloseTo(canvas.width / 2, 5);
    expect(projected.y).toBeCloseTo(canvas.height / 2, 5);
  });

  it("yakın nokta daha büyük ölçekle çizilir", () => {
    const near = projectPoint({ x: 0, y: 0, z: 0.6 }, DEFAULT_RIG_CAMERA, canvas);
    const far = projectPoint({ x: 0, y: 0, z: -0.6 }, DEFAULT_RIG_CAMERA, canvas);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.depth).toBeLessThan(far.depth);
  });

  it("kameranın arkasına düşen nokta izdüşümü ters çevirmez", () => {
    const behind = projectPoint({ x: 1, y: 0, z: 99 }, DEFAULT_RIG_CAMERA, canvas);
    expect(behind.depth).toBeGreaterThan(0);
    expect(Number.isFinite(behind.x)).toBe(true);
  });

  it("+x rig ekseni ekranda sağa gider", () => {
    const right = projectPoint({ x: 0.5, y: 0, z: 0 }, DEFAULT_RIG_CAMERA, canvas);
    expect(right.x).toBeGreaterThan(canvas.width / 2);
  });
});

describe("depthSortedBones", () => {
  it("uzaktan yakına sıralar — ressam algoritması için", () => {
    const projected = projectPose(opponentPose("COMMIT", 1, "left"), DEFAULT_RIG_CAMERA, canvas);
    const bones = depthSortedBones(projected);
    const depths = bones.map((bone) => bone.depth);
    expect(depths).toEqual([...depths].sort((a, b) => b - a));
  });
});

describe("cameraForScreenPoint", () => {
  it("rakibin göğsünü istenen ekran noktasına oturtur", () => {
    const wanted = { x: 300, y: 200 };
    const camera = cameraForScreenPoint(wanted, canvas);
    const projected = projectPose(GUARD_POSE, camera, canvas);
    expect(projected.chest.x).toBeCloseTo(wanted.x, 5);
    expect(projected.chest.y).toBeCloseTo(wanted.y, 5);
  });

  it("merkez istendiğinde varsayılana yakın kalır", () => {
    const camera = cameraForScreenPoint(
      { x: canvas.width / 2, y: canvas.height / 2 },
      canvas,
    );
    const projected = projectPose(GUARD_POSE, camera, canvas);
    expect(projected.chest.x).toBeCloseTo(canvas.width / 2, 5);
  });
});

describe("varsayılan kadraj", () => {
  it("tüm gövdeyi ayaklar dâhil kadraja sığdırır", () => {
    // Regresyon: eski kamera figürü aşağı kaydırıyordu, ayaklar tuvalin
    // altında kalıyordu.
    const wide = { width: 960, height: 540 };
    const projected = projectPose(idlePose(0), DEFAULT_RIG_CAMERA, wide);
    for (const joint of JOINT_NAMES) {
      const point = projected[joint];
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(wide.height);
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(wide.width);
    }
  });

  it("ayak bileği ile tuval altı arasında ayakkabı payı bırakır", () => {
    const wide = { width: 960, height: 540 };
    const projected = projectPose(idlePose(0), DEFAULT_RIG_CAMERA, wide);
    const lowest = Math.max(projected.ankleL.y, projected.ankleR.y);
    expect(wide.height - lowest).toBeGreaterThan(12);
  });

  it("uzanan yumrukta bile figür kadrajda kalır", () => {
    const wide = { width: 960, height: 540 };
    const projected = projectPose(opponentPose("COMMIT", 1, "left"), DEFAULT_RIG_CAMERA, wide);
    expect(projected.wristL.y).toBeGreaterThan(0);
    expect(projected.wristL.y).toBeLessThan(wide.height);
  });
});
