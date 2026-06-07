import { describe, expect, it } from "vitest";
import {
  ATHRU_REALESTATE_API_METHODS,
  ATHRU_REALESTATE_DOCTYPES,
  assertWritableDoctype,
  handleAthruRealestateTool,
  isAthruRealestateDoctype,
} from "./athru-realestate.js";

describe("athru-realestate", () => {
  it("exports whitelisted API method paths", () => {
    expect(ATHRU_REALESTATE_API_METHODS.getPublishedProperties).toBe(
      "athru_realestate.api.property.get_published_properties",
    );
    expect(ATHRU_REALESTATE_API_METHODS.getPropertyDetail).toBe(
      "athru_realestate.api.property.get_property_detail",
    );
  });

  it("lists all app doctypes", () => {
    expect(ATHRU_REALESTATE_DOCTYPES).toContain("Property");
    expect(ATHRU_REALESTATE_DOCTYPES).toContain("Real Estate Settings");
    expect(ATHRU_REALESTATE_DOCTYPES).toContain("Property Unit Type");
  });

  it("blocks standalone writes to child tables", () => {
    expect(() => assertWritableDoctype("Property Unit Type")).toThrow(/child table/i);
    expect(() => assertWritableDoctype("Property")).not.toThrow();
  });

  it("recognizes app doctypes", () => {
    expect(isAthruRealestateDoctype("Property")).toBe(true);
    expect(isAthruRealestateDoctype("Customer")).toBe(false);
  });

  it("returns null for unknown tools", async () => {
    const client = {
      callMethod: async () => ({}),
      getDocList: async () => [],
      getDocument: async () => ({}),
      createDocument: async () => ({}),
      updateDocument: async () => ({}),
      getAllDocTypes: async () => [],
      getDocTypeMeta: async () => ({}),
    };
    const result = await handleAthruRealestateTool("unknown_tool", {}, client);
    expect(result).toBeNull();
  });
});
