-- New tables this service owns. Everything else (bills, bill_documents,
-- bill_ai_content, ingestion_state) is created by the pipeline services —
-- this file only adds what's new for the API/frontend layer.

CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  is_admin       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id          BIGSERIAL PRIMARY KEY,
  bill_id     BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_bill ON comments(bill_id);

CREATE TABLE IF NOT EXISTS follows (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('bill', 'topic', 'mp')),
  target_id   TEXT NOT NULL,   -- bill id, topic name, or mp id — text so one column covers all three
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_id);

-- Placeholder — no MP ingestion service exists yet (see README "Suggested
-- next steps"). Table is here so /mps and follow-an-MP are wired end to
-- end in the API/frontend now; it'll just return an empty list until
-- something populates it.
CREATE TABLE IF NOT EXISTS mps (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  house             TEXT,
  state             TEXT,
  constituency      TEXT,
  party             TEXT,
  bloc              TEXT,
  term              TEXT,
  terms             INT,
  education         TEXT,
  committee         TEXT,
  topics            TEXT[] DEFAULT '{}',
  bio               TEXT,
  bills_sponsored   INT DEFAULT 0,
  questions_asked   INT DEFAULT 0,
  attendance_pct    INT,
  debates_count     INT,
  source_raw        JSONB,
  UNIQUE (name, constituency)
);

CREATE TABLE IF NOT EXISTS bill_sponsors (
  bill_id  BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  mp_id    BIGINT NOT NULL REFERENCES mps(id) ON DELETE CASCADE,
  PRIMARY KEY (bill_id, mp_id)
);
