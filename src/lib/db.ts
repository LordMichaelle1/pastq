import * as SQLite from "expo-sqlite";

export const DB_NAME = "pastq.db";

/**
 * Migrations run in order and are tracked by PRAGMA user_version, so adding a
 * step later only runs the new one. Never edit a shipped migration in place.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE subjects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    exam_date   TEXT,
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE papers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    year        TEXT,
    image_uri   TEXT,
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    paper_id    INTEGER REFERENCES papers(id) ON DELETE SET NULL,
    prompt      TEXT    NOT NULL,
    answer      TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL
  );

  -- One review row per question; the drill queue is a query over this table.
  CREATE TABLE reviews (
    question_id    INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    due_at         TEXT    NOT NULL,
    interval_days  REAL    NOT NULL DEFAULT 0,
    ease           REAL    NOT NULL DEFAULT 2.5,
    reps           INTEGER NOT NULL DEFAULT 0,
    lapses         INTEGER NOT NULL DEFAULT 0,
    last_grade     INTEGER
  );

  CREATE INDEX idx_questions_subject ON questions(subject_id);
  CREATE INDEX idx_reviews_due       ON reviews(due_at);
  `,
];

export async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const applied = row?.user_version ?? 0;

  for (let version = applied; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    // PRAGMA does not accept bound parameters, and version is a loop counter.
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}
