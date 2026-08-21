import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOpponentScene, type OpponentScene } from "./opponentRenderer";
import { idlePose, opponentPose } from "./opponentRig";

/**
 * Canvas çizimini kayıt tutan sahte bir 2D bağlamla doğruluyoruz: gerçek
 * tarayıcı olmadan "figür gerçekten çiziliyor mu, hangi parçalar basılıyor,
 * hedef halkası doğru yerde mi" sorularına cevap verilebiliyor.
 */
type Call = { method: string; args: unknown[] };

function createStubCanvas(width = 960, height = 540) {
  const calls: Call[] = [];
  const gradientStops: unknown[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const gradient = {
    addColorStop: (...args: unknown[]) => {
      gradientStops.push(args);
    },
  };
  const context = {
    setTransform: record("setTransform"),
    translate: record("translate"),
    clearRect: record("clearRect"),
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    ellipse: record("ellipse"),
    quadraticCurveTo: record("quadraticCurveTo"),
    bezierCurveTo: record("bezierCurveTo"),
    roundRect: record("roundRect"),
    fill: record("fill"),
    stroke: record("stroke"),
    fillRect: record("fillRect"),
    fillText: record("fillText"),
    measureText: () => ({ width: 80 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    globalAlpha: 1,
    lineWidth: 1,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
  };

  const canvas = {
    width: 300,
    height: 150,
    getBoundingClientRect: () => ({ width, height }),
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  return { canvas, calls, gradientStops };
}

function scene(overrides: Partial<OpponentScene> = {}): OpponentScene {
  return {
    pose: idlePose(0),
    action: "IDLE",
    threat: 0,
    cueLabel: null,
    cueColor: "#f5c400",
    feedback: null,
    countdown: null,
    target: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { devicePixelRatio: 2 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderOpponentScene", () => {
  it("canvas'ı cihaz piksel oranına göre boyutlandırır", () => {
    const { canvas } = createStubCanvas(960, 540);
    const size = renderOpponentScene(canvas, scene());
    expect(size).toEqual({ width: 960, height: 540 });
    expect(canvas.width).toBe(1_920);
    expect(canvas.height).toBe(1_080);
  });

  it("gövde, uzuvlar, kafa, eldiven ve ayakkabıları çizer", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(canvas, scene());
    const fills = calls.filter((call) => call.method === "fill").length;
    // 8 uzuv + gövde + şort + boyun + kafa + saç + 2×(bant, eldiven, başparmak)
    // + 2 ayakkabı + zemin gölgesi — parça sayısı 20'nin üstünde olmalı.
    expect(fills).toBeGreaterThan(20);
    // Gövde düz dörtgen değil: eğrisel kenarlar kullanılıyor.
    expect(calls.some((call) => call.method === "bezierCurveTo")).toBe(true);
    expect(calls.some((call) => call.method === "quadraticCurveTo")).toBe(true);
  });

  it("hacim için ışık gradyanları üretir", () => {
    const { canvas, gradientStops } = createStubCanvas();
    renderOpponentScene(canvas, scene());
    expect(gradientStops.length).toBeGreaterThan(10);
  });

  it("kafa küçükken yüz detayı çizilmez", () => {
    const big = createStubCanvas(1_600, 900);
    const small = createStubCanvas(120, 70);
    renderOpponentScene(big.canvas, scene());
    renderOpponentScene(small.canvas, scene());
    expect(big.calls.length).toBeGreaterThan(small.calls.length);
  });

  it("hedef halkası verilen ekran noktasına çizilir", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(canvas, scene({ target: { x: 400, y: 220, radius: 55 } }));
    const ring = calls.find(
      (call) => call.method === "arc" && call.args[0] === 400 && call.args[1] === 220,
    );
    expect(ring?.args[2]).toBe(55);
  });

  it("komut metni verilmezse cue kutusu basılmaz", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(canvas, scene());
    expect(calls.some((call) => call.method === "fillText")).toBe(false);
  });

  it("komut, geri bildirim ve geri sayım metinleri basılır", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(
      canvas,
      scene({
        cueLabel: "SOLA SLIP",
        feedback: { text: "TEMİZ", tone: "hit" },
        countdown: 2,
      }),
    );
    const texts = calls.filter((call) => call.method === "fillText").map((call) => call.args[0]);
    expect(texts).toContain("SOLA SLIP");
    expect(texts).toContain("TEMİZ");
    expect(texts).toContain("2");
  });

  it("geri sayım sıfırken BAŞLA yazar", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(canvas, scene({ countdown: 0 }));
    const texts = calls.filter((call) => call.method === "fillText").map((call) => call.args[0]);
    expect(texts).toContain("BAŞLA");
  });

  it("darbe anında ekran sarsılır ve kızarır", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(canvas, scene({ shake: 6, flash: 0.8 }));
    expect(calls.some((call) => call.method === "translate")).toBe(true);
    // Parlama tam ekranı kaplayan bir dikdörtgen olarak basılır.
    expect(
      calls.some(
        (call) => call.method === "fillRect" && call.args[2] === 960 && call.args[3] === 540,
      ),
    ).toBe(true);
  });

  it("sarsıntı yokken translate çağrılmaz", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(canvas, scene());
    expect(calls.some((call) => call.method === "translate")).toBe(false);
  });

  it("uzanan yumrukta figür yine eksiksiz çizilir", () => {
    const { canvas, calls } = createStubCanvas();
    renderOpponentScene(
      canvas,
      scene({ pose: opponentPose("COMMIT", 1, "left"), action: "COMMIT", threat: 1 }),
    );
    expect(calls.filter((call) => call.method === "fill").length).toBeGreaterThan(20);
  });
});
