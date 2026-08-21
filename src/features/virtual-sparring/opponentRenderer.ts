/**
 * Sanal rakibin canvas'a boyanması — insansı, ışıklandırılmış figür.
 *
 * Derinlik tamponu yok: tüm parçalar (gövde, uzuvlar, kafa, eldiven, ayakkabı)
 * tek bir listede toplanıp uzaktan yakına sıralanır (ressam algoritması).
 * Böylece uzanan yumruk gövdenin ÖNÜNDE, geri çekilen kol ARKASINDA görünür —
 * sporcunun hangi elin geldiğini okuyabilmesi buna bağlı.
 *
 * IŞIK: ekran uzayında sabit bir yön (sol üstten). Her uzuv, ekseninin
 * normaline göre iki taraflı bir gradyanla boyanır; ışığa bakan kenar açık,
 * diğeri koyu. Bu, tek renk siluetten çok daha "hacimli" bir görüntü veriyor
 * ve bunun için ne 3B kütüphane ne de model dosyası gerekiyor.
 *
 * DERİNLİK SİSİ: uzaktaki parçalar zemin rengine doğru karartılır; yumruk
 * kameraya geldikçe açılır — mesafe hissini veren asıl şey bu.
 */

import {
  DEFAULT_RIG_CAMERA,
  GLOVE_RADIUS,
  HEAD_RADIUS,
  projectPose,
  type JointName,
  type OpponentAction,
  type Projected,
  type ProjectedPose,
  type RigCamera,
  type RigPose,
} from "./opponentRig";

export type SceneFeedback = {
  text: string;
  tone: "hit" | "miss" | "wrong";
} | null;

export type OpponentScene = {
  pose: RigPose;
  action: OpponentAction;
  /** 0..1 — vuruşun inmesine ne kadar kaldığı. Arttıkça figür kızarır. */
  threat: number;
  /** Ekrandaki komut metni (SOLA SLIP, SOL, SAĞ…). */
  cueLabel: string | null;
  cueColor: string;
  feedback: SceneFeedback;
  countdown: number | null;
  camera?: RigCamera;
  /** Kontra kanalında vurulacak bölge (ekran pikseli). Savunmada null. */
  target: { x: number; y: number; radius: number } | null;
  /** 0..1 darbe parlaması — rakibin vuruşu indiğinde ekran kızarır. */
  flash?: number;
  /** Piksel cinsinden kamera sarsıntısı. */
  shake?: number;
};

export type CanvasSize = { width: number; height: number };

type RGB = readonly [number, number, number];

const SKIN: RGB = [193, 138, 101];
const SKIN_SHADOW: RGB = [96, 60, 40];
const SKIN_LIGHT: RGB = [232, 186, 148];
const GLOVE: RGB = [201, 42, 42];
const GLOVE_SHADOW: RGB = [96, 16, 16];
const GLOVE_LIGHT: RGB = [242, 108, 96];
const SHORTS: RGB = [22, 27, 38];
const SHORTS_LIGHT: RGB = [58, 68, 88];
const SHOE: RGB = [26, 30, 40];
const HAIR: RGB = [26, 21, 18];
const FOG: RGB = [10, 13, 20];

/** Işığın geldiği yön (ekran uzayı, normalize). Sol üstten. */
const LIGHT: readonly [number, number] = [0.55, 0.83];

/** Bu derinlikten sonrası sise gömülmeye başlar. */
const FOG_NEAR = 2.1;
const FOG_FAR = 3.4;

function mix(a: RGB, b: RGB, t: number): RGB {
  const factor = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(a[0] + (b[0] - a[0]) * factor),
    Math.round(a[1] + (b[1] - a[1]) * factor),
    Math.round(a[2] + (b[2] - a[2]) * factor),
  ];
}

