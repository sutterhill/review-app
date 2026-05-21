export const parsePartialJson = <T = unknown>(input: string): null | T => {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const startIndex = findFirstStructuralChar(trimmed);
  if (startIndex < 0) return null;

  const repaired = repairJson(trimmed.slice(startIndex));
  if (repaired === null) return null;

  try {
    return JSON.parse(repaired) as T;
  } catch {
    return null;
  }
};

const findFirstStructuralChar = (input: string): number => {
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{" || char === "[") return index;
  }
  return -1;
};

interface RepairState {
  inString: boolean;
  stack: Array<"[" | "{">;
}

const scanState = (input: string): null | RepairState => {
  const state: RepairState = { inString: false, stack: [] };
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (state.inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') state.inString = false;
      continue;
    }

    if (char === '"') {
      state.inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      state.stack.push(char);
      continue;
    }
    if (char === "}" || char === "]") {
      const top = state.stack.pop();
      const expected = char === "}" ? "{" : "[";
      if (top !== expected) return null;
    }
  }
  return state;
};

const closeOpenStructures = (input: string): string => {
  const state = scanState(input);
  if (state === null) return input;
  let working = input.replace(/[,:\s]+$/u, "");
  for (let depth = state.stack.length - 1; depth >= 0; depth -= 1) {
    const frame = state.stack[depth];
    working += frame === "{" ? "}" : "]";
  }
  return working;
};

const trimDanglingValue = (input: string): null | string => {
  let inString = false;
  let escaped = false;
  let depth = 0;
  let lastBoundary = -1;
  let lastBoundaryChar = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      depth += 1;
      lastBoundary = index;
      lastBoundaryChar = char;
      continue;
    }
    if (char === "}" || char === "]") {
      depth -= 1;
      continue;
    }
    if (char === "," && depth >= 1) {
      lastBoundary = index;
      lastBoundaryChar = char;
    }
  }

  if (lastBoundary < 0) return null;
  if (lastBoundaryChar === ",") {
    return input.slice(0, lastBoundary).replace(/[,:\s]+$/u, "");
  }
  return input.slice(0, lastBoundary + 1);
};

const repairJson = (input: string): null | string => {
  const state = scanState(input);
  if (state === null) return null;

  let working = state.inString ? `${input}"` : input;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const closed = closeOpenStructures(working);
    try {
      JSON.parse(closed);
      return closed;
    } catch {
      const trimmed = trimDanglingValue(working);
      if (trimmed === null || trimmed === working) return null;
      working = trimmed;
    }
  }
  return null;
};
