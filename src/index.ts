#!/usr/bin/env node

/**
 * ERPNext MCP Server
 * This server provides integration with the ERPNext/Frappe API, allowing:
 * - Authentication with ERPNext
 * - Fetching documents from ERPNext
 * - Querying lists of documents
 * - Creating and updating documents
 * - Running reports
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { buildChildQueryArgs } from "./child-query.js";
import { coerceStringArray, coerceObject, coerceNumber } from "./coerce.js";
import { stripDocument } from "./strip.js";

type AnyRecord = Record<string, any>;

class ERPNextClient {
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private authenticated: boolean = false;

  constructor() {
    this.baseUrl = process.env.ERPNEXT_URL || "";

    if (!this.baseUrl) {
      throw new Error("ERPNEXT_URL environment variable is required");
    }

    this.baseUrl = this.baseUrl.replace(/\/$/, "");

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const apiKey = process.env.ERPNEXT_API_KEY;
    const apiSecret = process.env.ERPNEXT_API_SECRET;

    if (apiKey && apiSecret) {
      this.axiosInstance.defaults.headers.common["Authorization"] = `token ${apiKey}:${apiSecret}`;
      this.authenticated = true;
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async getDocument(doctype: string, name: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to get ${doctype} ${name}: ${error?.message || "Unknown error"}`);
    }
  }

  async getDocList(
    doctype: string,
    filters?: AnyRecord,
    fields?: string[],
    limit?: number,
  ): Promise<any[]> {
    try {
      const params: AnyRecord = {};

      if (fields && fields.length) {
        params["fields"] = JSON.stringify(fields);
      }

      if (filters) {
        params["filters"] = JSON.stringify(filters);
      }

      if (limit) {
        params["limit_page_length"] = limit;
      }

      const response = await this.axiosInstance.get(
        `/api/resource/${encodeURIComponent(doctype)}`,
        { params },
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to get ${doctype} list: ${error?.message || "Unknown error"}`);
    }
  }

  async getChildDocList(
    parentDoctype: string,
    childDoctype: string,
    parentFields?: unknown,
    childFields?: unknown,
    childFilters?: unknown,
    parentFilters?: unknown,
    limit?: unknown,
  ): Promise<any[]> {
    const args = buildChildQueryArgs({
      parentDoctype,
      childDoctype,
      parentFields,
      childFields,
      childFilters,
      parentFilters,
      limit,
    });
    const result = await this.callMethod("frappe.client.get_list", args);
    return result || [];
  }

  async createDocument(doctype: string, doc: AnyRecord): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/api/resource/${encodeURIComponent(doctype)}`,
        { data: doc },
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to create ${doctype}: ${error?.message || "Unknown error"}`);
    }
  }

  async updateDocument(doctype: string, name: string, doc: AnyRecord): Promise<any> {
    try {
      const response = await this.axiosInstance.put(
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
        { data: doc },
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to update ${doctype} ${name}: ${error?.message || "Unknown error"}`);
    }
  }

  async runReport(reportName: string, filters?: AnyRecord): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/api/method/frappe.desk.query_report.run`, {
        params: {
          report_name: reportName,
          filters: filters ? JSON.stringify(filters) : undefined,
        },
      });
      return response.data.message;
    } catch (error: any) {
      throw new Error(`Failed to run report ${reportName}: ${error?.message || "Unknown error"}`);
    }
  }

  async callMethod(
    method: string,
    args?: AnyRecord,
    httpMethod: "GET" | "POST" = "POST",
  ): Promise<any> {
    if (!/^[\w.]+$/.test(method)) {
      throw new Error(`Invalid method path: ${method}`);
    }
    try {
      const response =
        httpMethod === "GET"
          ? await this.axiosInstance.get(`/api/method/${method}`, { params: args })
          : await this.axiosInstance.post(`/api/method/${method}`, args);
      return response.data.message;
    } catch (error: any) {
      throw new Error(`Failed to call method ${method}: ${error?.message || "Unknown error"}`);
    }
  }

  async getAllDocTypes(): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get("/api/resource/DocType", {
        params: {
          fields: JSON.stringify(["name"]),
          limit_page_length: 500,
        },
      });

      if (response.data && response.data.data) {
        return response.data.data.map((item: any) => item.name);
      }

      return [];
    } catch (error: any) {
      console.error("Failed to get DocTypes:", error?.message || "Unknown error");

      try {
        const altResponse = await this.axiosInstance.get(
          "/api/method/frappe.desk.search.search_link",
          {
            params: {
              doctype: "DocType",
              txt: "",
              limit: 500,
            },
          },
        );

        if (altResponse.data && altResponse.data.results) {
          return altResponse.data.results.map((item: any) => item.value);
        }

        return [];
      } catch (altError: any) {
        console.error("Alternative DocType fetch failed:", altError?.message || "Unknown error");

        return [
          "Customer",
          "Supplier",
          "Item",
          "Sales Order",
          "Purchase Order",
          "Sales Invoice",
          "Purchase Invoice",
          "Employee",
          "Lead",
          "Opportunity",
          "Quotation",
          "Payment Entry",
          "Journal Entry",
          "Stock Entry",
        ];
      }
    }
  }

  async getDocTypeMeta(doctype: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/api/resource/DocType/${encodeURIComponent(doctype)}`,
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(
        `Failed to get DocType metadata for ${doctype}: ${error?.message || "Unknown error"}`,
      );
    }
  }
}

const erpnext = new ERPNextClient();

const server = new Server(
  {
    name: "erpnext-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    {
      uri: "erpnext://DocTypes",
      name: "All DocTypes",
      mimeType: "application/json",
      description: "List of all available DocTypes in the ERPNext instance",
    },
  ];

  return { resources };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  const resourceTemplates = [
    {
      uriTemplate: "erpnext://{doctype}/{name}",
      name: "ERPNext Document",
      mimeType: "application/json",
      description: "Fetch an ERPNext document by doctype and name",
    },
  ];

  return { resourceTemplates };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (!erpnext.isAuthenticated()) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Not authenticated with ERPNext. Please configure API key authentication.",
    );
  }

  const uri = request.params.uri;
  let result: any;

  if (uri === "erpnext://DocTypes") {
    try {
      const doctypes = await erpnext.getAllDocTypes();
      result = { doctypes };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch DocTypes: ${error?.message || "Unknown error"}`,
      );
    }
  } else {
    const documentMatch = uri.match(/^erpnext:\/\/([^/]+)\/(.+)$/);
    if (documentMatch) {
      const doctype = decodeURIComponent(documentMatch[1]);
      const name = decodeURIComponent(documentMatch[2]);

      try {
        result = await erpnext.getDocument(doctype, name);
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Failed to fetch ${doctype} ${name}: ${error?.message || "Unknown error"}`,
        );
      }
    }
  }

  if (!result) {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid ERPNext resource URI: ${uri}`);
  }

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_doctypes",
        description: "Get a list of all available DocTypes",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_doctype_fields",
        description:
          "Get field definitions for a specific DocType from ERPNext metadata. Returns fieldname, fieldtype, label, options, and reqd for each field.",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType (e.g., Customer, Item)",
            },
          },
          required: ["doctype"],
        },
      },
      {
        name: "get_documents",
        description:
          "Get a list of documents for a specific doctype. ERPNext defaults to 20 results if no limit is specified.",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType (e.g., Customer, Item)",
            },
            fields: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Fields to include (optional)",
            },
            filters: {
              type: "object",
              additionalProperties: true,
              description: "Filters in the format {field: value} (optional)",
            },
            limit: {
              type: "number",
              description: "Maximum number of documents to return (optional)",
            },
          },
          required: ["doctype"],
        },
      },
      {
        name: "get_child_documents",
        description:
          "Query child table rows by joining parent and child DocTypes. Direct child table queries return 403; this tool queries the parent DocType with child table field joins. Returns one row per matching child table row.",
        inputSchema: {
          type: "object",
          properties: {
            parent_doctype: {
              type: "string",
              description: "Parent DocType (e.g., BOM, Purchase Order, Sales Order)",
            },
            child_doctype: {
              type: "string",
              description:
                "Child table DocType (e.g., BOM Item, Purchase Order Item, Sales Order Item)",
            },
            parent_fields: {
              type: "array",
              items: { type: "string" },
              description:
                'Fields from the parent document (e.g., ["name", "item", "total_cost"]). Defaults to ["name"].',
            },
            child_fields: {
              type: "array",
              items: { type: "string" },
              description:
                'Fields from the child table (e.g., ["item_code", "qty", "rate"]). Automatically prefixed with child table reference.',
            },
            child_filters: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
              description:
                'Filters on child table fields as [field, operator, value] triples (e.g., [["item_code", "like", "%CM5%"]])',
            },
            parent_filters: {
              type: "object",
              additionalProperties: true,
              description:
                'Filters on parent document fields, same format as get_documents filters (e.g., {"is_active": 1, "docstatus": ["=", "1"]})',
            },
            limit: {
              type: "number",
              description: "Maximum number of rows to return (default: 100)",
            },
          },
          required: ["parent_doctype", "child_doctype"],
        },
      },
      {
        name: "create_document",
        description: "Create a new document in ERPNext",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType (e.g., Customer, Item)",
            },
            data: {
              type: "object",
              additionalProperties: true,
              description: "Document data",
            },
          },
          required: ["doctype", "data"],
        },
      },
      {
        name: "update_document",
        description: "Update an existing document in ERPNext",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType (e.g., Customer, Item)",
            },
            name: {
              type: "string",
              description: "Document name/ID",
            },
            data: {
              type: "object",
              additionalProperties: true,
              description: "Document data to update",
            },
          },
          required: ["doctype", "name", "data"],
        },
      },
      {
        name: "run_report",
        description: "Run an ERPNext report",
        inputSchema: {
          type: "object",
          properties: {
            report_name: {
              type: "string",
              description: "Name of the report",
            },
            filters: {
              type: "object",
              additionalProperties: true,
              description: "Report filters (optional)",
            },
          },
          required: ["report_name"],
        },
      },
      {
        name: "get_document",
        description:
          "Get a single document by DocType and name, including child tables. Response is automatically stripped of system metadata and null/default fields. Use 'fields' to select specific top-level fields, and 'child_fields' to select fields within child tables. 'name', 'docstatus', and 'status' are always included.",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType (e.g., Customer, Item)",
            },
            name: {
              type: "string",
              description: "Document name/ID (e.g., BOM-COM-HALPI2-007)",
            },
            fields: {
              type: "array",
              items: { type: "string" },
              description:
                'Top-level fields to include (e.g., ["item", "total_cost", "items"]). Child tables are included by fieldname. If omitted, all fields are returned (with system fields stripped). \'name\' and \'docstatus\' are always included.',
            },
            child_fields: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: { type: "string" },
              },
              description:
                'Fields to include per child table, keyed by table fieldname (e.g., {"items": ["item_code", "qty", "rate"]}). If a child table is not listed here, all its fields are returned (stripped). \'name\' (row ID) is always included.',
            },
          },
          required: ["doctype", "name"],
        },
      },
      {
        name: "call_method",
        description:
          "Call an ERPNext/Frappe whitelisted server-side API method. WARNING: This can invoke any whitelisted method including destructive operations — use with caution. Args are passed as JSON body (POST) or query params (GET), with keys matching the method's parameter names.",
        inputSchema: {
          type: "object",
          properties: {
            method: {
              type: "string",
              description:
                "Dotted method path (e.g., erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry)",
            },
            args: {
              type: "object",
              additionalProperties: true,
              description: "Method arguments as key-value pairs (optional)",
            },
            http_method: {
              type: "string",
              enum: ["GET", "POST"],
              description:
                "HTTP method to use (default: POST). Use GET for read-only methods like frappe.client.get_count.",
            },
          },
          required: ["method"],
        },
      },
      {
        name: "submit_document",
        description:
          "Submit a document (set docstatus to 1). This is irreversible — submitted documents can only be cancelled, not reverted to draft.",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType",
            },
            name: {
              type: "string",
              description: "Document name/ID",
            },
          },
          required: ["doctype", "name"],
        },
      },
      {
        name: "cancel_document",
        description:
          "Cancel a submitted document (set docstatus to 2). Cancelled documents cannot be modified — use amend workflow to create a corrected copy.",
        inputSchema: {
          type: "object",
          properties: {
            doctype: {
              type: "string",
              description: "ERPNext DocType",
            },
            name: {
              type: "string",
              description: "Document name/ID",
            },
          },
          required: ["doctype", "name"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Auth check applies to all tools uniformly
  if (!erpnext.isAuthenticated()) {
    return {
      content: [
        {
          type: "text",
          text: "Not authenticated with ERPNext. Please configure API key authentication.",
        },
      ],
      isError: true,
    };
  }

  switch (request.params.name) {
    case "get_documents": {
      const doctype = request.params.arguments?.doctype;
      if (typeof doctype !== "string" || !doctype) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype is required");
      }

      const fields = coerceStringArray(request.params.arguments?.fields);
      const rawFilters = request.params.arguments?.filters;
      const filters = coerceObject(rawFilters);
      if (rawFilters != null && filters === undefined) {
        throw new McpError(ErrorCode.InvalidParams, "filters must be a JSON object");
      }
      const limit = coerceNumber(request.params.arguments?.limit);

      try {
        const documents = await erpnext.getDocList(doctype, filters, fields, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(documents, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get ${doctype} documents: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_child_documents": {
      const parentDoctype = request.params.arguments?.parent_doctype;
      const childDoctype = request.params.arguments?.child_doctype;
      if (
        typeof parentDoctype !== "string" ||
        !parentDoctype ||
        typeof childDoctype !== "string" ||
        !childDoctype
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "parent_doctype and child_doctype are required",
        );
      }

      const parentFields = request.params.arguments?.parent_fields;
      const childFields = request.params.arguments?.child_fields;
      const childFilters = request.params.arguments?.child_filters;
      const parentFilters = request.params.arguments?.parent_filters;
      const limit = request.params.arguments?.limit;

      try {
        const rows = await erpnext.getChildDocList(
          parentDoctype,
          childDoctype,
          parentFields,
          childFields,
          childFilters,
          parentFilters,
          limit,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(rows) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get ${childDoctype} from ${parentDoctype}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "create_document": {
      const doctype = request.params.arguments?.doctype;
      const data = coerceObject(request.params.arguments?.data);
      if (typeof doctype !== "string" || !doctype || !data) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype and data are required");
      }

      try {
        const result = await erpnext.createDocument(doctype, data);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                doctype: doctype,
                name: result.name,
                docstatus: result.docstatus,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create ${doctype}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "update_document": {
      const doctype = request.params.arguments?.doctype;
      const name = request.params.arguments?.name;
      const data = coerceObject(request.params.arguments?.data);
      if (typeof doctype !== "string" || !doctype || typeof name !== "string" || !name || !data) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype, name, and data are required");
      }

      try {
        const result = await erpnext.updateDocument(doctype, name, data);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                doctype: doctype,
                name: result.name,
                docstatus: result.docstatus,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update ${doctype} ${name}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "run_report": {
      const reportName = request.params.arguments?.report_name;
      if (typeof reportName !== "string" || !reportName) {
        throw new McpError(ErrorCode.InvalidParams, "Report name is required");
      }

      const rawFilters = request.params.arguments?.filters;
      const filters = coerceObject(rawFilters);
      if (rawFilters != null && filters === undefined) {
        throw new McpError(ErrorCode.InvalidParams, "filters must be a JSON object");
      }

      try {
        const result = await erpnext.runReport(reportName, filters);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to run report ${reportName}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_document": {
      const doctype = request.params.arguments?.doctype;
      const name = request.params.arguments?.name;
      if (typeof doctype !== "string" || !doctype || typeof name !== "string" || !name) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
      }

      const fields = coerceStringArray(request.params.arguments?.fields);

      const rawChildFields = request.params.arguments?.child_fields;
      let childFields: Record<string, string[]> | undefined;
      if (rawChildFields !== undefined) {
        const coerced = coerceObject(rawChildFields);
        if (!coerced) {
          throw new McpError(ErrorCode.InvalidParams, "child_fields must be an object");
        }
        childFields = {} as Record<string, string[]>;
        for (const [key, value] of Object.entries(coerced)) {
          const arr = coerceStringArray(value);
          if (!arr) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `child_fields["${key}"] must be an array of strings`,
            );
          }
          childFields[key] = arr;
        }
      }

      try {
        const document = await erpnext.getDocument(doctype, name);
        const stripped = stripDocument(document, fields, childFields);
        return {
          content: [{ type: "text", text: JSON.stringify(stripped) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get ${doctype} ${name}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "call_method": {
      const method = request.params.arguments?.method;
      if (typeof method !== "string" || !method) {
        throw new McpError(ErrorCode.InvalidParams, "Method is required");
      }

      const rawArgs = request.params.arguments?.args;
      const args = coerceObject(rawArgs);
      if (rawArgs != null && args === undefined) {
        throw new McpError(ErrorCode.InvalidParams, "args must be a JSON object");
      }
      const httpMethod = (request.params.arguments?.http_method === "GET" ? "GET" : "POST") as
        | "GET"
        | "POST";

      try {
        const result = await erpnext.callMethod(method, args, httpMethod);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to call method ${method}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "submit_document": {
      const doctype = request.params.arguments?.doctype;
      const name = request.params.arguments?.name;
      if (typeof doctype !== "string" || !doctype || typeof name !== "string" || !name) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
      }

      try {
        const result = await erpnext.updateDocument(doctype, name, { docstatus: 1 });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                doctype: doctype,
                name: result?.name || name,
                docstatus: result?.docstatus ?? 1,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to submit ${doctype} ${name}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "cancel_document": {
      const doctype = request.params.arguments?.doctype;
      const name = request.params.arguments?.name;
      if (typeof doctype !== "string" || !doctype || typeof name !== "string" || !name) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
      }

      try {
        await erpnext.callMethod("frappe.client.cancel", { doctype, name });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                doctype: doctype,
                name: name,
                docstatus: 2,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to cancel ${doctype} ${name}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_doctype_fields": {
      const doctype = request.params.arguments?.doctype;
      if (typeof doctype !== "string" || !doctype) {
        throw new McpError(ErrorCode.InvalidParams, "Doctype is required");
      }

      try {
        const meta = await erpnext.getDocTypeMeta(doctype);
        const fields = (meta.fields || []).map((f: any) => ({
          fieldname: f.fieldname,
          fieldtype: f.fieldtype,
          label: f.label,
          options: f.options || null,
          reqd: f.reqd || 0,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(fields, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get fields for ${doctype}: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_doctypes": {
      try {
        const doctypes = await erpnext.getAllDocTypes();
        return {
          content: [{ type: "text", text: JSON.stringify(doctypes, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get DocTypes: ${error?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ERPNext MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
