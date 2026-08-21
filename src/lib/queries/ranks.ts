import "server-only";
import { prisma } from "@/lib/db";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import {
  evaluateRankProgress,
  nextRankAfter,
  weeksBetween,
  type RankProgress,
  type RequirementKind,
  type RequirementState,
} from "@/domain/rank/progress";

/**
 * Kuşak/derece merdiveni — veri erişimi. Karar mantığı
 * `src/domain/rank/progress.ts` içinde, burada yalnız okuma/yazma var.
 *
 * "Hazır" hesabı iki sayaca dayanır:
 *   - **ders**: yoklaması "katıldı" işaretlenmiş rezervasyonlar,
 *   - **süre**: son terfiden bu yana geçen hafta (hiç terfi yoksa kayıt yaşı).
 */

export type RankRequirementView = {
  id: string;
  position: number;
  kind: RequirementKind;
  label: string;
  techniqueSlug: string | null;
  notes: string | null;
};

export type RankView = {
  id: string;
  order: number;
  name: string;
  slug: string;
  color: string;
  summary: string | null;
  minSessions: number;
  minWeeks: number;
  isActive: boolean;
  requirements: RankRequirementView[];
  /** Bu kuşağa sahip sporcu sayısı (terfi kaydı olan). */
  awardCount: number;
};

const rankInclude = {
  requirements: { orderBy: { position: "asc" } },
  _count: { select: { awards: true } },
} as const;

function toRankView(row: {
  id: string;
  order: number;
  name: string;
  slug: string;
  color: string;
  summary: string | null;
  minSessions: number;
  minWeeks: number;
  isActive: boolean;
  requirements: {
    id: string;
    position: number;
    kind: string;
    label: string;
    techniqueSlug: string | null;
    notes: string | null;
  }[];
  _count: { awards: number };
}): RankView {
  return {
    id: row.id,
    order: row.order,
    name: row.name,
    slug: row.slug,
    color: row.color,
    summary: row.summary,
    minSessions: row.minSessions,
    minWeeks: row.minWeeks,
    isActive: row.isActive,
    awardCount: row._count.awards,
    requirements: row.requirements.map((item) => ({
      id: item.id,
      position: item.position,
      kind: item.kind as RequirementKind,
      label: item.label,
      techniqueSlug: item.techniqueSlug,
      notes: item.notes,
    })),
  };
}

/** Salonun kuşak merdiveni — sıraya göre, pasifler dahil. */
export async function listRanks(organizationId: string): Promise<RankView[]> {
  const rows = await prisma.rank.findMany({
    where: { organizationId },
    orderBy: { order: "asc" },
    include: rankInclude,
  });
  return rows.map(toRankView);
}

// ── Sporcunun durumu ──────────────────────────────────────────

export type MemberRankState = {
  memberId: string;
  memberName: string;
  memberNo: string;
  currentRank: RankView | null;
  nextRank: RankView | null;
  progress: RankProgress | null;
  /** Sonraki kuşağın maddeleri + işaretli olup olmadığı. */
  requirements: (RankRequirementView & { done: boolean; checkedAt: Date | null })[];
  history: { rankId: string; rankName: string; color: string; awardedAt: Date; note: string | null }[];
  attendedSessions: number;
  lastAwardAt: Date | null;
};

async function attendedSessionCount(memberId: string): Promise<number> {
  return prisma.slotBooking.count({ where: { memberId, status: "katildi" } });
}

/**
 * Tek sporcunun kuşak durumu. `nextRank` yoksa (merdivenin sonu) `progress`
 * de `null` döner — gösterilecek hedef kalmamıştır.
 */
