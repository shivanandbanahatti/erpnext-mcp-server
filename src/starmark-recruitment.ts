/**
 * Starmark Recruitment MCP tools — wrap starmark_recruitment.api.mcp whitelisted methods
 * and DocType/report helpers for salary intelligence.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { extractErrorDetail } from "./errors.js";

export const STARMARK_RECRUITMENT_MODULE = "Starmark Recruitment";

export const STARMARK_RECRUITMENT_DOCTYPES = [
	"Candidate Salary",
	"Starmark Salary Band",
	"Salary Intelligence Settings",
] as const;

export const STARMARK_RECRUITMENT_REPORTS = [
	"Market Salary Detail",
	"Market Salary Band Report",
] as const;

const MCP = "starmark_recruitment.api.mcp";

export const STARMARK_RECRUITMENT_METHODS = {
	extractNow: `${MCP}.api_extract_now`,
	getMarketDashboard: `${MCP}.api_get_market_dashboard`,
	runBulkExtraction: `${MCP}.api_run_bulk_extraction`,
	getBulkStatus: `${MCP}.api_get_bulk_status`,
	cleanTotalExperience: `${MCP}.api_clean_total_experience`,
	importSalaryBands: `${MCP}.api_import_salary_bands`,
	resolveDimensions: `${MCP}.api_resolve_dimensions`,
	normalizeExperience: `${MCP}.api_normalize_experience`,
	getExtractionSummary: `${MCP}.api_get_extraction_summary`,
} as const;

export interface StarmarkRecruitmentApiClient {
	callMethod(
		method: string,
		args?: Record<string, unknown>,
		httpMethod?: "GET" | "POST",
	): Promise<unknown>;
}

export interface StarmarkRecruitmentListClient extends StarmarkRecruitmentApiClient {
	getDocList(
		doctype: string,
		filters?: Record<string, unknown>,
		fields?: string[],
		limit?: number,
	): Promise<unknown[]>;
	getDocument(doctype: string, name: string): Promise<unknown>;
	runReport(reportName: string, filters?: Record<string, unknown>): Promise<unknown>;
	getAllDocTypes(options?: {
		search?: string;
		module?: string;
		custom_only?: boolean;
	}): Promise<string[]>;
}

type ToolResult = {
	content: { type: "text"; text: string }[];
	isError?: boolean;
};

/** Legacy athru_recruitment MCP tool names → starmark_recruitment equivalents */
const TOOL_ALIASES: Record<string, string> = {
	get_job_opening_dimensions: "resolve_job_opening_dimensions",
	create_candidate_salary: "extract_candidate_salary_now",
	run_bulk_candidate_salary_extraction: "run_bulk_salary_extraction",
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

function requireString(args: Record<string, unknown> | undefined, key: string): string {
	const v = args?.[key];
	if (typeof v !== "string" || !v.trim()) {
		throw new McpError(ErrorCode.InvalidParams, `${key} is required`);
	}
	return v.trim();
}

function optionalObject(
	args: Record<string, unknown> | undefined,
	key: string,
): Record<string, unknown> | undefined {
	const v = args?.[key];
	if (v == null) return undefined;
	if (typeof v !== "object" || Array.isArray(v)) {
		throw new McpError(ErrorCode.InvalidParams, `${key} must be a JSON object`);
	}
	return v as Record<string, unknown>;
}

export const STARMARK_RECRUITMENT_TOOLS = [
	{
		name: "get_starmark_recruitment_doctypes",
		description:
			"Starmark Recruitment: list DocTypes in the starmark_recruitment app (Candidate Salary, Starmark Salary Band, Salary Intelligence Settings).",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "get_extraction_summary",
		description:
			"Starmark Recruitment: Candidate Salary extraction counts grouped by status (Extracted, Partial, Failed, etc.).",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "resolve_job_opening_dimensions",
		description:
			"Starmark Recruitment: resolve Job Opening dimensions for a candidate email via Job Applicant → Job Opening (designation, department, location, grade, RCM role, experience range).",
		inputSchema: {
			type: "object",
			properties: {
				email_id: { type: "string", description: "Candidate email (Job Applicant.email_id)" },
			},
			required: ["email_id"],
		},
	},
	{
		name: "normalize_candidate_experience",
		description:
			"Starmark Recruitment: parse a free-text total_experience value to numeric years (preview before cleanup).",
		inputSchema: {
			type: "object",
			properties: {
				raw: { type: "string", description: "Raw experience text from Candidate Information" },
			},
			required: ["raw"],
		},
	},
	{
		name: "extract_candidate_salary_now",
		description:
			"Starmark Recruitment: run OpenAI salary-slip extraction for one Candidate Information document (sync). Creates/updates Candidate Salary.",
		inputSchema: {
			type: "object",
			properties: {
				candidate_information: {
					type: "string",
					description: "Candidate Information document name",
				},
				force: {
					type: "boolean",
					description: "Re-extract even if already Extracted (default true)",
				},
			},
			required: ["candidate_information"],
		},
	},
	{
		name: "run_bulk_salary_extraction",
		description:
			"Starmark Recruitment: bulk Candidate Salary extraction for all eligible Candidate Information rows (idempotent, background queue by default).",
		inputSchema: {
			type: "object",
			properties: {
				limit: { type: "number", description: "Max records this run (optional)" },
				dry_run: { type: "boolean", description: "Preview only (default false)" },
				redo_failed: {
					type: "boolean",
					description: "Retry Failed/Partial records (default true)",
				},
				enqueue: {
					type: "boolean",
					description: "Use background workers (default true)",
				},
				batch_size: { type: "number", description: "Enqueue batch size (default 25)" },
			},
		},
	},
	{
		name: "get_bulk_extraction_status",
		description: "Starmark Recruitment: progress summary for bulk Candidate Salary extraction.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "clean_total_experience",
		description:
			"Starmark Recruitment: normalize total_experience on all Candidate Information records. Use dry_run=true first.",
		inputSchema: {
			type: "object",
			properties: {
				dry_run: { type: "boolean", description: "Preview only (default true)" },
			},
		},
	},
	{
		name: "import_starmark_salary_bands",
		description:
			"Starmark Recruitment: import Starmark Salary Band rows from Excel/CSV file path on the ERPNext server.",
		inputSchema: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Absolute path to .xlsx or .csv on the server",
				},
				dry_run: { type: "boolean", description: "Preview only (default true)" },
				update_existing: {
					type: "boolean",
					description: "Update existing bands on match (default true)",
				},
			},
			required: ["file_path"],
		},
	},
	{
		name: "get_market_salary_dashboard",
		description:
			"Starmark Recruitment: aggregated market salary dashboard data (KPI summary + salary bands by designation/experience).",
		inputSchema: {
			type: "object",
			properties: {
				filters: {
					type: "object",
					additionalProperties: true,
					description:
						'Optional filters: designation, department, location, experience_range, company, from_actc, to_actc',
				},
			},
		},
	},
	{
		name: "run_market_salary_detail_report",
		description:
			"Starmark Recruitment: run Market Salary Detail report (aggregated bands with Min/Median/Max CTC and companies).",
		inputSchema: {
			type: "object",
			properties: {
				filters: {
					type: "object",
					additionalProperties: true,
					description: "Report filters (designation, department, location, experience_range, etc.)",
				},
			},
		},
	},
	{
		name: "run_market_salary_band_report",
		description:
			"Starmark Recruitment: run Market Salary Band Report (market percentiles vs internal Starmark Salary Band).",
		inputSchema: {
			type: "object",
			properties: {
				filters: {
					type: "object",
					additionalProperties: true,
					description: "Report filters (designation, location)",
				},
			},
		},
	},
	{
		name: "list_candidate_salaries",
		description: "Starmark Recruitment: list Candidate Salary documents with optional filters.",
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
					description: 'e.g. {"extraction_status": "Failed"}',
				},
				limit: { type: "number", description: "Max rows (default 20)" },
			},
		},
	},
	{
		name: "get_candidate_salary",
		description: "Starmark Recruitment: get a single Candidate Salary document by name.",
		inputSchema: {
			type: "object",
			properties: {
				name: { type: "string", description: "Candidate Salary name (e.g. CS-34640)" },
			},
			required: ["name"],
		},
	},
	{
		name: "list_starmark_salary_bands",
		description: "Starmark Recruitment: list Starmark Salary Band documents.",
		inputSchema: {
			type: "object",
			properties: {
				filters: { type: "object", additionalProperties: true },
				limit: { type: "number", description: "Max rows (default 50)" },
			},
		},
	},
	{
		name: "get_starmark_salary_band",
		description: "Starmark Recruitment: get a single Starmark Salary Band document.",
		inputSchema: {
			type: "object",
			properties: {
				name: { type: "string", description: "Starmark Salary Band name" },
			},
			required: ["name"],
		},
	},
	{
		name: "get_salary_intelligence_settings",
		description: "Starmark Recruitment: get Salary Intelligence Settings (OpenAI model, budget, tuning).",
		inputSchema: { type: "object", properties: {} },
	},
] as const;

