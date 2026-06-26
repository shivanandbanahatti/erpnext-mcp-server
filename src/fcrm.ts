/**
 * Frappe CRM (FCRM) MCP tools — leads, deals, organizations, tasks, and related documents.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { extractErrorDetail } from "./errors.js";

export const FCRM_MODULE = "FCRM";

/** Primary transactional DocTypes agents should create/update via MCP. */
export const FCRM_WRITABLE_DOCTYPES = [
  "CRM Lead",
  "CRM Deal",
  "CRM Organization",
  "CRM Task",
  "FCRM Note",
  "CRM Call Log",
] as const;

/** Common master DocTypes — readable via MCP, not writable by default. */
export const FCRM_MASTER_DOCTYPES = [
  "CRM Lead Status",
  "CRM Deal Status",
  "CRM Lead Source",
  "CRM Lost Reason",
  "CRM Industry",
  "CRM Territory",
  "CRM Product",
] as const;

/** Settings / layout DocTypes — excluded from MCP writes (read via generic tools if needed). */
export const FCRM_SETTINGS_DOCTYPES = [
  "FCRM Settings",
  "CRM Global Settings",
  "ERPNext CRM Settings",
  "CRM Twilio Settings",
  "CRM Exotel Settings",
  "CRM Form Script",
  "CRM Fields Layout",
  "CRM View Settings",
  "CRM Dashboard",
  "CRM Service Level Agreement",
  "CRM Sales Hierarchy",
  "CRM Communication Status",
  "CRM Notification",
  "CRM Invitation",
  "CRM Holiday List",
  "CRM Telephony Agent",
] as const;

export const FCRM_PRIMARY_DOCTYPES = [...FCRM_WRITABLE_DOCTYPES] as const;

export type FcrmWritableDoctype = (typeof FCRM_WRITABLE_DOCTYPES)[number];

export interface FcrmListClient {
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

const ALL_KNOWN_FCRM = new Set<string>([
  ...FCRM_WRITABLE_DOCTYPES,
  ...FCRM_MASTER_DOCTYPES,
  ...FCRM_SETTINGS_DOCTYPES,
]);

export function isFcrmWritableDoctype(doctype: string): doctype is FcrmWritableDoctype {
  return (FCRM_WRITABLE_DOCTYPES as readonly string[]).includes(doctype);
}

export function isFcrmKnownDoctype(doctype: string): boolean {
  return ALL_KNOWN_FCRM.has(doctype);
}

export function assertReadableFcrmDoctype(doctype: string, liveDoctypes?: string[]): void {
  const trimmed = doctype.trim();
  if (!trimmed) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (isFcrmKnownDoctype(trimmed)) {
    return;
  }
  if (liveDoctypes?.includes(trimmed)) {
    return;
  }
  throw new McpError(
    ErrorCode.InvalidParams,
    `doctype must be an FCRM DocType (module ${FCRM_MODULE}). Use get_fcrm_doctypes to list available types.`,
  );
}

export function assertWritableFcrmDoctype(doctype: string): void {
  const trimmed = doctype.trim();
  if (!isFcrmWritableDoctype(trimmed)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `doctype must be one of: ${FCRM_WRITABLE_DOCTYPES.join(", ")}`,
    );
  }
}

export const FCRM_TOOLS = [
  {
    name: "get_fcrm_info",
    description:
      "Frappe CRM (FCRM): module metadata — primary DocTypes, masters, and whitelisted read/write scope.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_fcrm_doctypes",
    description:
      "Frappe CRM: list DocTypes in the FCRM module (live from site + known static list).",
    inputSchema: {
      type: "object",
      properties: {
        include_settings: {
          type: "boolean",
          description: "Include settings/layout DocTypes (default false)",
        },
        include_masters: {
          type: "boolean",
          description: "Include master DocTypes like CRM Lead Status (default true)",
        },
      },
    },
  },
  {
    name: "get_fcrm_doctype_fields",
    description:
      "Frappe CRM: field definitions for an FCRM DocType (CRM Lead, CRM Deal, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: "e.g. CRM Lead, CRM Deal, CRM Organization, CRM Task",
        },
      },
      required: ["doctype"],
    },
  },
  {
    name: "list_fcrm_documents",
    description:
      'Frappe CRM: list documents for an FCRM DocType. Example filters: {"status": "Qualified"} on CRM Lead.',
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description: "FCRM DocType name, e.g. CRM Lead, CRM Deal",
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
    name: "get_fcrm_document",
    description: "Frappe CRM: get a single FCRM document by DocType and name.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "FCRM DocType name" },
        name: { type: "string", description: "Document name/ID" },
      },
      required: ["doctype", "name"],
    },
  },
  {
    name: "create_fcrm_document",
    description:
      "Frappe CRM: create a document. Writable: CRM Lead, CRM Deal, CRM Organization, CRM Task, FCRM Note, CRM Call Log.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "Writable FCRM DocType" },
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
    name: "update_fcrm_document",
    description:
      "Frappe CRM: update an existing document. Writable: CRM Lead, CRM Deal, CRM Organization, CRM Task, FCRM Note, CRM Call Log.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "Writable FCRM DocType" },
        name: { type: "string", description: "Document name/ID" },
        data: {
          type: "object",
          additionalProperties: true,
          description: "Fields to update",
        },
      },
      required: ["doctype", "name", "data"],
    },
  },
] as const;

