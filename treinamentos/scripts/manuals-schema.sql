-- Additive migration. PDFs stay in the existing persistent PostgreSQL backup.
CREATE TABLE IF NOT EXISTS manual_systems (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  search_name text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS manual_programs (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES manual_systems(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL,
  search_name text NOT NULL,
  UNIQUE (system_id, search_name)
);
CREATE TABLE IF NOT EXISTS system_manuals (
  id uuid PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES manual_programs(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL,
  description varchar(2000) NOT NULL DEFAULT '',
  keywords varchar(500) NOT NULL DEFAULT '',
  version varchar(50) NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  search_text text NOT NULL,
  filename varchar(200) NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 20971520),
  page_count integer NOT NULL CHECK (page_count > 0),
  sha256 varchar(64) NOT NULL,
  pdf bytea NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(255) NOT NULL,
  CHECK (octet_length(pdf) = byte_size)
);
CREATE INDEX IF NOT EXISTS system_manuals_program_idx ON system_manuals(program_id, published);
CREATE TABLE IF NOT EXISTS manual_audit (
  id bigserial PRIMARY KEY,
  actor_id varchar(255) NOT NULL,
  action varchar(40) NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Compatible upgrade: existing PDFs remain available; authored manuals store sanitized HTML.
ALTER TABLE system_manuals ADD COLUMN IF NOT EXISTS content_type varchar(8) NOT NULL DEFAULT 'pdf';
ALTER TABLE system_manuals ADD COLUMN IF NOT EXISTS html_content text;
ALTER TABLE system_manuals ALTER COLUMN pdf DROP NOT NULL;
CREATE TABLE IF NOT EXISTS manual_templates (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  html_content text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(255) NOT NULL
);

ALTER TABLE system_manuals ADD COLUMN IF NOT EXISTS reviewed_by_name text;
UPDATE system_manuals d SET reviewed_by_name=u.name FROM users u
WHERE d.updated_by=u.id AND d.reviewed_by_name IS NULL;
