-- Core DB triggers/functions for counter consistency and lifecycle timestamps
-- Apply manually in migration SQL after Prisma migrations are created.

BEGIN;

-- ------------------------------------------------------------
-- 1) Video reaction counters: Video.likesCount / Video.dislikesCount
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_video_reaction_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."reactionType" = 'LIKE' THEN
      UPDATE "Video" SET "likesCount" = "likesCount" + 1 WHERE "id" = NEW."videoId";
    ELSE
      UPDATE "Video" SET "dislikesCount" = "dislikesCount" + 1 WHERE "id" = NEW."videoId";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."reactionType" = 'LIKE' THEN
      UPDATE "Video" SET "likesCount" = GREATEST(0, "likesCount" - 1) WHERE "id" = OLD."videoId";
    ELSE
      UPDATE "Video" SET "dislikesCount" = GREATEST(0, "dislikesCount" - 1) WHERE "id" = OLD."videoId";
    END IF;
    RETURN OLD;
  ELSE
    IF OLD."reactionType" = 'LIKE' THEN
      UPDATE "Video" SET "likesCount" = GREATEST(0, "likesCount" - 1) WHERE "id" = OLD."videoId";
    ELSE
      UPDATE "Video" SET "dislikesCount" = GREATEST(0, "dislikesCount" - 1) WHERE "id" = OLD."videoId";
    END IF;

    IF NEW."reactionType" = 'LIKE' THEN
      UPDATE "Video" SET "likesCount" = "likesCount" + 1 WHERE "id" = NEW."videoId";
    ELSE
      UPDATE "Video" SET "dislikesCount" = "dislikesCount" + 1 WHERE "id" = NEW."videoId";
    END IF;

    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_reaction_counter ON "VideoReaction";
CREATE TRIGGER trg_video_reaction_counter
AFTER INSERT OR UPDATE OR DELETE ON "VideoReaction"
FOR EACH ROW
EXECUTE FUNCTION fn_video_reaction_counter();

-- ------------------------------------------------------------
-- 2) Comment reaction counters: Comment.likesCount / Comment.dislikesCount
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_comment_reaction_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."reactionType" = 'LIKE' THEN
      UPDATE "Comment" SET "likesCount" = "likesCount" + 1 WHERE "id" = NEW."commentId";
    ELSE
      UPDATE "Comment" SET "dislikesCount" = "dislikesCount" + 1 WHERE "id" = NEW."commentId";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."reactionType" = 'LIKE' THEN
      UPDATE "Comment" SET "likesCount" = GREATEST(0, "likesCount" - 1) WHERE "id" = OLD."commentId";
    ELSE
      UPDATE "Comment" SET "dislikesCount" = GREATEST(0, "dislikesCount" - 1) WHERE "id" = OLD."commentId";
    END IF;
    RETURN OLD;
  ELSE
    IF OLD."reactionType" = 'LIKE' THEN
      UPDATE "Comment" SET "likesCount" = GREATEST(0, "likesCount" - 1) WHERE "id" = OLD."commentId";
    ELSE
      UPDATE "Comment" SET "dislikesCount" = GREATEST(0, "dislikesCount" - 1) WHERE "id" = OLD."commentId";
    END IF;

    IF NEW."reactionType" = 'LIKE' THEN
      UPDATE "Comment" SET "likesCount" = "likesCount" + 1 WHERE "id" = NEW."commentId";
    ELSE
      UPDATE "Comment" SET "dislikesCount" = "dislikesCount" + 1 WHERE "id" = NEW."commentId";
    END IF;

    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_reaction_counter ON "CommentReaction";
CREATE TRIGGER trg_comment_reaction_counter
AFTER INSERT OR UPDATE OR DELETE ON "CommentReaction"
FOR EACH ROW
EXECUTE FUNCTION fn_comment_reaction_counter();

-- ------------------------------------------------------------
-- 3) Comment counters: Video.commentsCount / parent Comment.repliesCount
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_comment_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Video" SET "commentsCount" = "commentsCount" + 1 WHERE "id" = NEW."videoId";

    IF NEW."parentId" IS NOT NULL THEN
      UPDATE "Comment" SET "repliesCount" = "repliesCount" + 1 WHERE "id" = NEW."parentId";
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Video" SET "commentsCount" = GREATEST(0, "commentsCount" - 1) WHERE "id" = OLD."videoId";

    IF OLD."parentId" IS NOT NULL THEN
      UPDATE "Comment" SET "repliesCount" = GREATEST(0, "repliesCount" - 1) WHERE "id" = OLD."parentId";
    END IF;

    RETURN OLD;
  ELSE
    IF NEW."videoId" IS DISTINCT FROM OLD."videoId" THEN
      UPDATE "Video" SET "commentsCount" = GREATEST(0, "commentsCount" - 1) WHERE "id" = OLD."videoId";
      UPDATE "Video" SET "commentsCount" = "commentsCount" + 1 WHERE "id" = NEW."videoId";
    END IF;

    IF NEW."parentId" IS DISTINCT FROM OLD."parentId" THEN
      IF OLD."parentId" IS NOT NULL THEN
        UPDATE "Comment" SET "repliesCount" = GREATEST(0, "repliesCount" - 1) WHERE "id" = OLD."parentId";
      END IF;

      IF NEW."parentId" IS NOT NULL THEN
        UPDATE "Comment" SET "repliesCount" = "repliesCount" + 1 WHERE "id" = NEW."parentId";
      END IF;
    END IF;

    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_counter ON "Comment";
CREATE TRIGGER trg_comment_counter
AFTER INSERT OR UPDATE OR DELETE ON "Comment"
FOR EACH ROW
EXECUTE FUNCTION fn_comment_counter();

-- ------------------------------------------------------------
-- 4) Subscription counters: Channel.subscribersCount
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_subscription_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Channel" SET "subscribersCount" = "subscribersCount" + 1 WHERE "id" = NEW."channelId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Channel" SET "subscribersCount" = GREATEST(0, "subscribersCount" - 1) WHERE "id" = OLD."channelId";
    RETURN OLD;
  ELSE
    IF NEW."channelId" IS DISTINCT FROM OLD."channelId" THEN
      UPDATE "Channel" SET "subscribersCount" = GREATEST(0, "subscribersCount" - 1) WHERE "id" = OLD."channelId";
      UPDATE "Channel" SET "subscribersCount" = "subscribersCount" + 1 WHERE "id" = NEW."channelId";
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_counter ON "Subscription";
CREATE TRIGGER trg_subscription_counter
AFTER INSERT OR UPDATE OR DELETE ON "Subscription"
FOR EACH ROW
EXECUTE FUNCTION fn_subscription_counter();