export async function getMemberRankState(
  memberId: string,
  organizationId: string,
): Promise<MemberRankState | null> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, fullName: true, memberNo: true, createdAt: true },
  });
  if (!member) return null;

  const [ladder, awards, checks, attendedSessions] = await Promise.all([
    listRanks(organizationId),
    prisma.memberRank.findMany({
      where: { memberId },
      orderBy: { awardedAt: "desc" },
      include: { rank: { select: { id: true, name: true, color: true, order: true } } },
    }),
    prisma.requirementCheck.findMany({
      where: { memberId },
      select: { requirementId: true, checkedAt: true },
    }),
    attendedSessionCount(memberId),
  ]);

  // Güncel kuşak = merdivende en YÜKSEK sırada olan terfi (tarih değil sıra;
  // antrenör geçmişe dönük bir kuşağı sonradan işaretleyebilir).
  const currentAward = [...awards].sort((a, b) => b.rank.order - a.rank.order)[0];
  const currentRank =
    ladder.find((rank) => rank.id === currentAward?.rank.id) ?? null;

  const nextRank = nextRankAfter(ladder, currentRank?.order ?? null);

  const checkMap = new Map(checks.map((row) => [row.requirementId, row.checkedAt]));
  const requirements = (nextRank?.requirements ?? []).map((item) => ({
    ...item,
    done: checkMap.has(item.id),
    checkedAt: checkMap.get(item.id) ?? null,
  }));

  const lastAwardAt = awards.length > 0 ? awards[0].awardedAt : null;

  const progress = nextRank
    ? evaluateRankProgress({
        gate: { minSessions: nextRank.minSessions, minWeeks: nextRank.minWeeks },
        requirements: requirements.map(
          (item): RequirementState => ({
            id: item.id,
            kind: item.kind,
            label: item.label,
            done: item.done,
          }),
        ),
        attendedSessions,
        weeksSinceLastAward: weeksBetween(
          lastAwardAt ?? member.createdAt,
          new Date(),
        ),
      })
    : null;

  return {
    memberId: member.id,
    memberName: member.fullName,
    memberNo: member.memberNo,
    currentRank,
    nextRank,
    progress,
    requirements,
    attendedSessions,
    lastAwardAt,
    history: awards.map((award) => ({
      rankId: award.rank.id,
      rankName: award.rank.name,
      color: award.rank.color,
      awardedAt: award.awardedAt,
      note: award.note,
    })),
  };
}

export type RankBoardRow = {
  memberId: string;
  memberName: string;
  memberNo: string;
  currentRankName: string | null;
  currentRankColor: string | null;
  nextRankName: string | null;
  nextRankId: string | null;
  percent: number;
  ready: boolean;
  missing: string[];
};

/**
 * Salon geneli kuşak tablosu. Sporcu başına ayrı sorgu atmamak için
 * (N+1) yoklama sayıları ve işaretler toplu okunur.
 */
export async function listRankBoard(
  scope: StaffScope,
): Promise<RankBoardRow[]> {
  const [members, ladder] = await Promise.all([
    prisma.member.findMany({
      where: memberWhere(scope, { status: { in: ["active", "lead"] } }),
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberNo: true, createdAt: true },
    }),
    listRanks(scope.organizationId),
  ]);
  if (members.length === 0) return [];

  const memberIds = members.map((member) => member.id);

  const [awards, checks, attendance] = await Promise.all([
    prisma.memberRank.findMany({
      where: { memberId: { in: memberIds } },
      include: { rank: { select: { id: true, order: true } } },
    }),
    prisma.requirementCheck.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, requirementId: true },
    }),
    prisma.slotBooking.groupBy({
      by: ["memberId"],
      where: { memberId: { in: memberIds }, status: "katildi" },
      _count: { _all: true },
    }),
  ]);

  const attendanceMap = new Map(
    attendance.map((row) => [row.memberId, row._count._all]),
  );
  const checksByMember = new Map<string, Set<string>>();
  for (const check of checks) {
    const set = checksByMember.get(check.memberId) ?? new Set<string>();
    set.add(check.requirementId);
    checksByMember.set(check.memberId, set);
  }

  return members.map((member) => {
    const own = awards
      .filter((award) => award.memberId === member.id)
      .sort((a, b) => b.rank.order - a.rank.order);
    const currentRank = ladder.find((rank) => rank.id === own[0]?.rank.id) ?? null;
    const nextRank = nextRankAfter(ladder, currentRank?.order ?? null);

    if (!nextRank) {
      return {
        memberId: member.id,
        memberName: member.fullName,
        memberNo: member.memberNo,
        currentRankName: currentRank?.name ?? null,
        currentRankColor: currentRank?.color ?? null,
        nextRankName: null,
        nextRankId: null,
        percent: 100,
        ready: false,
        missing: [],
      };
    }

    const done = checksByMember.get(member.id) ?? new Set<string>();
    const lastAwardAt = own.length
      ? own.reduce(
          (latest, award) =>
            award.awardedAt > latest ? award.awardedAt : latest,
          own[0].awardedAt,
        )
      : null;

    const progress = evaluateRankProgress({
      gate: { minSessions: nextRank.minSessions, minWeeks: nextRank.minWeeks },
      requirements: nextRank.requirements.map(
        (item): RequirementState => ({
          id: item.id,
          kind: item.kind,
          label: item.label,
          done: done.has(item.id),
        }),
      ),
      attendedSessions: attendanceMap.get(member.id) ?? 0,
      weeksSinceLastAward: weeksBetween(
        lastAwardAt ?? member.createdAt,
        new Date(),
      ),
    });

    return {
      memberId: member.id,
      memberName: member.fullName,
      memberNo: member.memberNo,
      currentRankName: currentRank?.name ?? null,
      currentRankColor: currentRank?.color ?? null,
      nextRankName: nextRank.name,
      nextRankId: nextRank.id,
      percent: progress.percent,
      ready: progress.ready,
      missing: progress.missing,
    };
  });
}

