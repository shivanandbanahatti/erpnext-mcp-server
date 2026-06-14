import { describe, expect, it } from "vitest";
import { ATHRU_RECRUITMENT_METHODS, handleAthruRecruitmentTool } from "./athru-recruitment.js";

describe("athru-recruitment (deprecated re-exports)", () => {
	it("re-exports starmark_recruitment method paths", () => {
		expect(ATHRU_RECRUITMENT_METHODS.extractNow).toBe(
			"starmark_recruitment.api.mcp.api_extract_now",
		);
	});

	it("delegates unknown tools via starmark handler", async () => {
		const client = {
			callMethod: async () => ({}),
			getDocList: async () => [],
			getDocument: async () => ({}),
			runReport: async () => ({}),
			getAllDocTypes: async () => [],
		};
		const result = await handleAthruRecruitmentTool("unknown_tool", {}, client);
		expect(result).toBeNull();
	});
});
