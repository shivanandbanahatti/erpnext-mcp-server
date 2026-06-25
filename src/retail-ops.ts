/**
 * Retail Ops MCP tools — production tracking, delivery gates, and retail reports.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { extractErrorDetail } from "./errors.js";

export const RETAIL_OPS_MODULE = "Retail Ops";

export const RETAIL_OPS_PARENT_DOCTYPES = ["Production Order Tracker"] as const;

export const RETAIL_OPS_CHILD_DOCTYPES = ["Montage Crew Member"] as const;

export const RETAIL_OPS_DOCTYPES = [
  ...RETAIL_OPS_PARENT_DOCTYPES,
  ...RETAIL_OPS_CHILD_DOCTYPES,
] as const;

export const RETAIL_OPS_EXTENDED_DOCTYPES = [
  "Sales Order",
  "Quality Inspection",
  "Delivery Trip",
  "Issue",
  "Payment Entry",
] as const;

export const RETAIL_OPS_REPORTS = [
  "Sales by Month & Business Line",
  "Outstanding Balances",
  "Cashbox Bank Balances",
  "Expenses by Category",
  "Production Status",
  "Delivery Calendar",
  "Ready Stock Inventory",
] as const;

export const RETAIL_OPS_API_METHODS = {
  checkDeliveryGate: "retail_ops.api.mcp.check_delivery_gate",
  getSalesOrderReadiness: "retail_ops.api.mcp.get_sales_order_readiness",
  getTrackerForSalesOrder: "retail_ops.api.mcp.get_tracker_for_sales_order",
  listReports: "retail_ops.api.mcp.list_retail_ops_reports",
  getInfo: "retail_ops.api.mcp.get_retail_ops_info",
} as const;

export type RetailOpsDoctype = (typeof RETAIL_OPS_DOCTYPES)[number];

export interface RetailOpsApiClient {
  callMethod(
    method: string,
    args?: Record<string, unknown>,
    httpMethod?: "GET" | "POST",
  ): Promise<unknown>;
}

export interface RetailOpsListClient extends RetailOpsApiClient {
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
  runReport(reportName: string, filters?: Record<string, unknown>): Promise<unknown>;
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

export function isRetailOpsDoctype(doctype: string): doctype is RetailOpsDoctype {
  return (RETAIL_OPS_DOCTYPES as readonly string[]).includes(doctype);
}

export function assertWritableRetailOpsDoctype(doctype: string): void {
  if (!isRetailOpsDoctype(doctype)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `doctype must be one of: ${RETAIL_OPS_DOCTYPES.join(", ")}`,
    );
  }
  if ((RETAIL_OPS_CHILD_DOCTYPES as readonly string[]).includes(doctype)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${doctype} is a child table — create/update rows via the Delivery Trip montage_crew child table.`,
    );
  }
}

export const RETAIL_OPS_TOOLS = [
  {
    name: "get_retail_ops_info",
    description:
      "Retail Ops: module metadata — app doctypes, workflow name, QC template, and whitelisted API methods.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_retail_ops_doctypes",
    description:
      "Retail Ops: list DocTypes in the retail_ops app (Production Order Tracker, Montage Crew Member) plus extended ERPNext DocTypes with custom fields.",
    inputSchema: {
      type: "object",
      properties: {
        include_child_tables: {
          type: "boolean",
          description: "Include child table DocTypes (default true)",
        },
        include_extended: {
          type: "boolean",
          description: "Include Sales Order, Quality Inspection, Delivery Trip, Issue, Payment Entry (default true)",
        },
      },
    },
  },
  {
    name: "get_retail_ops_doctype_fields",
    description:
      "Retail Ops: get field definitions for a Retail Ops or extended DocType (includes custom fields after migrate).",
    inputSchema: {
      type: "object",
      properties: {
        doctype: {
          type: "string",
          description:
            "e.g. Production Order Tracker, Sales Order, Delivery Trip, Quality Inspection",
        },
      },
      required: ["doctype"],
    },
  },
  {
    name: "list_production_order_trackers",
    description:
      'Retail Ops: list Production Order Tracker documents. Filters e.g. {"production_status": "Ready", "business_line": "Cabinet"}.',
    inputSchema: {
      type: "object",
      properties: {
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
    },
  },
  {
    name: "get_production_order_tracker",
    description: "Retail Ops: get a Production Order Tracker by name (e.g. PROD-00001).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Production Order Tracker name",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_production_order_tracker",
    description:
      "Retail Ops: create a Production Order Tracker. Required: linked_sales_order, business_line (Soft|Cabinet), responsible_person, expected_ready_date.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          additionalProperties: true,
          description: "Document fields as JSON object",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "update_production_order_tracker",
    description:
      "Retail Ops: update a Production Order Tracker. Workflow drives production_status transitions.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Production Order Tracker name" },
        data: {
          type: "object",
          additionalProperties: true,
          description: "Fields to update",
        },
      },
      required: ["name", "data"],
    },
  },
  {
    name: "get_tracker_for_sales_order",
    description:
      "Retail Ops: fetch the Production Order Tracker linked to a Sales Order, if any.",
    inputSchema: {
      type: "object",
      properties: {
        sales_order: { type: "string", description: "Sales Order name" },
      },
      required: ["sales_order"],
    },
  },
  {
    name: "get_sales_order_readiness",
    description:
      "Retail Ops: check payment cleared, production Ready, and QC Accepted for a Sales Order before delivery.",
    inputSchema: {
      type: "object",
      properties: {
        sales_order: { type: "string", description: "Sales Order name" },
      },
      required: ["sales_order"],
    },
  },
  {
    name: "check_delivery_gate",
    description:
      "Retail Ops: dry-run delivery gate for a Delivery Trip (outstanding payment, production Ready, QC Accepted) without submitting.",
    inputSchema: {
      type: "object",
      properties: {
        delivery_trip: { type: "string", description: "Delivery Trip name" },
      },
      required: ["delivery_trip"],
    },
  },
  {
    name: "list_retail_ops_reports",
    description:
      "Retail Ops: list all Retail Ops reports with filter keys and extended DocType custom fields.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "run_retail_ops_report",
    description:
      "Retail Ops: run a Retail Ops report by name. Production Status filters: production_status, business_line, from_date, to_date. Sales by Month: from_date, to_date, business_line.",
    inputSchema: {
      type: "object",
      properties: {
        report_name: {
          type: "string",
          description: `One of: ${RETAIL_OPS_REPORTS.join(", ")}`,
        },
        filters: {
          type: "object",
          additionalProperties: true,
          description: "Report filters object",
        },
      },
      required: ["report_name"],
    },
  },
] as const;

export async function handleRetailOpsTool(
  toolName: string,
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult | null> {
  switch (toolName) {
    case "get_retail_ops_info":
      return handleGetInfo(client);
    case "get_retail_ops_doctypes":
      return handleGetDoctypes(args, client);
    case "get_retail_ops_doctype_fields":
      return handleGetDoctypeFields(args, client);
    case "list_production_order_trackers":
      return handleListTrackers(args, client);
    case "get_production_order_tracker":
      return handleGetTracker(args, client);
    case "create_production_order_tracker":
      return handleCreateTracker(args, client);
    case "update_production_order_tracker":
      return handleUpdateTracker(args, client);
    case "get_tracker_for_sales_order":
      return handleGetTrackerForSalesOrder(args, client);
    case "get_sales_order_readiness":
      return handleGetSalesOrderReadiness(args, client);
    case "check_delivery_gate":
      return handleCheckDeliveryGate(args, client);
    case "list_retail_ops_reports":
      return handleListReports(client);
    case "run_retail_ops_report":
      return handleRunReport(args, client);
    default:
      return null;
  }
}

async function handleGetInfo(client: RetailOpsApiClient): Promise<ToolResult> {
  try {
    const result = await client.callMethod(RETAIL_OPS_API_METHODS.getInfo, {}, "GET");
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to get Retail Ops info: ${extractErrorDetail(error)}`);
  }
}

async function handleGetDoctypes(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
  const includeChild = args?.include_child_tables !== false;
  const includeExtended = args?.include_extended !== false;

  try {
    const live = await client.getAllDocTypes({ module: RETAIL_OPS_MODULE });
    const known = includeChild
      ? [...RETAIL_OPS_DOCTYPES]
      : [...RETAIL_OPS_PARENT_DOCTYPES];
    const merged = [...new Set([...known, ...live])].sort();
    return toolText({
      module: RETAIL_OPS_MODULE,
      count: merged.length,
      parent_doctypes: RETAIL_OPS_PARENT_DOCTYPES,
      child_doctypes: RETAIL_OPS_CHILD_DOCTYPES,
      doctypes: merged,
      extended_doctypes: includeExtended ? [...RETAIL_OPS_EXTENDED_DOCTYPES] : [],
      workflow: "Production Status Flow",
      qc_template: "Retail Furniture QC",
    });
  } catch (error: unknown) {
    return toolError(`Failed to list Retail Ops DocTypes: ${extractErrorDetail(error)}`);
  }
}

function isAllowedDoctypeForFields(doctype: string): boolean {
  return (
    isRetailOpsDoctype(doctype) ||
    (RETAIL_OPS_EXTENDED_DOCTYPES as readonly string[]).includes(doctype)
  );
}

async function handleGetDoctypeFields(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
  const doctype = args?.doctype;
  if (typeof doctype !== "string" || !doctype.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "doctype is required");
  }
  if (!isAllowedDoctypeForFields(doctype.trim())) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `doctype must be a Retail Ops or extended DocType`,
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

async function handleListTrackers(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
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
    const rows = await client.getDocList(
      "Production Order Tracker",
      filters,
      fields,
      limit,
    );
    return toolText({ doctype: "Production Order Tracker", count: rows.length, documents: rows });
  } catch (error: unknown) {
    return toolError(`Failed to list Production Order Trackers: ${extractErrorDetail(error)}`);
  }
}

async function handleGetTracker(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
  const name = args?.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }

  try {
    const doc = await client.getDocument("Production Order Tracker", name.trim());
    return toolText(doc);
  } catch (error: unknown) {
    return toolError(`Failed to get Production Order Tracker ${name}: ${extractErrorDetail(error)}`);
  }
}

async function handleCreateTracker(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
  const data = args?.data;
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new McpError(ErrorCode.InvalidParams, "data must be a JSON object");
  }

  try {
    const result = await client.createDocument(
      "Production Order Tracker",
      data as Record<string, unknown>,
    );
    return toolText({ doctype: "Production Order Tracker", created: result });
  } catch (error: unknown) {
    return toolError(`Failed to create Production Order Tracker: ${extractErrorDetail(error)}`);
  }
}

async function handleUpdateTracker(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
  const name = args?.name;
  const data = args?.data;
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new McpError(ErrorCode.InvalidParams, "data must be a JSON object");
  }

  try {
    const result = await client.updateDocument(
      "Production Order Tracker",
      name.trim(),
      data as Record<string, unknown>,
    );
    return toolText({ doctype: "Production Order Tracker", name: name.trim(), updated: result });
  } catch (error: unknown) {
    return toolError(
      `Failed to update Production Order Tracker ${name}: ${extractErrorDetail(error)}`,
    );
  }
}

async function handleGetTrackerForSalesOrder(
  args: Record<string, unknown> | undefined,
  client: RetailOpsApiClient,
): Promise<ToolResult> {
  const salesOrder = args?.sales_order;
  if (typeof salesOrder !== "string" || !salesOrder.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "sales_order is required");
  }

  try {
    const result = await client.callMethod(
      RETAIL_OPS_API_METHODS.getTrackerForSalesOrder,
      { sales_order: salesOrder.trim() },
      "GET",
    );
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to get tracker for Sales Order: ${extractErrorDetail(error)}`);
  }
}

async function handleGetSalesOrderReadiness(
  args: Record<string, unknown> | undefined,
  client: RetailOpsApiClient,
): Promise<ToolResult> {
  const salesOrder = args?.sales_order;
  if (typeof salesOrder !== "string" || !salesOrder.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "sales_order is required");
  }

  try {
    const result = await client.callMethod(
      RETAIL_OPS_API_METHODS.getSalesOrderReadiness,
      { sales_order: salesOrder.trim() },
      "GET",
    );
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to get Sales Order readiness: ${extractErrorDetail(error)}`);
  }
}

async function handleCheckDeliveryGate(
  args: Record<string, unknown> | undefined,
  client: RetailOpsApiClient,
): Promise<ToolResult> {
  const deliveryTrip = args?.delivery_trip;
  if (typeof deliveryTrip !== "string" || !deliveryTrip.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "delivery_trip is required");
  }

  try {
    const result = await client.callMethod(
      RETAIL_OPS_API_METHODS.checkDeliveryGate,
      { delivery_trip: deliveryTrip.trim() },
      "GET",
    );
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to check delivery gate: ${extractErrorDetail(error)}`);
  }
}

async function handleListReports(client: RetailOpsApiClient): Promise<ToolResult> {
  try {
    const result = await client.callMethod(RETAIL_OPS_API_METHODS.listReports, {}, "GET");
    return toolText(result);
  } catch (error: unknown) {
    return toolText({
      module: RETAIL_OPS_MODULE,
      reports: RETAIL_OPS_REPORTS.map((name) => ({ name })),
      note: "Live API unavailable; showing static report list",
    });
  }
}

async function handleRunReport(
  args: Record<string, unknown> | undefined,
  client: RetailOpsListClient,
): Promise<ToolResult> {
  const reportName = args?.report_name;
  if (typeof reportName !== "string" || !reportName.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "report_name is required");
  }
  if (!(RETAIL_OPS_REPORTS as readonly string[]).includes(reportName.trim())) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `report_name must be one of: ${RETAIL_OPS_REPORTS.join(", ")}`,
    );
  }

  let filters: Record<string, unknown> | undefined;
  if (args?.filters != null) {
    if (typeof args.filters !== "object" || Array.isArray(args.filters)) {
      throw new McpError(ErrorCode.InvalidParams, "filters must be a JSON object");
    }
    filters = args.filters as Record<string, unknown>;
  }

  try {
    const result = await client.runReport(reportName.trim(), filters);
    return toolText({ report_name: reportName.trim(), result });
  } catch (error: unknown) {
    return toolError(`Failed to run report ${reportName}: ${extractErrorDetail(error)}`);
  }
}
