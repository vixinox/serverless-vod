const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});

const MEDIUM_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const VISIBILITY_LABELS = {
  PUBLIC: "公开",
  PRIVATE: "私享",
  UNLISTED: "不公开",
  DRAFT: "草稿",
} as const;

const PROCESSING_STATUS_LABELS = {
  UPLOADING: "上传中",
  PROCESSING: "处理中",
  READY: "已就绪",
  FAILED: "失败",
} as const;

export function formatCompactNumber(value: number) {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1).replace(".0", "")}亿`;
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(".0", "")}万`;
  }

  return value.toLocaleString("zh-CN");
}

export function formatHoursLabel(value: number) {
  return `${value.toFixed(1)} 小时`;
}

export function formatShortDate(value: Date | string) {
  return SHORT_DATE_FORMATTER.format(new Date(value));
}

export function formatMediumDate(value: Date | string | null) {
  if (!value) {
    return "未发布";
  }

  return MEDIUM_DATE_FORMATTER.format(new Date(value));
}

export function formatLongDate(value: Date | string) {
  return LONG_DATE_FORMATTER.format(new Date(value));
}

export function formatVideoTypeLabel(value: "LONG" | "SHORT") {
  return value === "LONG" ? "长视频" : "短视频";
}

export function formatVisibilityLabel(value: string) {
  return VISIBILITY_LABELS[value as keyof typeof VISIBILITY_LABELS] ?? value;
}

export function formatProcessingStatusLabel(value: string) {
  return PROCESSING_STATUS_LABELS[value as keyof typeof PROCESSING_STATUS_LABELS] ?? value;
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatSignedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("zh-CN")}`;
}

export function formatVideoDuration(value: number | null) {
  if (!value || value <= 0) {
    return "—";
  }

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
