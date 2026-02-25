-- Daily rollup from VideoPlaybackEvent to VideoDailyStat / ChannelDailyStat

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION sp_rollup_daily_stats(
  p_from_date date,
  p_to_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL THEN
    RAISE EXCEPTION 'p_from_date and p_to_date must not be null';
  END IF;

  IF p_from_date > p_to_date THEN
    RAISE EXCEPTION 'p_from_date (%) must be <= p_to_date (%)', p_from_date, p_to_date;
  END IF;

  -- 1) Video daily stats from playback events + reactions/comments
  INSERT INTO "VideoDailyStat" (
    "id",
    "videoId",
    "date",
    "views",
    "uniqueViewers",
    "watchTimeSeconds",
    "likesGained",
    "dislikesGained",
    "commentsGained"
  )
  SELECT
    gen_random_uuid()::text AS id,
    e.video_id,
    e.day::date,
    e.views,
    e.unique_viewers,
    e.watch_time_seconds,
    COALESCE(vr.likes_gained, 0) AS likes_gained,
    COALESCE(vr.dislikes_gained, 0) AS dislikes_gained,
    COALESCE(c.comments_gained, 0) AS comments_gained
  FROM (
    SELECT
      vpe."videoId" AS video_id,
      DATE(vpe."createdAt") AS day,
      COUNT(*) FILTER (WHERE vpe."eventType" = 'PLAY_START')::bigint AS views,
      COUNT(DISTINCT COALESCE(vpe."userId", vpe."sessionId"))::int AS unique_viewers,
      FLOOR(SUM(COALESCE(vpe."watchDeltaMs", 0)) / 1000.0)::bigint AS watch_time_seconds
    FROM "VideoPlaybackEvent" vpe
    WHERE DATE(vpe."createdAt") BETWEEN p_from_date AND p_to_date
    GROUP BY vpe."videoId", DATE(vpe."createdAt")
  ) e
  LEFT JOIN (
    SELECT
      vr."videoId" AS video_id,
      DATE(vr."createdAt") AS day,
      COUNT(*) FILTER (WHERE vr."reactionType" = 'LIKE')::int AS likes_gained,
      COUNT(*) FILTER (WHERE vr."reactionType" = 'DISLIKE')::int AS dislikes_gained
    FROM "VideoReaction" vr
    WHERE DATE(vr."createdAt") BETWEEN p_from_date AND p_to_date
    GROUP BY vr."videoId", DATE(vr."createdAt")
  ) vr
    ON vr.video_id = e.video_id
   AND vr.day = e.day
  LEFT JOIN (
    SELECT
      c."videoId" AS video_id,
      DATE(c."createdAt") AS day,
      COUNT(*)::int AS comments_gained
    FROM "Comment" c
    WHERE DATE(c."createdAt") BETWEEN p_from_date AND p_to_date
    GROUP BY c."videoId", DATE(c."createdAt")
  ) c
    ON c.video_id = e.video_id
   AND c.day = e.day
  ON CONFLICT ("videoId", "date") DO UPDATE
  SET
    "views" = EXCLUDED."views",
    "uniqueViewers" = EXCLUDED."uniqueViewers",
    "watchTimeSeconds" = EXCLUDED."watchTimeSeconds",
    "likesGained" = EXCLUDED."likesGained",
    "dislikesGained" = EXCLUDED."dislikesGained",
    "commentsGained" = EXCLUDED."commentsGained";

  -- 2) Channel daily stats from video daily stats + subscriptions + published videos
  INSERT INTO "ChannelDailyStat" (
    "id",
    "channelId",
    "date",
    "views",
    "watchTimeSeconds",
    "subscribersGained",
    "subscribersLost",
    "videosPublished"
  )
  SELECT
    gen_random_uuid()::text AS id,
    x.channel_id,
    x.day::date,
    x.views,
    x.watch_time_seconds,
    x.subscribers_gained,
    0::int AS subscribers_lost,
    x.videos_published
  FROM (
    SELECT
      v."channelId" AS channel_id,
      vds."date" AS day,
      SUM(vds."views")::bigint AS views,
      SUM(vds."watchTimeSeconds")::bigint AS watch_time_seconds,
      COALESCE(subs.subscribers_gained, 0) AS subscribers_gained,
      COALESCE(pub.videos_published, 0) AS videos_published
    FROM "VideoDailyStat" vds
    JOIN "Video" v ON v."id" = vds."videoId"
    LEFT JOIN (
      SELECT
        s."channelId" AS channel_id,
        DATE(s."createdAt") AS day,
        COUNT(*)::int AS subscribers_gained
      FROM "Subscription" s
      WHERE DATE(s."createdAt") BETWEEN p_from_date AND p_to_date
      GROUP BY s."channelId", DATE(s."createdAt")
    ) subs
      ON subs.channel_id = v."channelId"
     AND subs.day = vds."date"
    LEFT JOIN (
      SELECT
        vv."channelId" AS channel_id,
        DATE(vv."publishedAt") AS day,
        COUNT(*)::int AS videos_published
      FROM "Video" vv
      WHERE vv."publishedAt" IS NOT NULL
        AND DATE(vv."publishedAt") BETWEEN p_from_date AND p_to_date
      GROUP BY vv."channelId", DATE(vv."publishedAt")
    ) pub
      ON pub.channel_id = v."channelId"
     AND pub.day = vds."date"
    WHERE vds."date" BETWEEN p_from_date AND p_to_date
    GROUP BY v."channelId", vds."date", subs.subscribers_gained, pub.videos_published
  ) x
  ON CONFLICT ("channelId", "date") DO UPDATE
  SET
    "views" = EXCLUDED."views",
    "watchTimeSeconds" = EXCLUDED."watchTimeSeconds",
    "subscribersGained" = EXCLUDED."subscribersGained",
    "subscribersLost" = EXCLUDED."subscribersLost",
    "videosPublished" = EXCLUDED."videosPublished";
END;
$$;

COMMIT;

-- Usage examples:
-- SELECT sp_rollup_daily_stats('2020-01-01'::date, CURRENT_DATE);
-- SELECT sp_rollup_daily_stats(CURRENT_DATE - 2, CURRENT_DATE);
