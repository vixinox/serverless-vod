const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeInt(raw, fallback, max = Number.MAX_SAFE_INTEGER, min = 1) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function sum(values) {
  return values.reduce((result, value) => result + value, 0);
}

export function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededFloat(seed, salt) {
  const value = hashString(`${seed}:${salt}`);
  return (value % 100000) / 100000;
}

export function seededInt(seed, salt, min, max) {
  if (max <= min) {
    return min;
  }

  const value = hashString(`${seed}:${salt}`);
  const span = max - min + 1;
  return min + (value % span);
}

export function maybeChoice(seed, salt, values) {
  return values[seededInt(seed, salt, 0, values.length - 1)];
}

export function startOfUtcDay(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function addUtcDays(value, offset) {
  const date = startOfUtcDay(value);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

export function enumerateUtcDays(days) {
  const today = startOfUtcDay(new Date());
  return Array.from({ length: days }, (_, index) => addUtcDays(today, -(days - index - 1)));
}

export function toDateKey(value) {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

export function daysBetweenUtc(left, right) {
  return Math.round((startOfUtcDay(left).getTime() - startOfUtcDay(right).getTime()) / DAY_MS);
}

export function distributeIntegers(total, weights) {
  if (total <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const sanitized = weights.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const weightTotal = sum(sanitized);

  if (weightTotal <= 0) {
    const base = Math.floor(total / weights.length);
    const remainder = total - base * weights.length;
    return weights.map((_, index) => base + (index < remainder ? 1 : 0));
  }

  const raw = sanitized.map((value) => (value / weightTotal) * total);
  const base = raw.map((value) => Math.floor(value));
  let remainder = total - sum(base);

  const ranked = raw
    .map((value, index) => ({ index, fraction: value - base[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let index = 0; index < ranked.length && remainder > 0; index += 1) {
    base[ranked[index].index] += 1;
    remainder -= 1;
  }

  return base;
}

export function sortBySeed(values, seed, salt) {
  return [...values].sort((left, right) => {
    const leftKey = typeof left === "string" ? left : left.id;
    const rightKey = typeof right === "string" ? right : right.id;
    const a = hashString(`${seed}:${salt}:${leftKey}`);
    const b = hashString(`${seed}:${salt}:${rightKey}`);
    return a - b;
  });
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a || 1;
}

export function pickSeededSubset(values, seed, salt, count) {
  if (!Array.isArray(values) || values.length === 0 || count <= 0) {
    return [];
  }

  const limit = Math.min(count, values.length);
  const size = values.length;
  const picked = [];
  let index = seededInt(seed, `${salt}:start`, 0, size - 1);
  let step = seededInt(seed, `${salt}:step`, 1, Math.max(1, size - 1));

  while (greatestCommonDivisor(step, size) !== 1) {
    step = (step % size) + 1;
  }

  for (let cursor = 0; cursor < limit; cursor += 1) {
    picked.push(values[index]);
    index = (index + step) % size;
  }

  return picked;
}
