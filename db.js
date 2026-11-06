import { DatabaseSync } from 'node:sqlite';

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS members (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role        TEXT NOT NULL DEFAULT 'member',   -- 'lead' | 'member'
      color       TEXT NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,  -- this is the "Task #" everybody refers to
      title        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      type         TEXT NOT NULL DEFAULT 'update',     -- bug | update | feature | other
      priority     TEXT NOT NULL DEFAULT 'normal',     -- low | normal | high | urgent
      area         TEXT NOT NULL DEFAULT '',           -- where to make the change (page, screen, URL)
      links        TEXT NOT NULL DEFAULT '[]',         -- JSON array of URLs
      status       TEXT NOT NULL DEFAULT 'todo',       -- todo | in_progress | done | verified | reopened
      task_date    TEXT NOT NULL,                      -- YYYY-MM-DD the task belongs to
      created_by   INTEGER REFERENCES members(id),
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      done_by      INTEGER,
      done_at      TEXT,
      verified_by  INTEGER,
      verified_at  TEXT,
      deleted      INTEGER NOT NULL DEFAULT 0
    );

    -- Activity log: creation, status changes, comments and change requests ("rework")
    CREATE TABLE IF NOT EXISTS updates (
      id           INTEGER PRIMARY KEY,
      task_id      INTEGER NOT NULL REFERENCES tasks(id),
      author       INTEGER REFERENCES members(id),
      kind         TEXT NOT NULL,                      -- created | status | comment | rework | edit
      body         TEXT NOT NULL DEFAULT '',
      from_status  TEXT,
      to_status    TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS updates_task ON updates(task_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id             INTEGER PRIMARY KEY,
      task_id        INTEGER NOT NULL REFERENCES tasks(id),
      update_id      INTEGER REFERENCES updates(id),
      stored_name    TEXT NOT NULL,
      original_name  TEXT NOT NULL,
      mime           TEXT NOT NULL,
      size           INTEGER NOT NULL,
      kind           TEXT NOT NULL,                    -- image | audio | video | file
      uploaded_by    INTEGER,
      created_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS attachments_task ON attachments(task_id);

    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '1');
  `);
  return db;
}
