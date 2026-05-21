import type { LineRange } from "../../store/walkthrough/walkthrough-types";

const STRING_RANGE_PATTERN = /^L?(\d+)(?:\s*[-:]\s*L?(\d+))?$/iu;

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.replace(/^L/iu, ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const normalizeOne = (value: unknown): LineRange | null => {
  if (typeof value === "number" || typeof value === "string") {
    if (typeof value === "string") {
      const match = STRING_RANGE_PATTERN.exec(value.trim());
      if (match) {
        const start = Number.parseInt(match[1] ?? "", 10);
        const end = match[2] ? Number.parseInt(match[2], 10) : start;
        if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) {
          return [start, end];
        }
        return null;
      }
    }
    const single = toPositiveInt(value);
    return single === null ? null : [single, single];
  }
  if (Array.isArray(value)) {
    const start = toPositiveInt(value[0]);
    if (start === null) return null;
    const end = value.length >= 2 ? toPositiveInt(value[1]) : start;
    if (end === null || end < start) return [start, start];
    return [start, end];
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const start = toPositiveInt(record.start ?? record.from ?? record.begin);
    if (start === null) return null;
    const end = toPositiveInt(record.end ?? record.to ?? record.finish) ?? start;
    return [start, Math.max(end, start)];
  }
  return null;
};

export const normalizeLineRanges = (value: unknown): LineRange[] => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (
      value.length === 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      value[0] > 0 &&
      value[1] >= value[0]
    ) {
      return [[Math.trunc(value[0]), Math.trunc(value[1])]];
    }
    const out: LineRange[] = [];
    for (const item of value) {
      const range = normalizeOne(item);
      if (range) out.push(range);
    }
    return out;
  }
  const single = normalizeOne(value);
  return single ? [single] : [];
};
