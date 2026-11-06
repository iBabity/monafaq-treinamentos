-- Additive migration. Legacy lessons keep an unknown publication date.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id varchar(255) REFERENCES categories(id) ON DELETE RESTRICT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE lessons ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE IF NOT EXISTS learning_playback (
  user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type varchar(20) NOT NULL CHECK (content_type IN ('lesson','assigned')),
  content_id varchar(255) NOT NULL,
  position_seconds double precision NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  duration_seconds double precision NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, content_type, content_id)
);

ALTER TABLE learning_playback ADD COLUMN IF NOT EXISTS sampled_at timestamptz;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_by varchar(255);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reviewed_by_name text;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at timestamptz;
