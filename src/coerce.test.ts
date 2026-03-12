import { describe, it, expect } from "vitest";
import { coerceStringArray, coerceObject, coerceNumber, coerceFilterArray } from "./coerce.js";

describe("coerceStringArray", () => {
  it("returns undefined for undefined/null", () => {
    expect(coerceStringArray(undefined)).toBeUndefined();
    expect(coerceStringArray(null)).toBeUndefined();
  });

  it("passes through string arrays", () => {
    expect(coerceStringArray(["name", "item_code"])).toEqual(["name", "item_code"]);
  });

  it("parses JSON string arrays", () => {
    expect(coerceStringArray('["name", "account_name"]')).toEqual(["name", "account_name"]);
  });

  it("wraps plain strings as single-element array", () => {
    expect(coerceStringArray("name")).toEqual(["name"]);
  });

  it("returns undefined for non-array/string types", () => {
    expect(coerceStringArray(42)).toBeUndefined();
    expect(coerceStringArray({})).toBeUndefined();
  });

  it("rejects arrays with non-string elements", () => {
    expect(coerceStringArray(["name", 42])).toBeUndefined();
    expect(coerceStringArray([null, "name"])).toBeUndefined();
    expect(coerceStringArray([true])).toBeUndefined();
  });

  it("returns empty array for empty array input", () => {
    expect(coerceStringArray([])).toEqual([]);
  });

  it("rejects JSON string containing non-string array", () => {
    expect(coerceStringArray("[1, 2, 3]")).toBeUndefined();
  });
});

describe("coerceObject", () => {
  it("returns undefined for undefined/null", () => {
    expect(coerceObject(undefined)).toBeUndefined();
    expect(coerceObject(null)).toBeUndefined();
  });

  it("passes through objects", () => {
    expect(coerceObject({ account_number: "5205" })).toEqual({ account_number: "5205" });
  });

  it("parses JSON string objects", () => {
    expect(coerceObject('{"account_number": "5205"}')).toEqual({ account_number: "5205" });
  });

  it("parses nested filter values", () => {
    expect(coerceObject('{"name": ["like", "%5205%"]}')).toEqual({ name: ["like", "%5205%"] });
  });

  it("returns undefined for arrays", () => {
    expect(coerceObject([1, 2, 3])).toBeUndefined();
  });

  it("returns undefined for JSON arrays in strings", () => {
    expect(coerceObject('["name"]')).toBeUndefined();
  });

  it("returns undefined for invalid JSON strings", () => {
    expect(coerceObject("not json")).toBeUndefined();
  });

  it("handles empty object string", () => {
    expect(coerceObject("{}")).toEqual({});
  });
});

describe("coerceNumber", () => {
  it("returns undefined for undefined/null", () => {
    expect(coerceNumber(undefined)).toBeUndefined();
    expect(coerceNumber(null)).toBeUndefined();
  });

  it("passes through positive numbers", () => {
    expect(coerceNumber(5)).toBe(5);
    expect(coerceNumber(100)).toBe(100);
  });

  it("parses numeric strings", () => {
    expect(coerceNumber("5")).toBe(5);
    expect(coerceNumber("100")).toBe(100);
  });

  it("returns undefined for non-numeric strings", () => {
    expect(coerceNumber("abc")).toBeUndefined();
  });

  it("returns undefined for empty/whitespace strings", () => {
    expect(coerceNumber("")).toBeUndefined();
    expect(coerceNumber("  ")).toBeUndefined();
  });

  it("rejects Infinity and NaN", () => {
    expect(coerceNumber("Infinity")).toBeUndefined();
    expect(coerceNumber(Infinity)).toBeUndefined();
    expect(coerceNumber(NaN)).toBeUndefined();
  });

  it("accepts zero (means 'no limit' in Frappe)", () => {
    expect(coerceNumber(0)).toBe(0);
    expect(coerceNumber("0")).toBe(0);
  });

  it("rejects negative numbers", () => {
    expect(coerceNumber(-5)).toBeUndefined();
    expect(coerceNumber("-1")).toBeUndefined();
  });
});

describe("coerceFilterArray", () => {
  it("returns undefined for undefined/null", () => {
    expect(coerceFilterArray(undefined)).toBeUndefined();
    expect(coerceFilterArray(null)).toBeUndefined();
  });

  it("accepts valid filter arrays", () => {
    const filters: [string, string, unknown][] = [["item_code", "like", "%CM5%"]];
    expect(coerceFilterArray(filters)).toEqual(filters);
  });

  it("parses JSON string filter arrays", () => {
    const json = '[["item_code", "like", "%CM5%"]]';
    expect(coerceFilterArray(json)).toEqual([["item_code", "like", "%CM5%"]]);
  });

  it("rejects non-array values", () => {
    expect(() => coerceFilterArray("not json")).toThrow("expected JSON array");
    expect(() => coerceFilterArray(42)).toThrow("expected array");
    expect(() => coerceFilterArray({})).toThrow("expected array");
  });

  it("accepts numeric filter values", () => {
    expect(coerceFilterArray([["qty", ">", 10]])).toEqual([["qty", ">", 10]]);
    expect(coerceFilterArray([["docstatus", "=", 1]])).toEqual([["docstatus", "=", 1]]);
  });

  it("rejects malformed filter entries", () => {
    expect(() => coerceFilterArray([["field", "="]])).toThrow(
      "expected [field, operator, value] triple",
    );
    expect(() => coerceFilterArray([["a", "b", "c", "d"]])).toThrow(
      "expected [field, operator, value] triple",
    );
    expect(() => coerceFilterArray([[123, "=", "val"]])).toThrow(
      "expected [field, operator, value] triple",
    );
    expect(() => coerceFilterArray([["field", 42, "val"]])).toThrow(
      "expected [field, operator, value] triple",
    );
  });

  it("accepts empty array", () => {
    expect(coerceFilterArray([])).toEqual([]);
  });
});
