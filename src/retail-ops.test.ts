import { describe, expect, it } from "vitest";
import {
  RETAIL_OPS_API_METHODS,
  RETAIL_OPS_DOCTYPES,
  RETAIL_OPS_REPORTS,
  assertWritableRetailOpsDoctype,
  handleRetailOpsTool,
  isRetailOpsDoctype,
} from "./retail-ops.js";

describe("retail-ops", () => {
  it("exports whitelisted API method paths", () => {
    expect(RETAIL_OPS_API_METHODS.checkDeliveryGate).toBe(
      "retail_ops.api.mcp.check_delivery_gate",
    );
    expect(RETAIL_OPS_API_METHODS.getSalesOrderReadiness).toBe(
      "retail_ops.api.mcp.get_sales_order_readiness",
    );
  });

  it("lists app doctypes", () => {
    expect(RETAIL_OPS_DOCTYPES).toContain("Production Order Tracker");
    expect(RETAIL_OPS_DOCTYPES).toContain("Montage Crew Member");
  });

  it("lists retail ops reports", () => {
    expect(RETAIL_OPS_REPORTS).toContain("Production Status");
    expect(RETAIL_OPS_REPORTS).toContain("Delivery Calendar");
  });

  it("blocks standalone writes to child tables", () => {
    expect(() => assertWritableRetailOpsDoctype("Montage Crew Member")).toThrow(/child table/i);
    expect(() => assertWritableRetailOpsDoctype("Production Order Tracker")).not.toThrow();
  });

  it("recognizes app doctypes", () => {
    expect(isRetailOpsDoctype("Production Order Tracker")).toBe(true);
    expect(isRetailOpsDoctype("Customer")).toBe(false);
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
      runReport: async () => ({}),
    };
    const result = await handleRetailOpsTool("unknown_tool", {}, client);
    expect(result).toBeNull();
  });
});
