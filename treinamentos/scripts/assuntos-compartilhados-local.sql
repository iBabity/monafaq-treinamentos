BEGIN;
CREATE TABLE IF NOT EXISTS shared_topics_local (
  id uuid PRIMARY KEY,
  category_id text NOT NULL REFERENCES categories(id),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('student','support','both')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shared_topics_local_audit (
  id uuid PRIMARY KEY,
  topic_id uuid NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shared_topics_local ADD COLUMN IF NOT EXISTS lesson_id text REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE shared_topics_local ADD COLUMN IF NOT EXISTS faq_article_id text;
CREATE UNIQUE INDEX IF NOT EXISTS shared_topics_local_faq_article_idx ON shared_topics_local(faq_article_id) WHERE faq_article_id IS NOT NULL;
ALTER TABLE shared_topics_local_audit ADD COLUMN IF NOT EXISTS actor_name text;
ALTER TABLE shared_topics_local_audit ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE shared_topics_local_audit ADD COLUMN IF NOT EXISTS before_body text;
ALTER TABLE shared_topics_local_audit ADD COLUMN IF NOT EXISTS after_body text;
COMMIT;
