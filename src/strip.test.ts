import { describe, it, expect } from "vitest";
import { isEmptyValue, isSystemKey, stripChildRow, stripDocument } from "./strip.js";

describe("isEmptyValue", () => {
  it("treats null, undefined, empty string as empty", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue("")).toBe(true);
  });

  it("preserves empty arrays", () => {
    expect(isEmptyValue([])).toBe(false);
  });

  it("treats non-empty values as non-empty", () => {
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue("hello")).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue([1])).toBe(false);
  });
});

describe("isSystemKey", () => {
  it("identifies underscore-prefixed keys as system keys", () => {
    expect(isSystemKey("_liked_by")).toBe(true);
    expect(isSystemKey("_comments")).toBe(true);
  });

  it("identifies known system fields", () => {
    expect(isSystemKey("owner")).toBe(true);
    expect(isSystemKey("modified_by")).toBe(true);
    expect(isSystemKey("creation")).toBe(true);
    expect(isSystemKey("idx")).toBe(true);
    expect(isSystemKey("doctype")).toBe(true);
  });

  it("does not flag normal fields", () => {
    expect(isSystemKey("item_code")).toBe(false);
    expect(isSystemKey("name")).toBe(false);
    expect(isSystemKey("status")).toBe(false);
  });
});

describe("stripChildRow", () => {
  const row = {
    name: "row-1",
    item_code: "ITEM-001",
    qty: 5,
    rate: 10.5,
    owner: "admin@example.com",
    modified_by: "admin@example.com",
    creation: "2024-01-01",
    idx: 1,
    _liked_by: "[]",
    description: null,
    note: "",
  };

  it("strips system fields and empty values", () => {
    const result = stripChildRow(row);
    expect(result).toEqual({
      name: "row-1",
      item_code: "ITEM-001",
      qty: 5,
      rate: 10.5,
    });
  });

  it("filters to specific fields when provided", () => {
    const result = stripChildRow(row, ["item_code", "qty"]);
    expect(result).toEqual({
      name: "row-1",
      item_code: "ITEM-001",
      qty: 5,
    });
  });

  it("always includes name even if not in fields list", () => {
    const result = stripChildRow(row, ["qty"]);
    expect(result.name).toBe("row-1");
  });
});

describe("stripDocument", () => {
  const doc = {
    name: "DOC-001",
    docstatus: 1,
    status: "Submitted",
    item: "ITEM-001",
    total_cost: 100,
    description: null,
    notes: "",
    owner: "admin@example.com",
    modified_by: "admin@example.com",
    creation: "2024-01-01",
    modified: "2024-01-02",
    _liked_by: "[]",
    items: [
      {
        name: "row-1",
        item_code: "COMP-001",
        qty: 2,
        rate: 50,
        owner: "admin@example.com",
        idx: 1,
        note: null,
      },
    ],
  };

  it("strips system fields and empty values from top level", () => {
    const result = stripDocument(doc);
    expect(result.owner).toBeUndefined();
    expect(result.modified_by).toBeUndefined();
    expect(result._liked_by).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("always keeps name, docstatus, and status", () => {
    const result = stripDocument(doc);
    expect(result.name).toBe("DOC-001");
    expect(result.docstatus).toBe(1);
    expect(result.status).toBe("Submitted");
  });

  it("keeps name/docstatus/status even when fields is specified without them", () => {
    const result = stripDocument(doc, ["item"]);
    expect(result.name).toBe("DOC-001");
    expect(result.docstatus).toBe(1);
    expect(result.status).toBe("Submitted");
    expect(result.item).toBe("ITEM-001");
    expect(result.total_cost).toBeUndefined();
  });

  it("strips child table rows recursively", () => {
    const result = stripDocument(doc);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].owner).toBeUndefined();
    expect(result.items[0].idx).toBeUndefined();
    expect(result.items[0].note).toBeUndefined();
    expect(result.items[0].item_code).toBe("COMP-001");
  });

  it("applies child_fields filtering", () => {
    const result = stripDocument(doc, undefined, { items: ["item_code", "qty"] });
    expect(result.items[0]).toEqual({
      name: "row-1",
      item_code: "COMP-001",
      qty: 2,
    });
  });

  it("auto-includes child table key in fields when child_fields is specified", () => {
    const result = stripDocument(doc, ["item"], { items: ["item_code"] });
    expect(result.items).toBeDefined();
    expect(result.item).toBe("ITEM-001");
  });

  it("preserves empty child tables", () => {
    const docWithEmptyTable = { ...doc, items: [] };
    const result = stripDocument(docWithEmptyTable);
    expect(result.items).toEqual([]);
  });

  it("preserves status even when its value is an empty string", () => {
    const docWithEmptyStatus = { ...doc, status: "" };
    const result = stripDocument(docWithEmptyStatus);
    expect(result.status).toBe("");
  });
});
