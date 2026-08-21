"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/queries/audit";
import {
  accrueMonthlySalaries,
  applyRecurringExpenses,
  deleteExpense,
  deletePayment,
  payCoach,
  recordExpense,
  recordPayment,
  saveRecurringExpense,
  setRecurringExpenseActive,
} from "@/lib/queries/finance";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  normalizeExpenseCategory,
  normalizePaymentMethod,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/domain/finance/ledger";
import { formatMinorTR, parseAmountToMinor } from "@/domain/finance/money";
import {
  PERIOD_KINDS,
  periodContaining,
  shiftPeriod,
  type PeriodKind,
} from "@/domain/finance/period";
import { gymDateTimeToInstant, toGymDateKey } from "@/lib/date";

/**
 * Kasa işlemleri — hepsi **yönetici** yetkisi ister. Antrenörün kendi
 * sporcusundan tahsilat girmesi ayrı bir eylemdedir
 * (`src/app/personel/kasa/actions.ts`), çünkü orada kapsam kontrolü var.
 */

export type FinanceState = { error?: string; success?: string };

/** "2026-08-20" → salon saatiyle o günün başlangıcı. Boşsa bugün. */
function parseGymDate(raw: string | undefined | null): Date {
  const key = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toGymDateKey(new Date());
  return gymDateTimeToInstant(key, "12:00");
}

function parseMethod(raw: string | undefined | null): PaymentMethod {
  return normalizePaymentMethod(
    (PAYMENT_METHODS as readonly string[]).includes(raw ?? "") ? (raw as string) : "nakit",
  );
}

function parseCategory(raw: string | undefined | null): ExpenseCategory {
  return normalizeExpenseCategory(
    (EXPENSE_CATEGORIES as readonly string[]).includes(raw ?? "") ? (raw as string) : "diger",
  );
}

function revalidateFinance(): void {
  revalidatePath("/yonetim/muhasebe");
  revalidatePath("/yonetim/muhasebe/tahsilat");
  revalidatePath("/yonetim/muhasebe/giderler");
  revalidatePath("/yonetim/muhasebe/hakedis");
  revalidatePath("/yonetim");
  revalidatePath("/personel/kasa");
  revalidatePath("/personel/uyelikler");
}

// ── Tahsilat ──────────────────────────────────────────────────

export async function recordPaymentAction(
  _prevState: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const memberId = formData.get("memberId")?.toString() ?? "";
  if (!memberId) return { error: "Sporcu seç." };

  const amountMinor = parseAmountToMinor(formData.get("amount")?.toString() ?? "");
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Tutar geçersiz." };
  }

  const rawSubscription = formData.get("subscriptionId")?.toString() ?? "";

  const result = await recordPayment({
    organizationId: membership.organizationId,
    memberId,
    subscriptionId: rawSubscription || null,
    amountMinor,
    method: parseMethod(formData.get("method")?.toString()),
    paidAt: parseGymDate(formData.get("paidAt")?.toString()),
    note: formData.get("note")?.toString() || null,
    recordedByUserId: user.id,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "tahsilat.eklendi",
    entityType: "Payment",
    entityId: result.paymentId,
    summary: `${formatMinorTR(amountMinor)} tahsilat girildi.`,
  });

  revalidateFinance();
  return {
    success:
      result.earningMinor > 0
        ? `Tahsilat kaydedildi. Antrenör payı: ${formatMinorTR(result.earningMinor)}.`
        : "Tahsilat kaydedildi.",
  };
}

export async function deletePaymentAction(paymentId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const result = await deletePayment(membership.organizationId, paymentId);
  if (!result.ok) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "tahsilat.silindi",
    entityType: "Payment",
    entityId: paymentId,
    summary: "Tahsilat kaydı silindi; varsa antrenör payı da geri alındı.",
  });

  revalidateFinance();
}

// ── Gider ─────────────────────────────────────────────────────

