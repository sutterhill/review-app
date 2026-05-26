const unescapeJsonString = (value: string): string => {
  const safe = value.endsWith("\\") ? value.slice(0, -1) : value;
  try {
    return JSON.parse(`"${safe}"`) as string;
  } catch {
    return safe
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
};

export const extractStreamingLine = (raw: string): string => {
  if (!raw) return "";
  let last = "";
  let index = 0;
  while (index < raw.length) {
    if (raw[index] !== '"') {
      index += 1;
      continue;
    }
    index += 1;
    const start = index;
    while (index < raw.length && raw[index] !== '"') {
      if (raw[index] === "\\" && index + 1 < raw.length) {
        index += 2;
      } else {
        index += 1;
      }
    }
    const content = raw.slice(start, index);
    if (content.trim().length > 0) last = content;
    if (index < raw.length) index += 1;
  }
  if (!last) return "";
  const decoded = unescapeJsonString(last);
  const lines = decoded.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return (lines[lines.length - 1] ?? "").trim();
};
