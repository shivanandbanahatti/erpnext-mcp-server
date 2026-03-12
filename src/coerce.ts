/**
 * Input coercion for MCP tool arguments.
 *
 * The MCP SDK sometimes passes JSON-serialized strings instead of parsed
 * objects/arrays. These helpers parse stringified inputs back to their
 * expected types, preventing double-encoding when the values are later
 * passed to JSON.stringify() for API calls.
 */

/**
 * Coerce a value to a string array.
 * Handles: undefined/null → undefined, string[] → pass-through,
 * JSON string → parse, plain string → [string], other → undefined.
 * Rejects arrays containing non-string elements.
 */
export function coerceStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    if (!value.every((v) => typeof v === "string")) return undefined;
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // Parsed as array — only accept if all elements are strings
        return parsed.every((v: unknown) => typeof v === "string") ? parsed : undefined;
      }
    } catch {
      /* not JSON — wrap as single-element array below */
    }
    return [value];
  }
  return undefined;
}

/**
 * Coerce a value to a plain object (Record<string, any>).
 * Handles: undefined/null → undefined, object → pass-through,
 * JSON string → parse, other → undefined.
 */
export function coerceObject(value: unknown): Record<string, any> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
    } catch {
      /* not valid JSON object */
    }
  }
  return undefined;
}

/**
 * Coerce a value to a finite non-negative number suitable for API limits.
 * Zero is allowed (means "no limit" in Frappe). Negative and non-finite rejected.
 * Handles: number → pass-through, numeric string → parse,
 * undefined/null → undefined, other → undefined.
 */
export function coerceNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

/**
 * Coerce a value to an array of [field, operator, value] filter triples.
 * Field and operator must be strings; value can be any type (ERPNext accepts
 * numeric values like [["qty", ">", 10]]).
 * Handles: undefined/null → undefined, array → validate each element,
 * JSON string → parse then validate, other → throw.
 */
export function coerceFilterArray(value: unknown): Array<[string, string, unknown]> | undefined {
  if (value === undefined || value === null) return undefined;

  let arr: unknown;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      throw new Error(`Invalid child_filters: expected JSON array, got string`);
    }
  } else {
    arr = value;
  }

  if (!Array.isArray(arr)) {
    throw new Error(
      `Invalid child_filters: expected array of [field, operator, value] triples, got ${typeof arr}`,
    );
  }

  for (const filter of arr) {
    if (
      !Array.isArray(filter) ||
      filter.length !== 3 ||
      typeof filter[0] !== "string" ||
      typeof filter[1] !== "string"
    ) {
      throw new Error(
        `Invalid child_filter entry: expected [field, operator, value] triple, got ${JSON.stringify(filter)}`,
      );
    }
  }

  return arr as Array<[string, string, unknown]>;
}
