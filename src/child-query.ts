import { coerceStringArray, coerceObject, coerceNumber, coerceFilterArray } from "./coerce.js";

type AnyRecord = Record<string, any>;

// ERPNext field names: word characters only (letters, digits, underscore)
const FIELD_NAME_RE = /^\w+$/;
// ERPNext DocType names: letters, digits, spaces, hyphens, underscores
const DOCTYPE_NAME_RE = /^[\w -]+$/;

export function validateDocTypeName(name: string, label: string): void {
  if (!DOCTYPE_NAME_RE.test(name)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(name)}`);
  }
}

export function validateFieldName(name: string, label: string): void {
  if (!FIELD_NAME_RE.test(name)) {
    throw new Error(`Invalid field name in ${label}: ${JSON.stringify(name)}`);
  }
}

export function validateChildFilter(filter: unknown): asserts filter is [string, string, unknown] {
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

/**
 * Raw input from MCP tool arguments — values may be JSON strings due to
 * MCP SDK serialization. Coerced to typed values in buildChildQueryArgs.
 */
export interface ChildQueryArgs {
  parentDoctype: string;
  childDoctype: string;
  parentFields?: unknown;
  childFields?: unknown;
  childFilters?: unknown;
  parentFilters?: unknown;
  limit?: unknown;
}

export const DEFAULT_LIMIT = 100;

/**
 * Convert {field: value} filter object to Frappe 4-tuple filter list.
 * Values can be scalars (implies "=" operator) or [operator, value] arrays.
 */
function parentFiltersToTuples(
  doctype: string,
  filters: AnyRecord,
): Array<[string, string, string, unknown]> {
  return Object.entries(filters).map(([field, value]) => {
    validateFieldName(field, "parent_filters field");
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string") {
      return [doctype, field, value[0], value[1]];
    }
    return [doctype, field, "=", value];
  });
}

/**
 * Build the args object for frappe.client.get_list to query child table rows
 * via a parent-child join.
 */
export function buildChildQueryArgs(input: ChildQueryArgs): AnyRecord {
  validateDocTypeName(input.parentDoctype, "parent_doctype");
  validateDocTypeName(input.childDoctype, "child_doctype");

  const coercedParentFields = coerceStringArray(input.parentFields);
  const resolvedParentFields =
    coercedParentFields && coercedParentFields.length > 0 ? coercedParentFields : ["name"];
  resolvedParentFields.forEach((f) => validateFieldName(f, "parent_fields"));

  const resolvedChildFields = coerceStringArray(input.childFields) || [];
  resolvedChildFields.forEach((f) => validateFieldName(f, "child_fields"));

  const coercedChildFilters = coerceFilterArray(input.childFilters);
  if (coercedChildFilters) {
    coercedChildFilters.forEach((filter) => {
      validateChildFilter(filter);
      validateFieldName(filter[0], "child_filters field");
    });
  }

  const coercedParentFilters = coerceObject(input.parentFilters);
  const coercedLimit = coerceNumber(input.limit);

  // Frappe convention: database table name is `tab{DocType}`
  const childTable = `tab${input.childDoctype}`;
  const fields: string[] = [
    ...resolvedParentFields,
    ...resolvedChildFields.map((f) => `\`${childTable}\`.${f}`),
  ];

  const childFilterTuples: Array<[string, string, string, unknown]> = (
    coercedChildFilters || []
  ).map(([field, op, value]) => [input.childDoctype, field, op, value]);

  const parentFilterTuples = coercedParentFilters
    ? parentFiltersToTuples(input.parentDoctype, coercedParentFilters)
    : [];

  const allFilters = [...childFilterTuples, ...parentFilterTuples];

  const args: AnyRecord = {
    doctype: input.parentDoctype,
    fields,
    limit_page_length: coercedLimit ?? DEFAULT_LIMIT,
  };
  if (allFilters.length) args.filters = allFilters;

  return args;
}