function css(color: RGB, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    : `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

/** Derinliğe göre sise karıştırma oranı. */
function fogAmount(depth: number): number {
  if (depth <= FOG_NEAR) return 0;
  return Math.min(0.55, (depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR));
}

function foggy(color: RGB, depth: number): RGB {
  return mix(color, FOG, fogAmount(depth));
}

/** Tehdit arttıkça teni kırmızıya çalan bir öfke tonuna kaydırır. */
function threatTint(color: RGB, threat: number, action: OpponentAction): RGB {
  if (action === "HURT") return mix(color, [120, 150, 190], 0.35);
  if (action === "BEATEN") return mix(color, [120, 190, 140], 0.2);
  return mix(color, [190, 60, 40], Math.max(0, Math.min(1, threat)) * 0.28);
}

function fitCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  return { width, height };
}

type Primitive = {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

/** Çizilecek uzuvlar: gövde ayrı bir kabuk olarak boyandığı için burada yok. */
const ARMS: readonly { from: JointName; to: JointName; r1: number; r2: number }[] = [
  { from: "shoulderL", to: "elbowL", r1: 0.075, r2: 0.055 },
  { from: "shoulderR", to: "elbowR", r1: 0.075, r2: 0.055 },
  { from: "elbowL", to: "wristL", r1: 0.055, r2: 0.042 },
  { from: "elbowR", to: "wristR", r1: 0.055, r2: 0.042 },
];

const LEGS: readonly { from: JointName; to: JointName; r1: number; r2: number }[] = [
  { from: "hipL", to: "kneeL", r1: 0.105, r2: 0.07 },
  { from: "hipR", to: "kneeR", r1: 0.105, r2: 0.07 },
  { from: "kneeL", to: "ankleL", r1: 0.07, r2: 0.045 },
  { from: "kneeR", to: "ankleR", r1: 0.07, r2: 0.045 },
];

export function renderOpponentScene(
  canvas: HTMLCanvasElement,
  scene: OpponentScene,
): CanvasSize {
  const size = fitCanvas(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return size;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);

  const shake = scene.shake ?? 0;
  if (shake > 0) {
    // Sarsıntı rastgele değil, deterministik bir salınım: kare atlasa bile
    // titreme tutarlı görünsün.
    ctx.translate(Math.sin(shake * 7.3) * shake, Math.cos(shake * 5.1) * shake);
  }

  const camera = scene.camera ?? DEFAULT_RIG_CAMERA;
  const projected = projectPose(scene.pose, camera, size);

  drawFloorShadow(ctx, projected, size);
  // Hedef halkası figürün ALTINA çizilir: yumruk hedefin önünden geçmeli.
  if (scene.target) drawTargetRing(ctx, scene.target, scene.cueColor);

  const primitives: Primitive[] = [];
  const tint = (color: RGB) => threatTint(color, scene.threat, scene.action);

  for (const limb of [...LEGS, ...ARMS]) {
    const a = projected[limb.from];
    const b = projected[limb.to];
    // Bacaklar şortun gölgesinde kaldığı için bir tık koyu boyanır.
    const isLeg = LEGS.includes(limb);
    const limbColor = tint(isLeg ? mix(SKIN, SKIN_SHADOW, 0.14) : SKIN);
    primitives.push({
      depth: (a.depth + b.depth) / 2,
      draw: (context) => drawLimb(context, a, b, limb.r1, limb.r2, limbColor),
    });
  }

  primitives.push({
    depth: torsoDepth(projected),
    draw: (context) => drawTorso(context, projected, tint(SKIN)),
  });
  primitives.push({
    depth: (projected.hipL.depth + projected.hipR.depth) / 2 - 0.001,
    draw: (context) => drawShorts(context, projected),
  });
  primitives.push({
    depth: projected.head.depth,
    draw: (context) => drawHead(context, projected, tint(SKIN), scene.action),
  });

  for (const [wrist, elbow] of [
    [projected.wristL, projected.elbowL],
    [projected.wristR, projected.elbowR],
  ] as const) {
    primitives.push({
      depth: wrist.depth,
      draw: (context) => drawGlove(context, wrist, elbow),
    });
  }

  for (const [ankle, knee] of [
    [projected.ankleL, projected.kneeL],
    [projected.ankleR, projected.kneeR],
  ] as const) {
    primitives.push({
      depth: ankle.depth,
      draw: (context) => drawShoe(context, ankle, knee),
    });
  }

  primitives.sort((a, b) => b.depth - a.depth);
  for (const primitive of primitives) primitive.draw(ctx);

  if (shake > 0) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (scene.flash && scene.flash > 0) drawFlash(ctx, size, scene.flash);
  if (scene.cueLabel) drawCue(ctx, size, scene.cueLabel, scene.cueColor);
  if (scene.feedback) drawFeedback(ctx, size, scene.feedback);
  if (scene.countdown !== null) drawCountdown(ctx, size, scene.countdown);

  return size;
}

function torsoDepth(projected: ProjectedPose): number {
  return (
    (projected.shoulderL.depth +
      projected.shoulderR.depth +
      projected.hipL.depth +
      projected.hipR.depth) /
    4
  );
}

function drawFloorShadow(
  ctx: CanvasRenderingContext2D,
  projected: ProjectedPose,
  size: CanvasSize,
): void {
  const ankleL = projected.ankleL;
  const ankleR = projected.ankleR;
  const centerX = (ankleL.x + ankleR.x) / 2;
  const centerY = (ankleL.y + ankleR.y) / 2;
  const width = Math.max(24, Math.abs(ankleL.x - ankleR.x) * 2.1 + size.width * 0.05);
  const gradient = ctx.createRadialGradient(centerX, centerY + 8, 1, centerX, centerY + 8, width / 2);
  gradient.addColorStop(0, "rgba(0,0,0,.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 8, width / 2, width / 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Uzuv: iki uçta farklı yarıçaplı, yuvarlak kapaklı konik kapsül. Genişlik
 * ekseni boyunca ışığa göre gradyan uygulanır — kas hacmi hissi buradan gelir.
 */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  a: Projected,
  b: Projected,
  radiusA: number,
  radiusB: number,
  base: RGB,
): void {
  const rA = Math.max(1.5, radiusA * a.scale);
  const rB = Math.max(1.5, radiusB * b.scale);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const normal = angle + Math.PI / 2;
  const nx = Math.cos(normal);
  const ny = Math.sin(normal);

  // Işık hangi kenara vuruyor? (normal ile ışık yönünün ters çarpımı)
  const facing = -(nx * LIGHT[0] + ny * LIGHT[1]);
  const depth = (a.depth + b.depth) / 2;
  const litColor = foggy(mix(base, SKIN_LIGHT, 0.55 * Math.max(0, facing) + 0.12), depth);
  const darkColor = foggy(mix(base, SKIN_SHADOW, 0.55 * Math.max(0, -facing) + 0.3), depth);

  const gradient = ctx.createLinearGradient(
    a.x + nx * rA,
    a.y + ny * rA,
    a.x - nx * rA,
    a.y - ny * rA,
  );
  gradient.addColorStop(0, css(facing >= 0 ? litColor : darkColor));
  gradient.addColorStop(0.55, css(foggy(base, depth)));
  gradient.addColorStop(1, css(facing >= 0 ? darkColor : litColor));

  // ★ Kapaklar TERS yönde taranmalı (anticlockwise = true). Saat yönünde
  //   taranırsa yay, uzvun DIŞINA taşmak yerine İÇİNE oyuluyor ve eklem
  //   yerinde delik açılıyordu — dizde gövdeyi ikiye bölen boşluk buydu.
  ctx.beginPath();
  ctx.moveTo(a.x + nx * rA, a.y + ny * rA);
  ctx.lineTo(b.x + nx * rB, b.y + ny * rB);
  ctx.arc(b.x, b.y, rB, normal, normal + Math.PI, true);
  ctx.lineTo(a.x - nx * rA, a.y - ny * rA);
  ctx.arc(a.x, a.y, rA, normal + Math.PI, normal, true);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = css(foggy(SKIN_SHADOW, depth), 0.55);
  ctx.stroke();
}

/**
 * Gövde: omuzlardan bele daralıp kalçada tekrar genişleyen bir kabuk.
 * Düz dörtgen yerine Bezier kenarlar kullanılıyor — insan silueti düz çizgili
 * değil, lat kasları omuz altından bele doğru içeri çekiliyor.
 */
function drawTorso(ctx: CanvasRenderingContext2D, p: ProjectedPose, base: RGB): void {
  const depth = torsoDepth(p);
  const shoulderSpan = Math.abs(p.shoulderL.x - p.shoulderR.x);
  const waistInset = shoulderSpan * 0.16;
  const neckY = (p.shoulderL.y + p.shoulderR.y) / 2 - shoulderSpan * 0.06;

  const leftX = p.shoulderL.x;
  const rightX = p.shoulderR.x;
  const hipLX = p.hipL.x;
  const hipRX = p.hipR.x;

  ctx.beginPath();
  ctx.moveTo(rightX, p.shoulderR.y);
  // Omuz hattı boyun üzerinden diğer omza
  ctx.quadraticCurveTo((leftX + rightX) / 2, neckY, leftX, p.shoulderL.y);
  // Sol yan: omuzdan bele (içeri), belden kalçaya (dışarı)
  ctx.bezierCurveTo(
    leftX - waistInset * Math.sign(leftX - rightX) * -1,
    (p.shoulderL.y + p.hipL.y) / 2,
    hipLX + (leftX - hipLX) * 0.15,
    p.hipL.y - shoulderSpan * 0.1,
    hipLX,
    p.hipL.y,
  );
  ctx.lineTo(hipRX, p.hipR.y);
  // Sağ yan: kalçadan omza
  ctx.bezierCurveTo(
    hipRX + (rightX - hipRX) * 0.15,
    p.hipR.y - shoulderSpan * 0.1,
    rightX - waistInset * Math.sign(rightX - leftX) * -1,
    (p.shoulderR.y + p.hipR.y) / 2,
    rightX,
    p.shoulderR.y,
  );
  ctx.closePath();

  const gradient = ctx.createLinearGradient(rightX, neckY, leftX, p.hipL.y);
  gradient.addColorStop(0, css(foggy(mix(base, SKIN_LIGHT, 0.4), depth)));
  gradient.addColorStop(0.45, css(foggy(base, depth)));
  gradient.addColorStop(1, css(foggy(mix(base, SKIN_SHADOW, 0.45), depth)));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = css(foggy(SKIN_SHADOW, depth), 0.6);
  ctx.stroke();

  // Göğüs ve karın çizgisi — kas hacmini okutan iki ince gölge.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = css(foggy(SKIN_SHADOW, depth));
  ctx.lineWidth = Math.max(1, shoulderSpan * 0.02);
  const midX = (leftX + rightX) / 2;
  const chestY = p.chest.y;
  ctx.beginPath();
  ctx.moveTo(midX, chestY - shoulderSpan * 0.12);
  ctx.lineTo(midX, (p.hipL.y + p.hipR.y) / 2 - shoulderSpan * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightX + (midX - rightX) * 0.25, chestY);
  ctx.quadraticCurveTo(midX, chestY + shoulderSpan * 0.1, leftX + (midX - leftX) * 0.25, chestY);
  ctx.stroke();
  ctx.restore();
}

function drawShorts(ctx: CanvasRenderingContext2D, p: ProjectedPose): void {
  const depth = (p.hipL.depth + p.hipR.depth) / 2;
  const span = Math.abs(p.hipL.x - p.hipR.x);
  const top = (p.hipL.y + p.hipR.y) / 2 - span * 0.5;
  const bottom = (p.kneeL.y + p.kneeR.y) / 2 - Math.abs(p.kneeL.y - p.hipL.y) * 0.35;
  const left = Math.max(p.hipL.x, p.hipR.x) + span * 0.45;
  const right = Math.min(p.hipL.x, p.hipR.x) - span * 0.45;

  ctx.beginPath();
  ctx.moveTo(right, top);
  ctx.lineTo(left, top);
  ctx.lineTo(left + (right - left) * 0.08, bottom);
  ctx.lineTo((left + right) / 2, bottom - span * 0.25);
  ctx.lineTo(right + (left - right) * 0.08, bottom);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(right, top, left, bottom);
  gradient.addColorStop(0, css(foggy(SHORTS_LIGHT, depth)));
  gradient.addColorStop(1, css(foggy(SHORTS, depth)));
  ctx.fillStyle = gradient;
  ctx.fill();

  // Bel bandı — figürü siluetten çıkarıp "kıyafetli" gösteren detay.
  ctx.fillStyle = css(foggy(GLOVE, depth));
  ctx.fillRect(Math.min(left, right), top, Math.abs(left - right), Math.max(2, span * 0.18));
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  p: ProjectedPose,
  base: RGB,
  action: OpponentAction,
): void {
  const head = p.head;
  const depth = head.depth;
  const radius = Math.max(4, HEAD_RADIUS * head.scale);

  // Boyun
  ctx.beginPath();
  ctx.moveTo(p.neck.x - radius * 0.42, p.neck.y);
  ctx.lineTo(p.neck.x + radius * 0.42, p.neck.y);
  ctx.lineTo(head.x + radius * 0.34, head.y + radius * 0.55);
  ctx.lineTo(head.x - radius * 0.34, head.y + radius * 0.55);
  ctx.closePath();
  ctx.fillStyle = css(foggy(mix(base, SKIN_SHADOW, 0.35), depth));
  ctx.fill();

  // Kafa: yukarısı yuvarlak, çene aşağı doğru daralan bir oval.
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, radius * 0.82, radius, 0, 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(
    head.x - radius * 0.38,
    head.y - radius * 0.42,
    radius * 0.12,
    head.x,
    head.y,
    radius * 1.12,
  );
  gradient.addColorStop(0, css(foggy(mix(base, SKIN_LIGHT, 0.6), depth)));
  gradient.addColorStop(0.6, css(foggy(base, depth)));
  gradient.addColorStop(1, css(foggy(mix(base, SKIN_SHADOW, 0.6), depth)));
  ctx.fillStyle = gradient;
  ctx.fill();

  // Saç kepi
  ctx.beginPath();
  ctx.ellipse(head.x, head.y - radius * 0.34, radius * 0.84, radius * 0.62, 0, Math.PI, 0);
  ctx.fillStyle = css(foggy(HAIR, depth));
  ctx.fill();

  if (radius < 13) return; // küçükken yüz detayı gürültüye dönüşüyor

  const eyeY = head.y - radius * 0.05;
  const eyeDx = radius * 0.33;
  const eyeR = Math.max(1, radius * 0.1);

  // Kaş gölgesi — bakışı "sert" gösteren asıl detay.
  ctx.strokeStyle = css(foggy(SKIN_SHADOW, depth));
  ctx.lineWidth = Math.max(1, radius * 0.11);
  ctx.beginPath();
  ctx.moveTo(head.x - eyeDx - eyeR, eyeY - radius * 0.24);
  ctx.lineTo(head.x - eyeDx + eyeR, eyeY - radius * 0.14);
  ctx.moveTo(head.x + eyeDx + eyeR, eyeY - radius * 0.24);
  ctx.lineTo(head.x + eyeDx - eyeR, eyeY - radius * 0.14);
  ctx.stroke();

  ctx.fillStyle = css(foggy([28, 24, 22], depth));
  for (const dx of [-eyeDx, eyeDx]) {
    ctx.beginPath();
    ctx.ellipse(head.x + dx, eyeY, eyeR, eyeR * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Burun gölgesi ve ağız
  ctx.strokeStyle = css(foggy(SKIN_SHADOW, depth), 0.75);
  ctx.lineWidth = Math.max(1, radius * 0.07);
  ctx.beginPath();
  ctx.moveTo(head.x, eyeY + radius * 0.06);
  ctx.lineTo(head.x - radius * 0.08, eyeY + radius * 0.32);
  ctx.stroke();

  ctx.beginPath();
  if (action === "HURT") {
    // Acı ifadesi: ağız açık.
    ctx.ellipse(head.x, eyeY + radius * 0.55, radius * 0.18, radius * 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(foggy([60, 26, 26], depth));
    ctx.fill();
  } else {
    ctx.moveTo(head.x - radius * 0.2, eyeY + radius * 0.55);
    ctx.lineTo(head.x + radius * 0.2, eyeY + radius * 0.55);
    ctx.stroke();
  }
}

/** Boks eldiveni: yumruk + başparmak yumrusu + bilek bandı. */
function drawGlove(
  ctx: CanvasRenderingContext2D,
  wrist: Projected,
  elbow: Projected,
): void {
  const depth = wrist.depth;
  const radius = Math.max(3.5, GLOVE_RADIUS * wrist.scale);
  // Eldiven, ön koldan uzaklaşacak şekilde biraz ileri kaydırılır.
  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const cx = wrist.x + ux * radius * 0.45;
  const cy = wrist.y + uy * radius * 0.45;

  // Bilek bandı
  ctx.beginPath();
  ctx.ellipse(
    wrist.x - ux * radius * 0.5,
    wrist.y - uy * radius * 0.5,
    radius * 0.62,
    radius * 0.5,
    Math.atan2(uy, ux),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = css(foggy(GLOVE_SHADOW, depth));
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 1.08, radius * 0.98, Math.atan2(uy, ux), 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(
    cx - radius * 0.4,
    cy - radius * 0.45,
    radius * 0.1,
    cx,
    cy,
    radius * 1.2,
  );
  gradient.addColorStop(0, css(foggy(GLOVE_LIGHT, depth)));
  gradient.addColorStop(0.65, css(foggy(GLOVE, depth)));
  gradient.addColorStop(1, css(foggy(GLOVE_SHADOW, depth)));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = css(foggy(GLOVE_SHADOW, depth), 0.9);
  ctx.stroke();

  // Başparmak
  ctx.beginPath();
  ctx.ellipse(
    cx - uy * radius * 0.62,
    cy + ux * radius * 0.62,
    radius * 0.42,
    radius * 0.32,
    Math.atan2(uy, ux),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = css(foggy(mix(GLOVE, GLOVE_SHADOW, 0.35), depth));
  ctx.fill();
}

function drawShoe(ctx: CanvasRenderingContext2D, ankle: Projected, knee: Projected): void {
  const depth = ankle.depth;
  const size = Math.max(3, 0.09 * ankle.scale);
  const lean = Math.sign(ankle.x - knee.x) || 1;
  ctx.beginPath();
  ctx.moveTo(ankle.x - size * 0.7, ankle.y - size * 0.5);
  ctx.lineTo(ankle.x + size * 0.7, ankle.y - size * 0.5);
  ctx.lineTo(ankle.x + size * (0.7 + lean * 0.9), ankle.y + size * 0.55);
  ctx.lineTo(ankle.x - size * (0.7 - lean * 0.9), ankle.y + size * 0.55);
  ctx.closePath();
  ctx.fillStyle = css(foggy(SHOE, depth));
  ctx.fill();
  ctx.fillStyle = css(foggy([220, 220, 226], depth), 0.85);
  ctx.fillRect(
    ankle.x - size * (0.7 + Math.max(0, -lean * 0.9)),
    ankle.y + size * 0.35,
    size * (1.4 + 0.9),
    Math.max(1, size * 0.2),
  );
}

function drawTargetRing(
  ctx: CanvasRenderingContext2D,
  target: { x: number; y: number; radius: number },
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(245,196,0,.12)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.restore();
}

/** Rakip vurduğunda ekranın kızarması — darbeyi hissettiren şey. */
function drawFlash(ctx: CanvasRenderingContext2D, size: CanvasSize, amount: number): void {
  const level = Math.max(0, Math.min(1, amount));
  ctx.save();
  const gradient = ctx.createRadialGradient(
    size.width / 2,
    size.height / 2,
    Math.min(size.width, size.height) * 0.2,
    size.width / 2,
    size.height / 2,
    Math.max(size.width, size.height) * 0.62,
  );
  gradient.addColorStop(0, `rgba(190,20,20,0)`);
  gradient.addColorStop(1, `rgba(190,20,20,${0.75 * level})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.restore();
}

function drawCue(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  label: string,
  color: string,
): void {
  const fontSize = Math.max(22, Math.round(size.width * 0.045));
  ctx.save();
  ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(label).width + fontSize * 1.4;
  const height = fontSize * 1.9;
  const x = size.width / 2;
  const y = size.height * 0.13;
  ctx.fillStyle = "rgba(0,0,0,.72)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}

function drawFeedback(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  feedback: NonNullable<SceneFeedback>,
): void {
  const color =
    feedback.tone === "hit" ? "#4ade80" : feedback.tone === "wrong" ? "#f59e0b" : "#f87171";
  const fontSize = Math.max(26, Math.round(size.width * 0.055));
  ctx.save();
  ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,.7)";
  ctx.fillRect(0, size.height * 0.44, size.width, fontSize * 1.8);
  ctx.fillStyle = color;
  ctx.fillText(feedback.text, size.width / 2, size.height * 0.44 + fontSize * 0.9);
  ctx.restore();
}

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  countdown: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0, 0, size.width, size.height);
  const fontSize = Math.round(Math.min(size.width, size.height) * 0.35);
  ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f5c400";
  ctx.fillText(countdown > 0 ? String(countdown) : "BAŞLA", size.width / 2, size.height / 2);
  ctx.restore();
}
