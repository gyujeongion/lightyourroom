-- Light Your Room 커뮤니티 프리셋 공유
CREATE TABLE IF NOT EXISTS presets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  nick       TEXT    NOT NULL,
  code       TEXT    NOT NULL,
  code_hash  TEXT    NOT NULL UNIQUE,
  pw_hash    TEXT    NOT NULL,
  votes      INTEGER NOT NULL DEFAULT 0,
  ip_hash    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presets_created ON presets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presets_votes   ON presets (votes DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS votes (
  post_id    INTEGER NOT NULL,
  voter_hash TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, voter_hash)
);