// ── Yazma ─────────────────────────────────────────────────────

/**
 * Terfi verir. Aynı kuşak ikinci kez verilmez (`memberId + rankId` benzersiz);
 * kayıt append-only, geri alma ayrı bir işlemdir.
 */
export async function awardRank(input: {
  memberId: string;
  rankId: string;
  awardedByUserId: string;
  note?: string;
}): Promise<{ ok: true; rankName: string } | { ok: false; error: string }> {
  const rank = await prisma.rank.findUnique({ where: { id: input.rankId } });
  if (!rank) return { ok: false, error: "Kuşak bulunamadı." };

  const existing = await prisma.memberRank.findUnique({
    where: { memberId_rankId: { memberId: input.memberId, rankId: input.rankId } },
  });
  if (existing) return { ok: false, error: "Bu kuşak zaten verilmiş." };

  await prisma.memberRank.create({
    data: {
      memberId: input.memberId,
      rankId: input.rankId,
      awardedByUserId: input.awardedByUserId,
      note: input.note,
    },
  });

  return { ok: true, rankName: rank.name };
}

/** Yanlış verilen terfiyi geri alır — kuşak merdiveni bir basamak iner. */
export async function revokeRank(
  memberId: string,
  rankId: string,
): Promise<void> {
  await prisma.memberRank.deleteMany({ where: { memberId, rankId } });
}

/** Müfredat maddesini işaretler/kaldırır; döndürdüğü değer yeni durumdur. */
export async function toggleRequirementCheck(input: {
  memberId: string;
  requirementId: string;
  checkedByUserId: string;
}): Promise<boolean> {
  const existing = await prisma.requirementCheck.findUnique({
    where: {
      memberId_requirementId: {
        memberId: input.memberId,
        requirementId: input.requirementId,
      },
    },
  });

  if (existing) {
    await prisma.requirementCheck.delete({ where: { id: existing.id } });
    return false;
  }

  await prisma.requirementCheck.create({
    data: {
      memberId: input.memberId,
      requirementId: input.requirementId,
      checkedByUserId: input.checkedByUserId,
    },
  });
  return true;
}

function slugify(value: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return value
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Merdivene yeni basamak ekler; sıra verilmezse sona eklenir. */
export async function createRank(input: {
  organizationId: string;
  name: string;
  color: string;
  minSessions: number;
  minWeeks: number;
  summary?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const slug = slugify(input.name);
  if (!slug) return { ok: false, error: "Kuşak adı geçersiz." };

  const clash = await prisma.rank.findUnique({
    where: { organizationId_slug: { organizationId: input.organizationId, slug } },
  });
  if (clash) return { ok: false, error: "Bu adda bir kuşak zaten var." };

  const last = await prisma.rank.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const rank = await prisma.rank.create({
    data: {
      organizationId: input.organizationId,
      slug,
      order: (last?.order ?? -1) + 1,
      name: input.name,
      color: input.color,
      minSessions: input.minSessions,
      minWeeks: input.minWeeks,
      summary: input.summary,
    },
  });

  return { ok: true, id: rank.id };
}

export async function addRequirement(input: {
  rankId: string;
  kind: RequirementKind;
  label: string;
  techniqueSlug?: string;
  notes?: string;
}): Promise<void> {
  const last = await prisma.rankRequirement.findFirst({
    where: { rankId: input.rankId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.rankRequirement.create({
    data: {
      rankId: input.rankId,
      position: (last?.position ?? 0) + 1,
      kind: input.kind,
      label: input.label,
      techniqueSlug: input.techniqueSlug,
      notes: input.notes,
    },
  });
}

export async function deleteRequirement(requirementId: string): Promise<void> {
  await prisma.rankRequirement.delete({ where: { id: requirementId } });
}

export async function findRankInOrganization(
  rankId: string,
  organizationId: string,
) {
  return prisma.rank.findFirst({ where: { id: rankId, organizationId } });
}

export async function findRequirementInOrganization(
  requirementId: string,
  organizationId: string,
) {
  return prisma.rankRequirement.findFirst({
    where: { id: requirementId, rank: { organizationId } },
    include: { rank: { select: { id: true, name: true } } },
  });
}

/** Menü rozeti: terfiye hazır sporcu sayısı. */
export async function countRankReady(scope: StaffScope): Promise<number> {
  const board = await listRankBoard(scope);
  return board.filter((row) => row.ready).length;
}
