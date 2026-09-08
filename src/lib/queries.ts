import type * as SQLite from "expo-sqlite";

import { dueAfter, NEW_CARD, schedule, type CardState, type Grade } from "./srs";

export type Subject = {
  id: number;
  name: string;
  examDate: string | null;
  createdAt: string;
};

export type Question = {
  id: number;
  subjectId: number;
  paperId: number | null;
  prompt: string;
  answer: string;
};

export type SubjectStats = {
  total: number;
  due: number;
  /** Answered correctly enough to have left the same-session queue. */
  learned: number;
};

const now = () => new Date().toISOString();

/* ---------- subjects ---------- */

export async function listSubjects(db: SQLite.SQLiteDatabase): Promise<Subject[]> {
  return db.getAllAsync<Subject>(
    `SELECT id, name, exam_date AS examDate, created_at AS createdAt
       FROM subjects
      ORDER BY created_at`
  );
}

export async function countSubjects(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM subjects");
  return row?.n ?? 0;
}

export async function createSubject(
  db: SQLite.SQLiteDatabase,
  name: string,
  examDate: string | null = null
): Promise<number> {
  const result = await db.runAsync(
    "INSERT INTO subjects (name, exam_date, created_at) VALUES (?, ?, ?)",
    name.trim(),
    examDate,
    now()
  );
  return result.lastInsertRowId;
}

export async function deleteSubject(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  // Papers, questions and reviews cascade from here.
  await db.runAsync("DELETE FROM subjects WHERE id = ?", id);
}

/* ---------- questions ---------- */

export async function createQuestion(
  db: SQLite.SQLiteDatabase,
  input: { subjectId: number; prompt: string; answer?: string; paperId?: number | null }
): Promise<number> {
  const timestamp = now();
  let questionId = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO questions (subject_id, paper_id, prompt, answer, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      input.subjectId,
      input.paperId ?? null,
      input.prompt.trim(),
      (input.answer ?? "").trim(),
      timestamp
    );

    questionId = result.lastInsertRowId;

    // New questions are due immediately; there is nothing to space out yet.
    await db.runAsync(
      "INSERT INTO reviews (question_id, due_at, interval_days, ease, reps, lapses) VALUES (?, ?, 0, 2.5, 0, 0)",
      questionId,
      timestamp
    );
  });

  return questionId;
}

export async function countQuestions(
  db: SQLite.SQLiteDatabase,
  subjectId: number
): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM questions WHERE subject_id = ?",
    subjectId
  );
  return row?.n ?? 0;
}

/* ---------- the drill queue ---------- */

/** Questions whose review is due, oldest first. */
export async function dueQuestions(
  db: SQLite.SQLiteDatabase,
  subjectId: number,
  limit = 20
): Promise<Question[]> {
  return db.getAllAsync<Question>(
    `SELECT q.id, q.subject_id AS subjectId, q.paper_id AS paperId, q.prompt, q.answer
       FROM questions q
       JOIN reviews r ON r.question_id = q.id
      WHERE q.subject_id = ? AND r.due_at <= ?
      ORDER BY r.due_at
      LIMIT ?`,
    subjectId,
    now(),
    limit
  );
}

export async function gradeQuestion(
  db: SQLite.SQLiteDatabase,
  questionId: number,
  grade: Grade
): Promise<CardState> {
  const row = await db.getFirstAsync<{
    interval_days: number;
    ease: number;
    reps: number;
    lapses: number;
  }>(
    "SELECT interval_days, ease, reps, lapses FROM reviews WHERE question_id = ?",
    questionId
  );

  const current: CardState = row
    ? { intervalDays: row.interval_days, ease: row.ease, reps: row.reps, lapses: row.lapses }
    : NEW_CARD;

  const next = schedule(current, grade);

  await db.runAsync(
    `INSERT INTO reviews (question_id, due_at, interval_days, ease, reps, lapses, last_grade)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(question_id) DO UPDATE SET
       due_at        = excluded.due_at,
       interval_days = excluded.interval_days,
       ease          = excluded.ease,
       reps          = excluded.reps,
       lapses        = excluded.lapses,
       last_grade    = excluded.last_grade`,
    questionId,
    dueAfter(next).toISOString(),
    next.intervalDays,
    next.ease,
    next.reps,
    next.lapses,
    grade
  );

  return next;
}

export async function subjectStats(
  db: SQLite.SQLiteDatabase,
  subjectId: number
): Promise<SubjectStats> {
  const row = await db.getFirstAsync<SubjectStats>(
    `SELECT COUNT(*)                                        AS total,
            SUM(CASE WHEN r.due_at <= ?    THEN 1 ELSE 0 END) AS due,
            SUM(CASE WHEN r.interval_days >= 1 THEN 1 ELSE 0 END) AS learned
       FROM questions q
       JOIN reviews r ON r.question_id = q.id
      WHERE q.subject_id = ?`,
    now(),
    subjectId
  );

  return {
    total: row?.total ?? 0,
    due: row?.due ?? 0,
    learned: row?.learned ?? 0,
  };
}
