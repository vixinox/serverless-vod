import { PLAYBACK_WINDOW_DAYS } from "./config.mjs";
import {
  clamp,
  daysBetweenUtc,
  distributeIntegers,
  enumerateUtcDays,
  randomFloat,
  randomInt,
  seededFloat,
  seededInt,
  startOfUtcDay,
  toDateKey,
} from "./shared.mjs";

export const VIDEO_DAYS = enumerateUtcDays(PLAYBACK_WINDOW_DAYS);

export function resolveViewTier(index) {
  const tierSlot = index % 6;
  if (tierSlot < 3) {
    return { key: "TEN_THOUSANDS", totalMin: 10000, totalMax: 99999 };
  }
  if (tierSlot < 5) {
    return { key: "HUNDRED_THOUSANDS", totalMin: 100000, totalMax: 999999 };
  }

  const millionSlot = Math.floor(index / 6) % 6;
  if (millionSlot === 0 || millionSlot === 1 || millionSlot === 4) {
    return { key: "MILLION_LOW", totalMin: 1000000, totalMax: 1999999 };
  }
  if (millionSlot === 2 || millionSlot === 5) {
    return { key: "MILLION_MID", totalMin: 2000000, totalMax: 2999999 };
  }
  return { key: "MILLION_HIGH", totalMin: 3000000, totalMax: 4999999 };
}

function buildSpikeMultiplier(index, centers, strength, width) {
  return centers.reduce((result, center) => {
    return result + strength * Math.exp(-((index - center) ** 2) / width);
  }, 1);
}

function buildRecentShare({ shortCode, publishedDaysAgo }) {
  const recentShareBase =
    publishedDaysAgo <= 7
      ? 0.7
      : publishedDaysAgo <= 30
        ? 0.48
        : publishedDaysAgo <= 75
          ? 0.28
          : 0.15;

  return clamp(
    recentShareBase + seededFloat(shortCode, "recent-share") * 0.18 + randomFloat(-0.04, 0.04),
    0.12,
    0.88,
  );
}

function buildViewWeights({ shortCode, type, publishedDay, publishedDaysAgo }) {
  const spikeCenters = [
    seededInt(shortCode, "spike-one-day", 4, 18),
    seededInt(shortCode, "spike-two-day", 11, 28),
  ];

  return VIDEO_DAYS.map((date, index) => {
    if (date.getTime() < publishedDay.getTime()) {
      return 0;
    }

    const daysSincePublish = Math.max(0, daysBetweenUtc(date, publishedDay));
    const launchCurve = 1.2 + Math.exp(-Math.abs(daysSincePublish - 2) / 3.2);
    const spikeMultiplier = buildSpikeMultiplier(index, spikeCenters, seededFloat(shortCode, "spike-two-enabled") < 0.7 ? 0.85 : 0.45, 18);
    const weekdayWeights = [0.92, 0.97, 1.01, 1.05, 1.1, 1.17, 1.13];
    const weekdayWeight = weekdayWeights[date.getUTCDay()];
    const freshnessBoost = publishedDaysAgo <= 30 ? 1.14 : publishedDaysAgo <= 75 ? 1 : 0.9;
    const typeBias = type === "SHORT" ? 1.22 : 0.94;
    const deterministicNoise = 0.76 + seededFloat(shortCode, `weight-noise-${toDateKey(date)}`) * 0.65;
    const liveNoise = randomFloat(0.72, 1.38);

    return launchCurve * spikeMultiplier * weekdayWeight * freshnessBoost * typeBias * deterministicNoise * liveNoise;
  });
}

function weightedAverage(parts) {
  return parts.reduce((result, part) => result + part.share * randomFloat(part.min, part.max), 0);
}

function buildAverageWatchSeconds({ type, duration, dayIndex }) {
  const volatility = dayIndex % 6 === 0 ? randomFloat(0.86, 1.18) : randomFloat(0.92, 1.1);
  const completionRatio =
    type === "SHORT"
      ? weightedAverage([
          { share: randomFloat(0.15, 0.35), min: 0.1, max: 0.25 },
          { share: randomFloat(0.35, 0.55), min: 0.35, max: 0.7 },
          { share: randomFloat(0.1, 0.3), min: 0.8, max: 1 },
        ])
      : weightedAverage([
          { share: randomFloat(0.25, 0.45), min: 0.03, max: 0.12 },
          { share: randomFloat(0.3, 0.45), min: 0.12, max: 0.35 },
          { share: randomFloat(0.15, 0.25), min: 0.35, max: 0.65 },
          { share: randomFloat(0.02, 0.1), min: 0.7, max: 1 },
        ]);

  return clamp(Math.round(duration * completionRatio * volatility), 1, duration);
}