export async function recordExpenseAction(
  _prevState: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const title = formData.get("title")?.toString().trim() ?? "";
  if (title.length < 2) return { error: "Gider adı gerekli." };

  const amountMinor = parseAmountToMinor(formData.get("amount")?.toString() ?? "");
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Tutar geçersiz." };
  }

  const result = await recordExpense({
    organizationId: membership.organizationId,
    category: parseCategory(formData.get("category")?.toString()),
    title,
    amountMinor,
    spentAt: parseGymDate(formData.get("spentAt")?.toString()),
    note: formData.get("note")?.toString() || null,
    recordedByUserId: user.id,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "gider.eklendi",
    entityType: "Expense",
    entityId: result.expenseId,
    summary: `${title} — ${formatMinorTR(amountMinor)} gider girildi.`,
  });

  revalidateFinance();
  return { success: "Gider kaydedildi." };
}

export async function deleteExpenseAction(expenseId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const result = await deleteExpense(membership.organizationId, expenseId);
  if (!result.ok) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "gider.silindi",
    entityType: "Expense",
    entityId: expenseId,
    summary: "Gider kaydı silindi.",
  });

  revalidateFinance();
}

// ── Sabit giderler ────────────────────────────────────────────

export async function saveRecurringExpenseAction(
  _prevState: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const title = formData.get("title")?.toString().trim() ?? "";
  if (title.length < 2) return { error: "Gider adı gerekli." };

  const amountMinor = parseAmountToMinor(formData.get("amount")?.toString() ?? "");
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Tutar geçersiz." };
  }

  const day = Number(formData.get("dayOfMonth")?.toString() ?? "1");
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return { error: "Ödeme günü 1–28 arası olmalı." };
  }

  const result = await saveRecurringExpense({
    organizationId: membership.organizationId,
    category: parseCategory(formData.get("category")?.toString()),
    title,
    amountMinor,
    dayOfMonth: day,
  });
  if (!result.ok) return { error: result.error };

  revalidateFinance();
  return { success: "Sabit gider eklendi." };
}

export async function toggleRecurringExpenseAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  await setRecurringExpenseActive(membership.organizationId, id, isActive);
  revalidateFinance();
}

/** "Bu ayın sabit giderlerini işle" — iki kez basmak ikinci kez yazmaz. */
export async function applyRecurringExpensesAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const result = await applyRecurringExpenses(
    membership.organizationId,
    user.id,
  );

  if (result.created > 0) {
    await recordAudit({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      actorLabel: user.displayName,
      action: "gider.eklendi",
      entityType: "Expense",
      summary: `${result.created} sabit gider bu ay için işlendi.`,
    });
  }

  revalidateFinance();
}

// ── Hakediş ───────────────────────────────────────────────────

/** Sabit maaşları içinde bulunulan ay için tahakkuk ettirir. */
export async function accrueSalariesAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  await accrueMonthlySalaries(membership.organizationId);
  revalidateFinance();
}

/**
 * Antrenöre dönem hakedişini öder: hakediş satırları `odendi` olur, kasaya
 * "hakediş" kaleminde gider yazılır.
 */
export async function payCoachAction(
  _prevState: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const coachUserId = formData.get("coachUserId")?.toString() ?? "";
  if (!coachUserId) return { error: "Antrenör seçilmedi." };

  // Ödenecek dönem, ekranda açık olan dönemdir — form gizli alanlarla taşır.
  const rawKind = formData.get("donem")?.toString() ?? "ay";
  const kind = (PERIOD_KINDS as readonly string[]).includes(rawKind)
    ? (rawKind as PeriodKind)
    : "ay";
  const rawOffset = Number(formData.get("kayma")?.toString() ?? "0");
  const offset = Number.isInteger(rawOffset) ? Math.min(0, rawOffset) : 0;
  const base = periodContaining(kind, new Date());
  const period = offset === 0 ? base : shiftPeriod(base, offset);

  const result = await payCoach({
    organizationId: membership.organizationId,
    coachUserId,
    period,
    paidAt: parseGymDate(formData.get("paidAt")?.toString()),
    method: parseMethod(formData.get("method")?.toString()),
    note: formData.get("note")?.toString() || null,
    recordedByUserId: user.id,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "hakedis.odendi",
    entityType: "CoachPayout",
    entityId: result.payoutId,
    summary: `${formatMinorTR(result.amountMinor)} hakediş ödendi (${result.count} kalem).`,
  });

  revalidateFinance();
  return {
    success: `${formatMinorTR(result.amountMinor)} ödendi ve gidere yazıldı.`,
  };
}
