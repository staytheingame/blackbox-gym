import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const PUBLIC_DIR = join(process.cwd(), "public");

/** PNG başlığından genişlik/yükseklik — bir görüntü kütüphanesi gerekmez. */
function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  // 8 bayt imza + IHDR: genişlik 16., yükseklik 20. baytta (big-endian).
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("web uygulaması bildirimi (manifest)", () => {
  const data = manifest();

  it("tarayıcının kurulum için aradığı alanları taşır", () => {
    expect(data.name).toBeTruthy();
    expect(data.short_name).toBeTruthy();
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/uygulama");
    expect(data.scope).toBe("/");
  });

  it("başlangıç adresi kapsamın içinde", () => {
    expect(data.start_url?.startsWith(data.scope ?? "/")).toBe(true);
  });

  it("en az bir 192 ve bir 512 piksellik ikon tanımlar", () => {
    const sizes = (data.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("bir de maskelenebilir (maskable) ikon tanımlar", () => {
    const purposes = (data.icons ?? []).map((icon) => icon.purpose);
    expect(purposes).toContain("maskable");
  });

  it("her ikon dosyası public/ altında var ve bildirilen boyutta", () => {
    for (const icon of data.icons ?? []) {
      const file = join(PUBLIC_DIR, icon.src.replace(/^\//, ""));
      expect(existsSync(file), `${icon.src} bulunamadı`).toBe(true);

      const [width, height] = (icon.sizes ?? "").split("x").map(Number);
      expect(pngSize(file), `${icon.src} boyutu`).toEqual({ width, height });
    }
  });

  it("iPhone için apple-touch-icon 180x180", () => {
    const file = join(PUBLIC_DIR, "icons", "apple-touch-icon.png");
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)).toEqual({ width: 180, height: 180 });
  });

  it("service worker ve çevrimdışı ekran public/ altında", () => {
    expect(existsSync(join(PUBLIC_DIR, "sw.js"))).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, "cevrimdisi.html"))).toBe(true);
  });

  it("service worker kişisel veriyi önbelleğe almaz: yalnız çevrimdışı ekranı saklar", () => {
    const source = readFileSync(join(PUBLIC_DIR, "sw.js"), "utf8");
    // Önbelleğe yazan tek çağrı çevrimdışı ekran için olmalı.
    expect(source.match(/cache\.(add|addAll|put)\(/g)).toEqual(["cache.add("]);
    expect(source).toContain("OFFLINE_URL");
    // Yalnız sayfa gezintisine karışır.
    expect(source).toContain('request.mode !== "navigate"');
  });
});
