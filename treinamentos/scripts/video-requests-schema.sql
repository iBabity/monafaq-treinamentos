BEGIN;
CREATE TABLE IF NOT EXISTS assigned_video_requests (
 id uuid PRIMARY KEY,
 user_id varchar(255) NOT NULL REFERENCES users(id),
 requester_id varchar(255) NOT NULL REFERENCES users(id),
 youtube_url text NOT NULL,
 title varchar(255) NOT NULL,
 description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_by varchar(255) REFERENCES users(id),
 decided_at timestamptz,
 published_video_id varchar(255)
);
CREATE INDEX IF NOT EXISTS assigned_video_requests_status_idx ON assigned_video_requests(status,created_at DESC);
COMMIT;