export async function handleFcrmTool(
  toolName: string,
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
): Promise<ToolResult | null> {
  switch (toolName) {
    case "get_fcrm_info":
      return handleGetInfo();
    case "get_fcrm_doctypes":
      return handleGetDoctypes(args, client);
    case "get_fcrm_doctype_fields":
      return handleGetDoctypeFields(args, client);
    case "list_fcrm_documents":
      return handleListDocuments(args, client);
    case "get_fcrm_document":
      return handleGetDocument(args, client);
    case "create_fcrm_document":
      return handleCreateDocument(args, client);
    case "update_fcrm_document":
      return handleUpdateDocument(args, client);
    default:
      return null;
  }
}

function handleGetInfo(): ToolResult {
  return toolText({
    app: "crm",
    module: FCRM_MODULE,
    primary_doctypes: [...FCRM_PRIMARY_DOCTYPES],
    writable_doctypes: [...FCRM_WRITABLE_DOCTYPES],
    master_doctypes: [...FCRM_MASTER_DOCTYPES],
    settings_doctypes: [...FCRM_SETTINGS_DOCTYPES],
    notes: [
      "Requires the crm app installed on the target site.",
      "API user needs read/write on the target DocTypes (CRM roles or System Manager).",
      "Use list_fcrm_documents / get_fcrm_document for reads; create_fcrm_document / update_fcrm_document for writes.",
    ],
  });
}

async function handleGetDoctypes(
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
): Promise<ToolResult> {
  const includeSettings = args?.include_settings === true;
  const includeMasters = args?.include_masters !== false;

  try {
    const live = await client.getAllDocTypes({ module: FCRM_MODULE });
    const staticList = [
      ...FCRM_WRITABLE_DOCTYPES,
      ...(includeMasters ? FCRM_MASTER_DOCTYPES : []),
      ...(includeSettings ? FCRM_SETTINGS_DOCTYPES : []),
    ];
    const merged = [...new Set([...staticList, ...live])].sort();
    return toolText({
      module: FCRM_MODULE,
      count: merged.length,
      writable_doctypes: [...FCRM_WRITABLE_DOCTYPES],
      master_doctypes: includeMasters ? [...FCRM_MASTER_DOCTYPES] : [],
      settings_doctypes: includeSettings ? [...FCRM_SETTINGS_DOCTYPES] : [],
      doctypes: merged,
    });
  } catch (error: unknown) {
    return toolText({
      module: FCRM_MODULE,
      writable_doctypes: [...FCRM_WRITABLE_DOCTYPES],
      master_doctypes: [...FCRM_MASTER_DOCTYPES],
      doctypes: [...FCRM_WRITABLE_DOCTYPES, ...FCRM_MASTER_DOCTYPES],
      note: "Live API unavailable; showing static FCRM DocType list",
      error: extractErrorDetail(error),
    });
  }
}

async function resolveLiveFcrmDoctypes(client: FcrmListClient): Promise<string[]> {
  try {
    return await client.getAllDocTypes({ module: FCRM_MODULE });
  } catch {
    return [...ALL_KNOWN_FCRM];
  }
}

async function handleGetDoctypeFields(
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }

  const live = await resolveLiveFcrmDoctypes(client);
  assertReadableFcrmDoctype(doctype, live);

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

function parseListArgs(args: Record<string, unknown> | undefined): {
  fields?: string[];
  filters?: Record<string, unknown>;
  limit: number;
} {
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
  return { fields, filters, limit };
}

async function handleListDocuments(
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }

  const live = await resolveLiveFcrmDoctypes(client);
  assertReadableFcrmDoctype(doctype, live);
  const { fields, filters, limit } = parseListArgs(args);

  try {
    const rows = await client.getDocList(doctype.trim(), filters, fields, limit);
    return toolText({ doctype: doctype.trim(), count: rows.length, documents: rows });
  } catch (error: unknown) {
    return toolError(`Failed to list ${doctype} documents: ${extractErrorDetail(error)}`);
  }
}

async function handleGetDocument(
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  const name = args?.name;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }

  const live = await resolveLiveFcrmDoctypes(client);
  assertReadableFcrmDoctype(doctype, live);

  try {
    const doc = await client.getDocument(doctype.trim(), name.trim());
    return toolText(doc);
  } catch (error: unknown) {
    return toolError(`Failed to get ${doctype} ${name}: ${extractErrorDetail(error)}`);
  }
}

async function handleCreateDocument(
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  const data = args?.data;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new McpError(ErrorCode.InvalidParams, "data must be a JSON object");
  }

  assertWritableFcrmDoctype(doctype);

  try {
    const result = await client.createDocument(
      doctype.trim(),
      data as Record<string, unknown>,
    );
    return toolText({ doctype: doctype.trim(), created: result });
  } catch (error: unknown) {
    return toolError(`Failed to create ${doctype}: ${extractErrorDetail(error)}`);
  }
}

async function handleUpdateDocument(
  args: Record<string, unknown> | undefined,
  client: FcrmListClient,
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

  assertWritableFcrmDoctype(doctype);

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
