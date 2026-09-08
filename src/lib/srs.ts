/**
 * SM-2 derived scheduling, trimmed to four grades.
 *
 * Kept pure so it can be reasoned about (and tested) without a database or a
 * device: every function takes the current card state and returns the next one.
 */

export type Grade = 0 | 1 | 2 | 3; // again | hard | good | easy

export type CardState = {
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
};

export const NEW_CARD: CardState = {
  intervalDays: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
};

const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;

/** Ease moves by grade; wrong answers cost more than right answers gain. */
const EASE_DELTA: Record<Grade, number> = {
  0: -0.2,
  1: -0.15,
  2: 0,
  3: 0.15,
};

export function schedule(card: CardState, grade: Grade): CardState {
  const ease = Math.max(MIN_EASE, card.ease + EASE_DELTA[grade]);

  // A miss sends the card back to the front of the queue rather than nudging
  // its interval down — half-remembered cards are worth less than fresh ones.
  if (grade === 0) {
    return {
      intervalDays: 0,
      ease,
      reps: 0,
      lapses: card.lapses + 1,
    };
  }

  const reps = card.reps + 1;
  let intervalDays: number;

  if (reps === 1) {
    intervalDays = grade === 1 ? 0.5 : 1;
  } else if (reps === 2) {
    intervalDays = grade === 1 ? 2 : 3;
  } else {
    const multiplier = grade === 1 ? 1.2 : ease;
    intervalDays = card.intervalDays * multiplier;
  }

  return {
    intervalDays: Math.min(MAX_INTERVAL_DAYS, Math.round(intervalDays * 100) / 100),
    ease,
    reps,
    lapses: card.lapses,
  };
}

/** When a card graded now should next surface. */
export function dueAfter(card: CardState, from: Date = new Date()): Date {
  return new Date(from.getTime() + card.intervalDays * 86_400_000);
}

/** Cards with an interval under a day stay in the current session. */
export function staysInSession(card: CardState): boolean {
  return card.intervalDays < 1;
}
