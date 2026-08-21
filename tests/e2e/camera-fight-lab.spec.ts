import { expect, test } from "@playwright/test";

test("shows the V0.1 protocol, privacy promise and primary action", async ({ page }) => {
  await page.goto("/araclar/kamera-fight-lab");

  await expect(page.getByRole("heading", { name: /Camera Fight Lab/i })).toBeVisible();
  await expect(page.getByText(/20 TRIAL/i)).toBeVisible();
  await expect(page.getByText(/Kamera videosu yerel olarak işlenir ve yüklenmez/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Kamerayı Aç ve Teste Başla/i })).toBeVisible();
});

test("offers all Phase 1 decision modes with safety guidance", async ({ page }) => {
  await page.goto("/araclar/kamera-fight-lab");

  await expect(page.getByText(/Güvenli alan kontrolü/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Full Reaction/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Choice/i }).click();
  await expect(page.getByText(/mavi SOL, pembe SAĞ/i).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Choice/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Go \/ No-Go/i }).click();
  await expect(page.getByText(/Kırmızı DUR hedefinde hiç hareket başlatma/i)).toBeVisible();
  await page.getByRole("button", { name: /^Peripheral/i }).click();
  await expect(page.getByText(/Bakışını merkez artıda tut/i)).toBeVisible();
});

test("offers Phase 2 boxing motion modes (implementation gated on manual hardware sign-off)", async ({
  page,
}) => {
  await page.goto("/araclar/kamera-fight-lab");

  await page.getByRole("button", { name: /^Combo Speed/i }).click();
  await expect(page.getByRole("button", { name: /^Combo Speed/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText(/her yumruktan sonra eli geri çek, sonraki eli hedefe gönder/i),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Guard Return/i }).click();
  await expect(page.getByRole("button", { name: /^Guard Return/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText(/elini guard pozisyonuna geri çek ve orada sabit tut/i),
  ).toBeVisible();
});

test("offers the Phase 3 defense reflex mode (implementation gated on manual hardware sign-off)", async ({
  page,
}) => {
  await page.goto("/araclar/kamera-fight-lab");

  await page.getByRole("button", { name: /^Defense/i }).click();
  await expect(page.getByRole("button", { name: /^Defense/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText(/SOLA SLIP, SAĞA SLIP veya DUCK/i).last(),
  ).toBeVisible();
});

test("camera denial fails gracefully without a data upload", async ({ context, page }) => {
  await context.clearPermissions();
  const mutatingRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      mutatingRequests.push(request.url());
    }
  });

  await page.goto("/araclar/kamera-fight-lab");
  await page.getByRole("button", { name: /Kamerayı Aç ve Teste Başla/i }).click();

  await expect(page.getByRole("heading", { name: /Test başlatılamadı/i })).toBeVisible();
  await expect(page.getByText(/Kamera izni verilmedi/i)).toBeVisible();
  expect(mutatingRequests).toEqual([]);
});

test("offers the complete Wrestling Lab protocol catalog and safety contract", async ({ page }) => {
  await page.goto("/araclar/kamera-fight-lab");
  await page.getByRole("button", { name: "Wrestling Lab", exact: true }).click();

  await expect(page.getByRole("heading", { name: /BlackBox Wrestling Lab/i })).toBeVisible();
  await expect(page.getByText(/Güvenli alan kontrolü/i)).toBeVisible();
  await expect(page.getByText(/Kamera videosu yerel olarak işlenir ve yüklenmez/i)).toBeVisible();
  for (const accessibleName of [
    "W1 Shot Reaction",
    "W2 Sprawl",
    "W3 Wrestling Choice",
    "W4 Fake / Real",
    "W5 Movement",
    "W6 Stance",
    "W7 Hand Fighting",
    "W8 Chain",
    "W9 Scramble",
    "W10 Fatigue",
    "W11 Virtual",
    "W12 Opponent Reading",
    "Benchmark Weekly Benchmark",
    "Custom Coach Test",
  ]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${accessibleName}`, "i") }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: /^Custom Coach Test/i }).click();
  await expect(page.getByText(/Custom Coach Test ayrı config hash/i)).toBeVisible();
});

test("Wrestling camera denial stays local and fails safely", async ({ context, page }) => {
  await context.clearPermissions();
  const mutatingRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) mutatingRequests.push(request.url());
  });

  await page.goto("/araclar/kamera-fight-lab");
  await page.getByRole("button", { name: "Wrestling Lab", exact: true }).click();
  await page.getByRole("button", { name: /Kamerayı Aç ve Wrestling Testine Başla/i }).click();

  await expect(page.getByRole("heading", { name: /Test başlatılamadı/i })).toBeVisible();
  await expect(page.getByText(/Kamera izni verilmedi/i)).toBeVisible();
  expect(mutatingRequests).toEqual([]);
});
