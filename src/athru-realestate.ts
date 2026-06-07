/**
 * Athru Real Estate MCP tools — read/write all DocTypes in the athru_realestate app.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { extractErrorDetail } from "./errors.js";

export const ATHRU_REALESTATE_MODULE = "Athru Real Estate";

/** Parent and standalone DocTypes (readable/writable via REST). */
export const ATHRU_REALESTATE_PARENT_DOCTYPES = ["Property", "Real Estate Settings"] as const;

/** Child table DocTypes — rows are embedded on Property, not standalone REST resources. */
export const ATHRU_REALESTATE_CHILD_DOCTYPES = [
  "Property Unit Type",
  "Property Unit Media",
  "Property Image",
  "Property Amenity",
  "Property Bank Approval",
] as const;

export const ATHRU_REALESTATE_DOCTYPES = [
  ...ATHRU_REALESTATE_PARENT_DOCTYPES,
  ...ATHRU_REALESTATE_CHILD_DOCTYPES,
] as const;

export const ATHRU_REALESTATE_API_METHODS = {
  getPublishedProperties: "athru_realestate.api.property.get_published_properties",
  getPropertyDetail: "athru_realestate.api.property.get_property_detail",
} as const;

export type AthruRealestateDoctype = (typeof ATHRU_REALESTATE_DOCTYPES)[number];

export interface AthruRealestateApiClient {
  callMethod(
    method: string,
    args?: Record<string, unknown>,
    httpMethod?: "GET" | "POST",
  ): Promise<unknown>;
}

export interface AthruRealestateListClient extends AthruRealestateApiClient {
  getDocList(
    doctype: string,
    filters?: Record<string, unknown>,
    fields?: string[],
    limit?: number,
  ): Promise<unknown[]>;
  getDocument(doctype: string, name: string): Promise<unknown>;
  createDocument(doctype: string, doc: Record<string, unknown>): Promise<unknown>;
  updateDocument(
    doctype: string,
    name: string,
    doc: Record<string, unknown>,
  ): Promise<unknown>;
  getAllDocTypes(options?: {
    search?: string;
    module?: string;
    custom_only?: boolean;
  }): Promise<string[]>;
  getDocTypeMeta(doctype: string): Promise<unknown>;
}

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function toolText(data: unknown, isError = false): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function toolError(message: string): ToolResult {
  return toolText({ error: message }, true);
}

export function isAthruRealestateDoctype(doctype: string): doctype is AthruRealestateDoctype {
  return (ATHRU_REALESTATE_DOCTYPES as readonly string[]).includes(doctype);
}

export function assertWritableDoctype(doctype: string): void {
  if (!isAthruRealestateDoctype(doctype)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `doctype must be one of: ${ATHRU_REALESTATE_DOCTYPES.join(", ")}`,
    );
  }
  if ((ATHRU_REALESTATE_CHILD_DOCTYPES as readonly string[]).includes(doctype)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${doctype} is a child table — create/update rows via the Property document's child table fields (unit_configurations, unit_media, gallery_images, amenities, approved_banks).`,
    );
  }
}

