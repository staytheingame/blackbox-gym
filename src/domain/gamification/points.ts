export type PointAction =
  | "checkin_submitted"
  | "training_logged"
  | "streak_bonus_4_weeks"
  | "high_score_bonus";

export const POINT_RULES: Record<PointAction, number> = {
  checkin_submitted: 10,
  training_logged: 5,
  streak_bonus_4_weeks: 25,
  high_score_bonus: 15,
};

export type PointEventDraft = {
  action: PointAction;
  points: number;
};

/**
 * Bir check-in gönderildiğinde verilecek puan olaylarını hesaplar.
 * Saf fonksiyon: DB'ye yazmaz, yalnızca hangi olayların oluşacağını döner.
 */
export function pointsForCheckIn(input: {
  consecutiveWeeks: number;
  overallScore: number;
}): PointEventDraft[] {
  const events: PointEventDraft[] = [
    { action: "checkin_submitted", points: POINT_RULES.checkin_submitted },
  ];

  if (input.consecutiveWeeks > 0 && input.consecutiveWeeks % 4 === 0) {
    events.push({
      action: "streak_bonus_4_weeks",
      points: POINT_RULES.streak_bonus_4_weeks,
    });
  }

  if (input.overallScore >= 85) {
    events.push({
      action: "high_score_bonus",
      points: POINT_RULES.high_score_bonus,
    });
  }

  return events;
}

export function pointsForTrainingLog(): PointEventDraft[] {
  return [{ action: "training_logged", points: POINT_RULES.training_logged }];
}
