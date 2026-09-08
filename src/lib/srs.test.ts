import assert from "node:assert/strict";
import { test } from "node:test";

import { dueAfter, NEW_CARD, schedule, staysInSession, type CardState } from "./srs.ts";

test("a new card graded Good gets a one day interval", () => {
  const next = schedule(NEW_CARD, 2);
  assert.equal(next.intervalDays, 1);
  assert.equal(next.reps, 1);
  assert.equal(next.lapses, 0);
});

test("intervals grow across successive correct answers", () => {
  let card = NEW_CARD;
  const seen: number[] = [];

  for (let i = 0; i < 5; i++) {
    card = schedule(card, 2);
    seen.push(card.intervalDays);
  }

  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] > seen[i - 1], `interval ${seen[i]} should exceed ${seen[i - 1]}`);
  }
});

test("a miss resets the interval and counts a lapse", () => {
  const mature: CardState = { intervalDays: 40, ease: 2.5, reps: 6, lapses: 0 };
  const next = schedule(mature, 0);

  assert.equal(next.intervalDays, 0);
  assert.equal(next.reps, 0);
  assert.equal(next.lapses, 1);
  assert.ok(next.ease < mature.ease, "ease should drop after a miss");
});

test("ease never falls below the floor", () => {
  let card = NEW_CARD;
  for (let i = 0; i < 50; i++) card = schedule(card, 0);
  assert.ok(card.ease >= 1.3, `ease fell to ${card.ease}`);
});

test("intervals are capped at a year", () => {
  let card = NEW_CARD;
  for (let i = 0; i < 40; i++) card = schedule(card, 3);
  assert.ok(card.intervalDays <= 365, `interval reached ${card.intervalDays}`);
});

test("Hard advances more slowly than Good", () => {
  const start: CardState = { intervalDays: 10, ease: 2.5, reps: 3, lapses: 0 };
  assert.ok(schedule(start, 1).intervalDays < schedule(start, 2).intervalDays);
});

test("a missed card stays in the session, a learned one does not", () => {
  assert.ok(staysInSession(schedule(NEW_CARD, 0)));
  assert.ok(!staysInSession(schedule(NEW_CARD, 2)));
});

test("due date matches the interval", () => {
  const from = new Date("2026-09-07T00:00:00.000Z");
  const card = schedule(NEW_CARD, 2);
  assert.equal(dueAfter(card, from).toISOString(), "2026-09-08T00:00:00.000Z");
});