export const ATHRU_REALESTATE_TOOLS = [
  {
    name: "get_athru_realestate_doctypes",
    description:
      "Athru Real Estate: list all DocTypes in the athru_realestate app (Property, Real Estate Settings, and child tables).",
    inputSchema: {
      type: "object",
      properties: {
        include_child_tables: {
          type: "boolean",
          description: "Include child table DocTypes (default true)",
        },
      },
    },
  },
  {
    name: "get_athru_realestate_doctype_fields",
    description:
      "Athru Real Estate: get field definitions for a DocType in this app (fieldname, fieldtype, label, options, reqd).",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: `DocType name, e.g. Property, Real Estate Settings`,
        },
      },
      required: ["doctype"],
    },
  },
  {
    name: "list_athru_realestate_documents",
    description:
      "Athru Real Estate: list documents for Property or Real Estate Settings. Use filters like {\"show_online\": 1} or {\"city\": \"Bangalore\"}.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: "Property or Real Estate Settings",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Fields to return (optional)",
        },
        filters: {
          type: "object",
          additionalProperties: true,
          description: "ERPNext filters object",
        },
        limit: {
          type: "number",
          description: "Max rows (default 20)",
        },
      },
      required: ["doctype"],
    },
  },
  {
    name: "get_athru_realestate_document",
    description:
      "Athru Real Estate: get a single document by doctype and name. Property documents include all child tables.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: "Property or Real Estate Settings",
        },
        name: {
          type: "string",
          description: "Document name (e.g. PROP-2026-0001 or Real Estate Settings)",
        },
      },
      required: ["doctype", "name"],
    },
  },
  {
    name: "create_athru_realestate_document",
    description:
      "Athru Real Estate: create a Property or Real Estate Settings document. For Property, include child table arrays (unit_configurations, gallery_images, amenities, etc.) in data.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: "Property or Real Estate Settings",
        },
        data: {
          type: "object",
          additionalProperties: true,
          description: "Document fields as JSON object",
        },
      },
      required: ["doctype", "data"],
    },
  },
  {
    name: "update_athru_realestate_document",
    description:
      "Athru Real Estate: update a Property or Real Estate Settings document. Pass only fields to change in data.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: "Property or Real Estate Settings",
        },
        name: {
          type: "string",
          description: "Document name",
        },
        data: {
          type: "object",
          additionalProperties: true,
          description: "Fields to update",
        },
      },
      required: ["doctype", "name", "data"],
    },
  },
  {
    name: "get_published_properties",
    description:
      "Athru Real Estate: list website-published properties (show_online=1) via whitelisted API. Optional filters: city, property_type, status, is_featured, listing_category, listing_intent.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          additionalProperties: true,
          description: 'e.g. {"city": "Bangalore", "listing_category": "Resale"}',
        },
      },
    },
  },
  {
    name: "get_property_by_slug",
    description:
      "Athru Real Estate: get a published Property by website slug (show_online=1), including child tables. Commission fields are stripped.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "URL slug e.g. premium-2bhk-whitefield",
        },
      },
      required: ["slug"],
    },
  },
] as const;

export async function handleAthruRealestateTool(
  toolName: string,
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult | null> {
  switch (toolName) {
    case "get_athru_realestate_doctypes":
      return handleGetDoctypes(args, client);
    case "get_athru_realestate_doctype_fields":
      return handleGetDoctypeFields(args, client);
    case "list_athru_realestate_documents":
      return handleListDocuments(args, client);
    case "get_athru_realestate_document":
      return handleGetDocument(args, client);
    case "create_athru_realestate_document":
      return handleCreateDocument(args, client);
    case "update_athru_realestate_document":
      return handleUpdateDocument(args, client);
    case "get_published_properties":
      return handleGetPublishedProperties(args, client);
    case "get_property_by_slug":
      return handleGetPropertyBySlug(args, client);
    default:
      return null;
  }
}

async function handleGetDoctypes(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult> {
  const includeChild = args?.include_child_tables !== false;

  try {
    const live = await client.getAllDocTypes({ module: ATHRU_REALESTATE_MODULE });
    const known = includeChild
      ? [...ATHRU_REALESTATE_DOCTYPES]
      : [...ATHRU_REALESTATE_PARENT_DOCTYPES];
    const merged = [...new Set([...known, ...live])].sort();
    return toolText({
      module: ATHRU_REALESTATE_MODULE,
      count: merged.length,
      parent_doctypes: ATHRU_REALESTATE_PARENT_DOCTYPES,
      child_doctypes: ATHRU_REALESTATE_CHILD_DOCTYPES,
      doctypes: merged,
    });
  } catch (error: unknown) {
    return toolError(`Failed to list Athru Real Estate DocTypes: ${extractErrorDetail(error)}`);
  }
}

async function handleGetDoctypeFields(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (!isAthruRealestateDoctype(doctype.trim())) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `doctype must be one of: ${ATHRU_REALESTATE_DOCTYPES.join(", ")}`,
    );
  }

  try {
    const meta = (await client.getDocTypeMeta(doctype.trim())) as {
      fields?: Array<Record<string, unknown>>;
    };
    const fields = (meta.fields || []).map((f) => ({
      fieldname: f.fieldname,
      fieldtype: f.fieldtype,
      label: f.label,
      options: f.options,
      reqd: f.reqd,
      read_only: f.read_only,
      depends_on: f.depends_on,
    }));
    return toolText({ doctype: doctype.trim(), field_count: fields.length, fields });
  } catch (error: unknown) {
    return toolError(`Failed to get fields for ${doctype}: ${extractErrorDetail(error)}`);
  }
}

