export type AnyRecord = Record<string, any>;

// System/internal fields that ERPNext adds to every document
const SYSTEM_FIELDS = new Set(["owner", "modified_by", "creation", "modified", "idx", "doctype"]);

// Fields that are always preserved even if they'd otherwise be stripped
export const ALWAYS_KEEP = new Set(["name", "docstatus", "status"]);

export function isSystemKey(key: string): boolean {
  return key.startsWith("_") || SYSTEM_FIELDS.has(key);
}

export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function stripChildRow(row: AnyRecord, fields?: string[]): AnyRecord {
  const fieldsSet = fields ? new Set([...fields, "name"]) : null;
  const result: AnyRecord = {};

  for (const [key, value] of Object.entries(row)) {
    if (fieldsSet && !fieldsSet.has(key)) continue;
    if (key !== "name" && isSystemKey(key)) continue;
    if (key !== "name" && isEmptyValue(value)) continue;
    result[key] = value;
  }

  return result;
}

/**
 * Strip system metadata and null/default values from an ERPNext document.
 * Applies recursively to child tables (arrays of objects).
 */
export function stripDocument(
  doc: AnyRecord,
  fields?: string[],
  childFields?: Record<string, string[]>,
): AnyRecord {
  // Auto-include child table names from child_fields so callers don't have to repeat them in fields
  const childFieldKeys = childFields ? Object.keys(childFields) : [];
  const fieldsSet = fields ? new Set([...fields, ...ALWAYS_KEEP, ...childFieldKeys]) : null;
  const result: AnyRecord = {};

  for (const [key, value] of Object.entries(doc)) {
    // If specific fields requested, skip non-matching keys
    if (fieldsSet && !fieldsSet.has(key)) continue;

    // Strip system fields (unless in ALWAYS_KEEP)
    if (!ALWAYS_KEEP.has(key) && isSystemKey(key)) continue;

    // Handle child tables (arrays of non-null objects)
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value[0] !== null &&
      typeof value[0] === "object"
    ) {
      const childFieldList = childFields?.[key];
      result[key] = value.map((row) => stripChildRow(row, childFieldList));
      continue;
    }

    // Strip empty/default values (unless in ALWAYS_KEEP)
    if (!ALWAYS_KEEP.has(key) && isEmptyValue(value)) continue;

    result[key] = value;
  }

  return result;
}
