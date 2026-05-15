export const PLAYER_SEEK_EVENT = "vod:seek-to";

export interface PlayerSeekDetail {
  seconds: number;
}

// 评论里的 01:23 或 01:02:03 会被识别成可点击时间戳。
// 点击后通过 PLAYER_SEEK_EVENT 通知播放器跳转，评论组件和播放器之间不需要直接互相引用。
const TIMESTAMP_PATTERN = /(?<!\d)(\d+(?::\d{2}){1,2})(?!\d)/g;

export type TimestampSegment =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "timestamp";
      value: string;
      seconds: number;
    };

export function parseTimestampToSeconds(value: string) {
  const parts = value.split(":").map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;

    // 秒数超过 59 就不是合法时间，保留为普通文本，避免误跳转。
    if (seconds >= 60) {
      return null;
    }

    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;

    // 三段格式按 时:分:秒 解析，同样要求分和秒都在 0-59。
    if (minutes >= 60 || seconds >= 60) {
      return null;
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

export function splitTextWithTimestamps(content: string): TimestampSegment[] {
  const matches = Array.from(content.matchAll(TIMESTAMP_PATTERN));

  if (matches.length === 0) {
    return [{ type: "text", value: content }];
  }

  const segments: TimestampSegment[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    const value = match[0];
    const index = match.index ?? 0;
    const seconds = parseTimestampToSeconds(value);

    if (index > lastIndex) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex, index),
      });
    }

    if (seconds === null) {
      segments.push({
        type: "text",
        value,
      });
    } else {
      // 调用方根据 timestamp segment 渲染按钮，点击时派发跳转事件给播放器。
      segments.push({
        type: "timestamp",
        value,
        seconds,
      });
    }

    lastIndex = index + value.length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      value: content.slice(lastIndex),
    });
  }

  return segments;
}