async function handleListDocuments(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  assertWritableDoctype(doctype.trim());

  let fields: string[] | undefined;
  if (Array.isArray(args?.fields)) {
    fields = args.fields.filter((f): f is string => typeof f === "string");
  }

  let filters: Record<string, unknown> | undefined;
  if (args?.filters != null) {
    if (typeof args.filters !== "object" || Array.isArray(args.filters)) {
      throw new McpError(ErrorCode.InvalidParams, "filters must be a JSON object");
    }
    filters = args.filters as Record<string, unknown>;
  }

  const limit = typeof args?.limit === "number" ? args.limit : 20;

  try {
    const rows = await client.getDocList(doctype.trim(), filters, fields, limit);
    return toolText({ doctype: doctype.trim(), count: rows.length, documents: rows });
  } catch (error: unknown) {
    return toolError(`Failed to list ${doctype}: ${extractErrorDetail(error)}`);
  }
}

async function handleGetDocument(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  const name = args?.name;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }
  assertWritableDoctype(doctype.trim());

  try {
    const doc = await client.getDocument(doctype.trim(), name.trim());
    return toolText(doc);
  } catch (error: unknown) {
    return toolError(`Failed to get ${doctype} ${name}: ${extractErrorDetail(error)}`);
  }
}

async function handleCreateDocument(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  const data = args?.data;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new McpError(ErrorCode.InvalidParams, "data must be a JSON object");
  }
  assertWritableDoctype(doctype.trim());

  try {
    const result = await client.createDocument(doctype.trim(), data as Record<string, unknown>);
    return toolText({ doctype: doctype.trim(), created: result });
  } catch (error: unknown) {
    return toolError(`Failed to create ${doctype}: ${extractErrorDetail(error)}`);
  }
}

async function handleUpdateDocument(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  const name = args?.name;
  const data = args?.data;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new McpError(ErrorCode.InvalidParams, "data must be a JSON object");
  }
  assertWritableDoctype(doctype.trim());

  try {
    const result = await client.updateDocument(
      doctype.trim(),
      name.trim(),
      data as Record<string, unknown>,
    );
    return toolText({ doctype: doctype.trim(), name: name.trim(), updated: result });
  } catch (error: unknown) {
    return toolError(`Failed to update ${doctype} ${name}: ${extractErrorDetail(error)}`);
  }
}

async function handleGetPublishedProperties(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateApiClient,
): Promise<ToolResult> {
  const methodArgs: Record<string, unknown> = {};
  if (args?.filters != null) {
    if (typeof args.filters !== "object" || Array.isArray(args.filters)) {
      throw new McpError(ErrorCode.InvalidParams, "filters must be a JSON object");
    }
    methodArgs.filters = JSON.stringify(args.filters);
  }

  try {
    const result = await client.callMethod(
      ATHRU_REALESTATE_API_METHODS.getPublishedProperties,
      methodArgs,
      "GET",
    );
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to get published properties: ${extractErrorDetail(error)}`);
  }
}

async function handleGetPropertyBySlug(
  args: Record<string, unknown> | undefined,
  client: AthruRealestateApiClient,
): Promise<ToolResult> {
  const slug = args?.slug;
  if (typeof slug !== "string" || !slug.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "slug is required");
  }

  try {
    const result = await client.callMethod(
      ATHRU_REALESTATE_API_METHODS.getPropertyDetail,
      { slug: slug.trim() },
      "GET",
    );
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to get property by slug: ${extractErrorDetail(error)}`);
  }
}