function buildInteractionWeights({ shortCode, baseWeights, kind }) {
  const spikeCount = kind === "comments" ? randomInt(1, 3) : randomInt(1, 2);
  const spikeCenters = Array.from({ length: spikeCount }, (_, index) => {
    return seededInt(shortCode, `${kind}-spike-${index}`, 2, Math.max(2, baseWeights.length - 3));
  });
  const controversyCenters = kind === "dislikes"
    ? Array.from({ length: randomInt(1, 2) }, (_, index) => seededInt(shortCode, `controversy-${index}`, 3, Math.max(3, baseWeights.length - 2)))
    : [];

  return baseWeights.map((weight, index) => {
    if (weight <= 0) {
      return 0;
    }

    const ordinaryNoise =
      kind === "comments"
        ? randomFloat(0.12, 3.2)
        : kind === "dislikes"
          ? randomFloat(0.25, 2.4)
          : randomFloat(0.35, 1.9);
    const spikeStrength = kind === "comments" ? randomFloat(1.8, 4.8) : randomFloat(0.8, 2.2);
    const spike = buildSpikeMultiplier(index, spikeCenters, spikeStrength, kind === "comments" ? 5 : 12);
    const controversy = buildSpikeMultiplier(index, controversyCenters, randomFloat(2.2, 5.5), 5);

    return Math.pow(weight, kind === "comments" ? 1.15 : 1) * ordinaryNoise * spike * controversy;
  });
}

export function buildDailyStatsPlan({ shortCode, type, duration, publishedAt, totalViews, tier }) {
  const publishedDay = startOfUtcDay(publishedAt);
  const publishedDaysAgo = Math.max(1, daysBetweenUtc(new Date(), publishedDay));
  const recentShare = buildRecentShare({ shortCode, publishedDaysAgo });
  const recentViews = Math.max(
    1,
    Math.min(totalViews - Math.min(5000, totalViews - 1), Math.round(totalViews * recentShare)),
  );
  const weights = buildViewWeights({ shortCode, type, publishedDay, publishedDaysAgo });
  const dailyViews = distributeIntegers(recentViews, weights);
  const likeRate =
    type === "SHORT"
      ? 0.012 + seededFloat(shortCode, "like-rate") * 0.018 + randomFloat(-0.003, 0.004)
      : 0.009 + seededFloat(shortCode, "like-rate") * 0.015 + randomFloat(-0.002, 0.003);
  const recentLikes = clamp(
    Math.round(recentViews * Math.max(0.004, likeRate)),
    350,
    Math.max(350, Math.round(recentViews * 0.05)),
  );
  const recentDislikes = clamp(
    Math.round(recentLikes * randomFloat(0.012, 0.085)),
    8,
    Math.max(8, Math.round(recentLikes * 0.12)),
  );
  const likeDaily = distributeIntegers(recentLikes, buildInteractionWeights({ shortCode, baseWeights: weights, kind: "likes" }));
  const dislikeDaily = distributeIntegers(recentDislikes, buildInteractionWeights({ shortCode, baseWeights: weights, kind: "dislikes" }));

  const dailyRows = [];
  for (let index = 0; index < VIDEO_DAYS.length; index += 1) {
    const date = VIDEO_DAYS[index];
    const views = dailyViews[index] ?? 0;
    if (date.getTime() < publishedDay.getTime() || views <= 0) {
      dailyRows.push({
        date,
        views: 0,
        uniqueViewers: 0,
        watchTimeSeconds: 0,
        likesGained: 0,
        dislikesGained: 0,
      });
      continue;
    }

    const uniqueRatio =
      type === "SHORT"
        ? randomFloat(0.56, 0.82)
        : randomFloat(0.48, 0.72);
    const uniqueViewers = clamp(Math.round(views * uniqueRatio), 0, views);
    const averageWatchSeconds = buildAverageWatchSeconds({ type, duration, dayIndex: index });

    dailyRows.push({
      date,
      views,
      uniqueViewers,
      watchTimeSeconds: views * averageWatchSeconds,
      likesGained: likeDaily[index] ?? 0,
      dislikesGained: dislikeDaily[index] ?? 0,
    });
  }

  const legacyLikesFactor =
    publishedDaysAgo <= 30
      ? randomFloat(0.2, 0.85)
      : randomFloat(0.7, 1.9);
  const legacyDislikesFactor = randomFloat(0.35, 1.35);

  return {
    tier,
    totalLikes: recentLikes + Math.round(recentLikes * legacyLikesFactor),
    totalDislikes: recentDislikes + Math.round(recentDislikes * legacyDislikesFactor),
    dailyRows,
  };
}

export function buildCommentDistributionWeights({ shortCode, dailyRows }) {
  return buildInteractionWeights({
    shortCode,
    baseWeights: dailyRows.map((row) => (row.views > 0 ? Math.max(row.views, 1) : 0)),
    kind: "comments",
  });
}
