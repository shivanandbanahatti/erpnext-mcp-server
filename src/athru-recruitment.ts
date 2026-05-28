/**
 * Athru Recruitment MCP tools — wrap athru_recruitment.api.recruitment whitelisted methods.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { extractErrorDetail } from "./errors.js";

export const ATHRU_RECRUITMENT_METHODS = {
  getJobOpeningDimensions: "athru_recruitment.athru_recruitment.api.recruitment.api_get_job_opening_dimensions",
  extractFromSalarySlip:
    "athru_recruitment.athru_recruitment.api.recruitment.api_extract_from_salary_slip",
  createCandidateSalary:
    "athru_recruitment.athru_recruitment.api.recruitment.api_create_candidate_salary",
  runBulkExtraction:
    "athru_recruitment.athru_recruitment.api.recruitment.api_run_bulk_extraction",
} as const;

export interface AthruRecruitmentApiClient {
  callMethod(
    method: string,
    args?: Record<string, unknown>,
    httpMethod?: "GET" | "POST",
  ): Promise<unknown>;
}

export interface AthruRecruitmentListClient extends AthruRecruitmentApiClient {
  getDocList(
    doctype: string,
    filters?: Record<string, unknown>,
    fields?: string[],
    limit?: number,
  ): Promise<unknown[]>;
  getDocument(doctype: string, name: string): Promise<unknown>;
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

export const ATHRU_RECRUITMENT_TOOLS = [
  {
    name: "get_job_opening_dimensions",
    description:
      "Athru Recruitment: resolve Job Opening dimensions for a candidate email via Job Applicant → Job Opening (designation, department, location, grade, RCM role, min/max experience).",
    inputSchema: {
      type: "object",
      properties: {
        email_id: {
          type: "string",
          description: "Candidate email (matches Job Applicant.email_id)",
        },
      },
      required: ["email_id"],
    },
  },
  {
    name: "extract_salary_from_slip",
    description:
      "Athru Recruitment: extract company, MCTC, and ACTC from a salary slip file URL using OpenAI (requires Athru Recruitment Settings API key on site).",
    inputSchema: {
      type: "object",
      properties: {
        file_url: {
          type: "string",
          description: "Frappe File URL (e.g. /private/files/slip.pdf)",
        },
        fallback_company: {
          type: "string",
          description: "Company name to use when extraction returns null",
        },
      },
      required: ["file_url"],
    },
  },
  {
    name: "create_candidate_salary",
    description:
      "Athru Recruitment: create a Candidate Salary record from a Candidate Information document (salary slip extraction + job dimensions). Skips duplicates and ineligible records.",
    inputSchema: {
      type: "object",
      properties: {
        candidate_information: {
          type: "string",
          description: "Candidate Information document name",
        },
      },
      required: ["candidate_information"],
    },
  },
  {
    name: "run_bulk_candidate_salary_extraction",
    description:
      "Athru Recruitment: bulk-create Candidate Salary records for all eligible Candidate Information rows (idempotent — skips existing).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_candidate_salaries",
    description:
      "Athru Recruitment: list Candidate Salary documents with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          items: { type: "string" },
          description:
            "Fields to return (default: name, candidate_name, candidate_email, designation, organization, mctc, actc, extraction_status, modified)",
        },
        filters: {
          type: "object",
          additionalProperties: true,
          description: 'ERPNext filters, e.g. {"extraction_status": "Extracted"}',
        },
        limit: {
          type: "number",
          description: "Max rows (default 20)",
        },
      },
    },
  },
  {
    name: "get_candidate_salary",
    description: "Athru Recruitment: get a single Candidate Salary document by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Candidate Salary name (e.g. CS-2026-00001)",
        },
      },
      required: ["name"],
    },
  },
] as const;

export type AthruRecruitmentToolName = (typeof ATHRU_RECRUITMENT_TOOLS)[number]["name"];

export async function handleAthruRecruitmentTool(
  toolName: string,
  args: Record<string, unknown> | undefined,
  client: AthruRecruitmentListClient,
): Promise<ToolResult | null> {
  switch (toolName) {
    case "get_job_opening_dimensions":
      return handleGetJobOpeningDimensions(args, client);
    case "extract_salary_from_slip":
      return handleExtractSalaryFromSlip(args, client);
    case "create_candidate_salary":
      return handleCreateCandidateSalary(args, client);
    case "run_bulk_candidate_salary_extraction":
      return handleRunBulkExtraction(client);
    case "list_candidate_salaries":
      return handleListCandidateSalaries(args, client);
    case "get_candidate_salary":
      return handleGetCandidateSalary(args, client);
    default:
      return null;
  }
}

async function handleGetJobOpeningDimensions(
  args: Record<string, unknown> | undefined,
  client: AthruRecruitmentApiClient,
): Promise<ToolResult> {
  const email_id = args?.email_id;
  if (typeof email_id !== "string" || !email_id.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "email_id is required");
  }

  try {
    const result = await client.callMethod(ATHRU_RECRUITMENT_METHODS.getJobOpeningDimensions, {
      email_id: email_id.trim(),
    });
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to get job opening dimensions: ${extractErrorDetail(error)}`);
  }
}

async function handleExtractSalaryFromSlip(
  args: Record<string, unknown> | undefined,
  client: AthruRecruitmentApiClient,
): Promise<ToolResult> {
  const file_url = args?.file_url;
  if (typeof file_url !== "string" || !file_url.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "file_url is required");
  }

  const methodArgs: Record<string, unknown> = { file_url: file_url.trim() };
  if (typeof args?.fallback_company === "string" && args.fallback_company.trim()) {
    methodArgs.fallback_company = args.fallback_company.trim();
  }

  try {
    const result = await client.callMethod(
      ATHRU_RECRUITMENT_METHODS.extractFromSalarySlip,
      methodArgs,
    );
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to extract salary from slip: ${extractErrorDetail(error)}`);
  }
}

async function handleCreateCandidateSalary(
  args: Record<string, unknown> | undefined,
  client: AthruRecruitmentApiClient,
): Promise<ToolResult> {
  const candidate_information = args?.candidate_information;
  if (typeof candidate_information !== "string" || !candidate_information.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "candidate_information is required");
  }

  try {
    const result = await client.callMethod(ATHRU_RECRUITMENT_METHODS.createCandidateSalary, {
      candidate_information: candidate_information.trim(),
    });
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to create Candidate Salary: ${extractErrorDetail(error)}`);
  }
}

async function handleRunBulkExtraction(client: AthruRecruitmentApiClient): Promise<ToolResult> {
  try {
    const result = await client.callMethod(ATHRU_RECRUITMENT_METHODS.runBulkExtraction, {});
    return toolText(result);
  } catch (error: unknown) {
    return toolError(`Failed to run bulk extraction: ${extractErrorDetail(error)}`);
  }
}

async function handleListCandidateSalaries(
  args: Record<string, unknown> | undefined,
  client: AthruRecruitmentListClient,
): Promise<ToolResult> {
  const defaultFields = [
    "name",
    "candidate_information",
    "candidate_name",
    "candidate_email",
    "designation",
    "organization",
    "mctc",
    "actc",
    "extraction_status",
    "modified",
  ];

  let fields = defaultFields;
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
    const rows = await client.getDocList("Candidate Salary", filters, fields, limit);
    return toolText({ count: rows.length, candidate_salaries: rows });
  } catch (error: unknown) {
    return toolError(`Failed to list Candidate Salary records: ${extractErrorDetail(error)}`);
  }
}

async function handleGetCandidateSalary(
  args: Record<string, unknown> | undefined,
  client: AthruRecruitmentListClient,
): Promise<ToolResult> {
  const name = args?.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }

  try {
    const doc = await client.getDocument("Candidate Salary", name.trim());
    return toolText(doc);
  } catch (error: unknown) {
    return toolError(`Failed to get Candidate Salary ${name}: ${extractErrorDetail(error)}`);
  }
}
