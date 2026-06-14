import { describe, expect, it } from "vitest";
import {
	STARMARK_RECRUITMENT_METHODS,
	handleStarmarkRecruitmentTool,
} from "./starmark-recruitment.js";

describe("starmark-recruitment", () => {
	it("exports whitelisted method paths for starmark_recruitment app", () => {
		expect(STARMARK_RECRUITMENT_METHODS.extractNow).toBe(
			"starmark_recruitment.api.mcp.api_extract_now",
		);
		expect(STARMARK_RECRUITMENT_METHODS.getMarketDashboard).toContain(
			"starmark_recruitment.api.mcp",
		);
	});

	it("returns null for unknown tools", async () => {
		const client = {
			callMethod: async () => ({}),
			getDocList: async () => [],
			getDocument: async () => ({}),
			runReport: async () => ({}),
			getAllDocTypes: async () => [],
		};
		const result = await handleStarmarkRecruitmentTool("unknown_tool", {}, client);
		expect(result).toBeNull();
	});
});
