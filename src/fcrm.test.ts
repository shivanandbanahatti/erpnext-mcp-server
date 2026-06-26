import { describe, expect, it } from "vitest";
import {
  FCRM_WRITABLE_DOCTYPES,
  assertReadableFcrmDoctype,
  assertWritableFcrmDoctype,
  handleFcrmTool,
  isFcrmWritableDoctype,
} from "./fcrm.js";

describe("fcrm", () => {
  it("lists writable FCRM doctypes", () => {
    expect(FCRM_WRITABLE_DOCTYPES).toContain("CRM Lead");
    expect(FCRM_WRITABLE_DOCTYPES).toContain("CRM Deal");
    expect(FCRM_WRITABLE_DOCTYPES).toContain("CRM Organization");
  });

  it("recognizes writable doctypes", () => {
    expect(isFcrmWritableDoctype("CRM Lead")).toBe(true);
    expect(isFcrmWritableDoctype("FCRM Settings")).toBe(false);
  });

  it("allows read on known FCRM doctypes", () => {
    expect(() => assertReadableFcrmDoctype("CRM Lead")).not.toThrow();
    expect(() => assertReadableFcrmDoctype("CRM Lead Status")).not.toThrow();
    expect(() => assertReadableFcrmDoctype("Customer")).toThrow(/FCRM DocType/i);
  });

  it("blocks writes to settings doctypes", () => {
    expect(() => assertWritableFcrmDoctype("CRM Lead")).not.toThrow();
    expect(() => assertWritableFcrmDoctype("FCRM Settings")).toThrow(/must be one of/i);
    expect(() => assertWritableFcrmDoctype("CRM Lead Status")).toThrow(/must be one of/i);
  });

  it("returns null for unknown tools", async () => {
    const client = {
      getDocList: async () => [],
      getDocument: async () => ({}),
      createDocument: async () => ({}),
      updateDocument: async () => ({}),
      getAllDocTypes: async () => ["CRM Lead"],
      getDocTypeMeta: async () => ({}),
    };
    const result = await handleFcrmTool("unknown_tool", {}, client);
    expect(result).toBeNull();
  });

  it("get_fcrm_info returns module metadata", async () => {
    const client = {
      getDocList: async () => [],
      getDocument: async () => ({}),
      createDocument: async () => ({}),
      updateDocument: async () => ({}),
      getAllDocTypes: async () => [],
      getDocTypeMeta: async () => ({}),
    };
    const result = await handleFcrmTool("get_fcrm_info", {}, client);
    expect(result).not.toBeNull();
    const body = JSON.parse(result!.content[0].text);
    expect(body.module).toBe("FCRM");
    expect(body.writable_doctypes).toContain("CRM Deal");
  });
});
