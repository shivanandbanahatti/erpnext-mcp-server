import { describe, expect, it } from "vitest";
import { ATHRU_RECRUITMENT_METHODS, handleAthruRecruitmentTool } from "./athru-recruitment.js";

describe("athru-recruitment", () => {
  it("exports whitelisted method paths", () => {
    expect(ATHRU_RECRUITMENT_METHODS.getJobOpeningDimensions).toContain(
      "athru_recruitment.athru_recruitment.api.recruitment",
    );
  });

  it("returns null for unknown tools", async () => {
    const client = {
      callMethod: async () => ({}),
      getDocList: async () => [],
      getDocument: async () => ({}),
    };
    const result = await handleAthruRecruitmentTool("unknown_tool", {}, client);
    expect(result).toBeNull();
  });
});