export async function handleStarmarkRecruitmentTool(
	toolName: string,
	args: Record<string, unknown> | undefined,
	client: StarmarkRecruitmentListClient,
): Promise<ToolResult | null> {
	const resolved = TOOL_ALIASES[toolName] ?? toolName;

	switch (resolved) {
		case "get_starmark_recruitment_doctypes":
			return handleGetDoctypes(client);
		case "get_extraction_summary":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.getExtractionSummary);
		case "resolve_job_opening_dimensions":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.resolveDimensions, {
				email_id: requireString(args, "email_id"),
			});
		case "normalize_candidate_experience":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.normalizeExperience, {
				raw: requireString(args, "raw"),
			});
		case "extract_candidate_salary_now":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.extractNow, {
				candidate_information: requireString(args, "candidate_information"),
				force: args?.force === false ? 0 : 1,
			});
		case "run_bulk_salary_extraction":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.runBulkExtraction, {
				limit: args?.limit,
				dry_run: args?.dry_run ? 1 : 0,
				redo_failed: args?.redo_failed === false ? 0 : 1,
				enqueue: args?.enqueue === false ? 0 : 1,
				batch_size: args?.batch_size ?? 25,
			});
		case "get_bulk_extraction_status":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.getBulkStatus);
		case "clean_total_experience":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.cleanTotalExperience, {
				dry_run: args?.dry_run === false ? 0 : 1,
			});
		case "import_starmark_salary_bands":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.importSalaryBands, {
				file_path: requireString(args, "file_path"),
				dry_run: args?.dry_run === false ? 0 : 1,
				update_existing: args?.update_existing === false ? 0 : 1,
			});
		case "get_market_salary_dashboard":
			return callMethod(client, STARMARK_RECRUITMENT_METHODS.getMarketDashboard, {
				filters: args?.filters != null ? JSON.stringify(args.filters) : undefined,
			});
		case "run_market_salary_detail_report":
			return runReport(client, "Market Salary Detail", optionalObject(args, "filters"));
		case "run_market_salary_band_report":
			return runReport(client, "Market Salary Band Report", optionalObject(args, "filters"));
		case "list_candidate_salaries":
			return listDocs(client, "Candidate Salary", args);
		case "get_candidate_salary":
			return getDoc(client, "Candidate Salary", requireString(args, "name"));
		case "list_starmark_salary_bands":
			return listDocs(client, "Starmark Salary Band", args, 50);
		case "get_starmark_salary_band":
			return getDoc(client, "Starmark Salary Band", requireString(args, "name"));
		case "get_salary_intelligence_settings":
			return getDoc(client, "Salary Intelligence Settings", "Salary Intelligence Settings");
		default:
			return null;
	}
}

