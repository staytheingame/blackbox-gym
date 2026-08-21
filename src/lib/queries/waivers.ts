import "server-only";
import { prisma } from "@/lib/db";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import {
  healthNoteFrom,
  summarizeWaivers,
  type SignatureRef,
  type WaiverKind,
  type WaiverSummary,
  type WaiverTemplateRef,
} from "@/domain/waivers/status";

/**
 * Onam & sağlık beyanı — veri erişimi. Karar mantığı
 * `src/domain/waivers/status.ts` içinde.
 *
 * İmza kaydı **silinmez**: metin güncellenip sürüm artınca eski imza
 * "eski" görünür, yenisi ayrı satır olarak yazılır. Böylece "o tarihte
 * hangi metni onayladı" sorusu her zaman yanıtlanabilir.
 */

export type WaiverTemplateView = WaiverTemplateRef & {
  body: string;
  questions: string[];
  isActive: boolean;
  signedCount: number;
};

function parseQuestions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string") : [];
  } catch {
    return [];
  }
}

export async function listWaiverTemplates(
  organizationId: string,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<WaiverTemplateView[]> {
  const rows = await prisma.waiverTemplate.findMany({
    where: {
      organizationId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isRequired: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { signatures: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as WaiverKind,
    title: row.title,
    version: row.version,
    isRequired: row.isRequired,
    requiresGuardian: row.requiresGuardian,
    body: row.body,
    questions: parseQuestions(row.questionsJson),
    isActive: row.isActive,
    signedCount: row._count.signatures,
  }));
}

export type MemberWaiverView = WaiverSummary & {
  templates: WaiverTemplateView[];
  /** İmzalanmış kayıtlar — sporcunun "neyi ne zaman onayladım" dökümü. */
  signatures: {
    id: string;
    templateId: string;
    title: string;
    version: number;
    signedName: string;
    signedAt: Date;
    healthNote: string | null;
  }[];
};

/** Bir sporcunun onam tablosu: hangi form imzalı, hangisi eksik/eski. */
export async function getMemberWaivers(
  memberId: string,
  organizationId: string,
): Promise<MemberWaiverView> {
  const [templates, signatures] = await Promise.all([
    listWaiverTemplates(organizationId),
    prisma.memberWaiver.findMany({
      where: { memberId },
      orderBy: { signedAt: "desc" },
      include: { template: { select: { title: true } } },
    }),
  ]);

  const summary = summarizeWaivers({
    templates,
    signatures: signatures.map(
      (row): SignatureRef => ({
        templateId: row.templateId,
        version: row.version,
        status: row.status,
        signedAt: row.signedAt,
      }),
    ),
  });

  return {
    ...summary,
    templates,
    signatures: signatures
      .filter((row) => row.status === "imzalandi")
      .map((row) => ({
        id: row.id,
        templateId: row.templateId,
        title: row.template.title,
        version: row.version,
        signedName: row.signedName,
        signedAt: row.signedAt,
        healthNote: row.healthNote,
      })),
  };
}

export type WaiverBoardRow = {
  memberId: string;
  memberName: string;
  memberNo: string;
  missingCount: number;
  outdatedCount: number;
  pendingCount: number;
  /** Sağlık beyanında "evet" işaretlenen maddeler — antrenör görsün. */
  healthNotes: string[];
};

/**
 * Salon geneli onam tablosu — kimin imzası eksik. Sporcu başına ayrı
 * sorgu yok: şablonlar bir kez, imzalar tek seferde okunur.
 */
export async function listWaiverBoard(
  scope: StaffScope,
): Promise<WaiverBoardRow[]> {
  const [templates, members] = await Promise.all([
    listWaiverTemplates(scope.organizationId),
    prisma.member.findMany({
      where: memberWhere(scope, { status: { in: ["active", "lead"] } }),
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberNo: true },
    }),
  ]);
  if (members.length === 0) return [];

  const signatures = await prisma.memberWaiver.findMany({
    where: { memberId: { in: members.map((member) => member.id) } },
    select: {
      memberId: true,
      templateId: true,
      version: true,
      status: true,
      signedAt: true,
      healthNote: true,
    },
  });

  return members.map((member) => {
    const own = signatures.filter((row) => row.memberId === member.id);
    const summary = summarizeWaivers({ templates, signatures: own });

    return {
      memberId: member.id,
      memberName: member.fullName,
      memberNo: member.memberNo,
      missingCount: summary.missingCount,
      outdatedCount: summary.outdatedCount,
      pendingCount: summary.pendingCount,
      healthNotes: own
        .filter((row) => row.status === "imzalandi" && row.healthNote)
        .map((row) => row.healthNote as string),
    };
  });
}

/** Menü rozeti: imzası eksik/eski sporcu sayısı. */
export async function countMembersWithPendingWaivers(
  scope: StaffScope,
): Promise<number> {
  const board = await listWaiverBoard(scope);
  return board.filter((row) => row.pendingCount > 0).length;
}

/** Sporcunun kendi bekleyen imza sayısı — üye menüsündeki rozet. */
export async function countPendingWaiversForMember(
  memberId: string,
  organizationId: string,
): Promise<number> {
  const summary = await getMemberWaivers(memberId, organizationId);
  return summary.pendingCount;
}

// ── Yazma ─────────────────────────────────────────────────────

export type SignWaiverInput = {
  memberId: string;
  templateId: string;
  signedName: string;
  birthDate?: Date | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  answers?: Record<string, string>;
};

export type SignWaiverResult =
  | { ok: true; version: number; healthNote: string | null }
  | { ok: false; error: string };

/**
 * İmza yazar. Aynı sporcu aynı şablonun aynı sürümünü ikinci kez
 * imzalayamaz (benzersiz kısıt); sürüm arttıysa yeni satır açılır.
 */
export async function signWaiver(
  input: SignWaiverInput,
  organizationId: string,
): Promise<SignWaiverResult> {
  const template = await prisma.waiverTemplate.findFirst({
    where: { id: input.templateId, organizationId, isActive: true },
  });
  if (!template) return { ok: false, error: "Form bulunamadı." };

  const existing = await prisma.memberWaiver.findUnique({
    where: {
      memberId_templateId_version: {
        memberId: input.memberId,
        templateId: template.id,
        version: template.version,
      },
    },
  });
  if (existing && existing.status === "imzalandi") {
    return { ok: false, error: "Bu formun güncel sürümü zaten imzalı." };
  }

  const healthNote = input.answers ? healthNoteFrom(input.answers) : null;

  await prisma.memberWaiver.upsert({
    where: {
      memberId_templateId_version: {
        memberId: input.memberId,
        templateId: template.id,
        version: template.version,
      },
    },
    update: {
      status: "imzalandi",
      signedName: input.signedName,
      signedAt: new Date(),
      birthDate: input.birthDate ?? null,
      guardianName: input.guardianName ?? null,
      guardianPhone: input.guardianPhone ?? null,
      answersJson: input.answers ? JSON.stringify(input.answers) : null,
      healthNote,
    },
    create: {
      memberId: input.memberId,
      templateId: template.id,
      version: template.version,
      signedName: input.signedName,
      birthDate: input.birthDate ?? null,
      guardianName: input.guardianName ?? null,
      guardianPhone: input.guardianPhone ?? null,
      answersJson: input.answers ? JSON.stringify(input.answers) : null,
      healthNote,
    },
  });

  return { ok: true, version: template.version, healthNote };
}

export async function createWaiverTemplate(input: {
  organizationId: string;
  kind: WaiverKind;
  title: string;
  body: string;
  questions: string[];
  requiresGuardian: boolean;
  isRequired: boolean;
}): Promise<string> {
  const template = await prisma.waiverTemplate.create({
    data: {
      organizationId: input.organizationId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      questionsJson: input.questions.length
        ? JSON.stringify(input.questions)
        : null,
      requiresGuardian: input.requiresGuardian,
      isRequired: input.isRequired,
    },
  });
  return template.id;
}

/**
 * Metni günceller ve sürümü bir artırır — mevcut imzalar "eski" olur,
 * sporculardan yeniden onay istenir. Sürüm artırmadan düzeltme yapmak
 * (yazım hatası) için `bumpVersion: false`.
 */
export async function updateWaiverTemplate(
  templateId: string,
  organizationId: string,
  input: { title: string; body: string; questions: string[]; bumpVersion: boolean },
): Promise<boolean> {
  const template = await prisma.waiverTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!template) return false;

  await prisma.waiverTemplate.update({
    where: { id: template.id },
    data: {
      title: input.title,
      body: input.body,
      questionsJson: input.questions.length
        ? JSON.stringify(input.questions)
        : null,
      version: input.bumpVersion ? template.version + 1 : template.version,
    },
  });
  return true;
}

export async function setWaiverTemplateActive(
  templateId: string,
  organizationId: string,
  isActive: boolean,
): Promise<void> {
  await prisma.waiverTemplate.updateMany({
    where: { id: templateId, organizationId },
    data: { isActive },
  });
}
