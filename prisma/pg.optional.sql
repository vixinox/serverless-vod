-- Optional PostgreSQL optimizations (enable selectively)
-- This file is intentionally separated from core triggers.

BEGIN;

-- Ensure required extension exists before function compilation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- A) Studio views (read-only analytics surface)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_video_studio_30d AS
SELECT
  v."id" AS video_id,
  v."channelId" AS channel_id,
  SUM(s."views")::bigint AS views_30d,
  SUM(s."watchTimeSeconds")::bigint AS watch_time_seconds_30d,
  SUM(s."likesGained")::int AS likes_30d,
  SUM(s."dislikesGained")::int AS dislikes_30d,
  SUM(s."commentsGained")::int AS comments_30d
FROM "Video" v
LEFT JOIN "VideoDailyStat" s
  ON s."videoId" = v."id"
  AND s."date" >= (CURRENT_DATE - INTERVAL '29 day')
GROUP BY v."id", v."channelId";

CREATE OR REPLACE VIEW vw_channel_studio_30d AS
SELECT
  c."id" AS channel_id,
  SUM(s."views")::bigint AS views_30d,
  SUM(s."watchTimeSeconds")::bigint AS watch_time_seconds_30d,
  SUM(s."subscribersGained")::int AS subs_gained_30d,
  SUM(s."subscribersLost")::int AS subs_lost_30d,
  SUM(s."videosPublished")::int AS videos_published_30d
FROM "Channel" c
LEFT JOIN "ChannelDailyStat" s
  ON s."channelId" = c."id"
  AND s."date" >= (CURRENT_DATE - INTERVAL '29 day')
GROUP BY c."id";

CREATE OR REPLACE VIEW vw_video_playback_funnel_30d AS
SELECT
  e."videoId" AS video_id,
  COUNT(*) FILTER (WHERE e."eventType" = 'PLAY_START')::bigint AS starts_30d,
  COUNT(*) FILTER (WHERE e."eventType" = 'PLAY_PROGRESS')::bigint AS progress_events_30d,
  COUNT(*) FILTER (WHERE e."eventType" = 'ENDED')::bigint AS completed_30d,
  COUNT(DISTINCT e."sessionId") FILTER (WHERE e."eventType" = 'PLAY_START')::bigint AS unique_sessions_started_30d,
  COUNT(DISTINCT e."sessionId") FILTER (WHERE e."eventType" = 'ENDED')::bigint AS unique_sessions_completed_30d
FROM "VideoPlaybackEvent" e
WHERE e."createdAt" >= (NOW() - INTERVAL '30 day')
GROUP BY e."videoId";

CREATE OR REPLACE VIEW vw_video_watchtime_daily AS
SELECT
  e."videoId" AS video_id,
  DATE(e."createdAt") AS date,
  SUM(COALESCE(e."watchDeltaMs", 0))::bigint AS watch_time_ms,
  COUNT(DISTINCT e."sessionId")::bigint AS unique_sessions,
  COUNT(*) FILTER (WHERE e."eventType" = 'PLAY_START')::bigint AS starts,
  COUNT(*) FILTER (WHERE e."eventType" = 'ENDED')::bigint AS completed
FROM "VideoPlaybackEvent" e
GROUP BY e."videoId", DATE(e."createdAt");

-- ------------------------------------------------------------
-- B) Transcode routines (DB-side state transition helpers)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_enqueue_transcode_job(
  p_video_id text,
  p_input_bucket text,
  p_input_key text,
  p_output_bucket text,
  p_output_prefix text,
  p_provider "TranscodeProvider" DEFAULT 'LOCALSTACK'
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id text;
BEGIN
  INSERT INTO "TranscodeJob" (
    "id", "videoId", "provider", "inputBucket", "inputKey", "outputBucket", "outputPrefix", "status", "attempt", "maxAttempts", "queuedAt", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, p_video_id, p_provider, p_input_bucket, p_input_key, p_output_bucket, p_output_prefix, 'QUEUED', 0, 3, NOW(), NOW(), NOW()
  )
  RETURNING "id" INTO v_job_id;

  UPDATE "Video"
  SET "processingStatus" = 'PROCESSING',
      "processingError" = NULL,
      "updatedAt" = NOW()
  WHERE "id" = p_video_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION sp_finish_transcode_job(
  p_job_id text,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_video_id text;
BEGIN
  SELECT "videoId" INTO v_video_id FROM "TranscodeJob" WHERE "id" = p_job_id;

  IF v_video_id IS NULL THEN
    RAISE EXCEPTION 'TranscodeJob % not found', p_job_id;
  END IF;

  UPDATE "TranscodeJob"
  SET "status" = CASE WHEN p_success THEN 'SUCCEEDED' ELSE 'FAILED' END,
      "lastError" = CASE WHEN p_success THEN NULL ELSE p_error END,
      "finishedAt" = NOW(),
      "updatedAt" = NOW()
  WHERE "id" = p_job_id;

  UPDATE "Video"
  SET "processingStatus" = CASE WHEN p_success THEN 'READY' ELSE 'FAILED' END,
      "processingError" = CASE WHEN p_success THEN NULL ELSE p_error END,
      "readyAt" = CASE WHEN p_success THEN COALESCE("readyAt", NOW()) ELSE "readyAt" END,
      "updatedAt" = NOW()
  WHERE "id" = v_video_id;
END;
$$;

-- ------------------------------------------------------------
-- C) Optional extensions (choose per environment)
-- ------------------------------------------------------------
-- 1) Query analysis in dev/staging:
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2) Scheduling (if your Postgres supports it):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Example: daily rollup job
-- SELECT cron.schedule('daily-studio-rollup', '5 0 * * *', $$
--   SELECT 1;
-- $$);

COMMIT;