async function callMethod(
	client: StarmarkRecruitmentApiClient,
	method: string,
	args?: Record<string, unknown>,
): Promise<ToolResult> {
	try {
		const result = await client.callMethod(method, args);
		return toolText(result);
	} catch (error: unknown) {
		return toolError(`${method}: ${extractErrorDetail(error)}`);
	}
}

async function runReport(
	client: StarmarkRecruitmentListClient,
	reportName: string,
	filters?: Record<string, unknown>,
): Promise<ToolResult> {
	try {
		const result = await client.runReport(reportName, filters);
		return toolText(result);
	} catch (error: unknown) {
		return toolError(`Failed to run report ${reportName}: ${extractErrorDetail(error)}`);
	}
}

async function listDocs(
	client: StarmarkRecruitmentListClient,
	doctype: string,
	args: Record<string, unknown> | undefined,
	defaultLimit = 20,
): Promise<ToolResult> {
	const fields = Array.isArray(args?.fields)
		? args.fields.filter((f): f is string => typeof f === "string")
		: undefined;
	const filters = optionalObject(args, "filters");
	const limit = typeof args?.limit === "number" ? args.limit : defaultLimit;
	try {
		const rows = await client.getDocList(doctype, filters, fields, limit);
		return toolText({ count: rows.length, [doctype]: rows });
	} catch (error: unknown) {
		return toolError(`Failed to list ${doctype}: ${extractErrorDetail(error)}`);
	}
}

async function getDoc(
	client: StarmarkRecruitmentListClient,
	doctype: string,
	name: string,
): Promise<ToolResult> {
	try {
		const doc = await client.getDocument(doctype, name);
		return toolText(doc);
	} catch (error: unknown) {
		return toolError(`Failed to get ${doctype} ${name}: ${extractErrorDetail(error)}`);
	}
}

async function handleGetDoctypes(client: StarmarkRecruitmentListClient): Promise<ToolResult> {
	try {
		const doctypes = await client.getAllDocTypes({ module: STARMARK_RECRUITMENT_MODULE });
		return toolText({
			module: STARMARK_RECRUITMENT_MODULE,
			count: doctypes.length,
			doctypes,
			core_doctypes: STARMARK_RECRUITMENT_DOCTYPES,
			reports: STARMARK_RECRUITMENT_REPORTS,
		});
	} catch (error: unknown) {
		return toolError(
			`Failed to list Starmark Recruitment DocTypes: ${extractErrorDetail(error)}`,
		);
	}
}
