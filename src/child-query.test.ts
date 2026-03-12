import { describe, it, expect } from "vitest";
import {
  buildChildQueryArgs,
  validateDocTypeName,
  validateFieldName,
  validateChildFilter,
  DEFAULT_LIMIT,
} from "./child-query.js";

describe("validateDocTypeName", () => {
  it("accepts normal DocType names", () => {
    expect(() => validateDocTypeName("BOM", "test")).not.toThrow();
    expect(() => validateDocTypeName("BOM Item", "test")).not.toThrow();
    expect(() => validateDocTypeName("Purchase Order Item", "test")).not.toThrow();
    expect(() => validateDocTypeName("Sales-Order", "test")).not.toThrow();
  });

  it("rejects names with special characters", () => {
    expect(() => validateDocTypeName("BOM; DROP TABLE", "test")).toThrow("Invalid test");
    expect(() => validateDocTypeName("Item`", "test")).toThrow("Invalid test");
    expect(() => validateDocTypeName("Item\nCode", "test")).toThrow("Invalid test");
  });
});

describe("validateFieldName", () => {
  it("accepts valid field names", () => {
    expect(() => validateFieldName("item_code", "test")).not.toThrow();
    expect(() => validateFieldName("qty", "test")).not.toThrow();
    expect(() => validateFieldName("name", "test")).not.toThrow();
  });

  it("rejects field names with special characters", () => {
    expect(() => validateFieldName("item code", "test")).toThrow("Invalid field");
    expect(() => validateFieldName("item;DROP", "test")).toThrow("Invalid field");
    expect(() => validateFieldName("rate`", "test")).toThrow("Invalid field");
  });
});

describe("validateChildFilter", () => {
  it("accepts valid 3-tuple filters", () => {
    expect(() => validateChildFilter(["item_code", "like", "%CM5%"])).not.toThrow();
    expect(() => validateChildFilter(["qty", ">", "0"])).not.toThrow();
  });

  it("accepts numeric filter values", () => {
    expect(() => validateChildFilter(["qty", ">", 10])).not.toThrow();
    expect(() => validateChildFilter(["docstatus", "=", 1])).not.toThrow();
  });

  it("rejects non-array", () => {
    expect(() => validateChildFilter("item_code")).toThrow("expected [field, operator, value]");
  });

  it("rejects wrong length", () => {
    expect(() => validateChildFilter(["field", "="])).toThrow("expected [field, operator, value]");
    expect(() => validateChildFilter(["a", "b", "c", "d"])).toThrow(
      "expected [field, operator, value]",
    );
  });

  it("rejects non-string field or operator", () => {
    expect(() => validateChildFilter([123, "=", "val"])).toThrow(
      "expected [field, operator, value]",
    );
    expect(() => validateChildFilter(["field", 42, "val"])).toThrow(
      "expected [field, operator, value]",
    );
  });
});

describe("buildChildQueryArgs", () => {
  it("builds minimal args with defaults", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
    });
    expect(args.doctype).toBe("BOM");
    expect(args.fields).toEqual(["name"]);
    expect(args.limit_page_length).toBe(DEFAULT_LIMIT);
    expect(args.filters).toBeUndefined();
  });

  it("includes parent and child fields", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      parentFields: ["name", "total_cost"],
      childFields: ["item_code", "qty"],
    });
    expect(args.fields).toEqual([
      "name",
      "total_cost",
      "`tabBOM Item`.item_code",
      "`tabBOM Item`.qty",
    ]);
  });

  it("transforms child filters from 3-tuple to 4-tuple", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      childFilters: [["item_code", "like", "%CM5%"]],
    });
    expect(args.filters).toEqual([["BOM Item", "item_code", "like", "%CM5%"]]);
  });

  it("applies parent_filters with implicit = operator", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      parentFilters: { is_active: 1 },
    });
    expect(args.filters).toEqual([["BOM", "is_active", "=", 1]]);
  });

  it("applies parent_filters with explicit operator", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      parentFilters: { docstatus: ["=", "1"] },
    });
    expect(args.filters).toEqual([["BOM", "docstatus", "=", "1"]]);
  });

  it("merges child and parent filters", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      childFilters: [["item_code", "like", "%CM5%"]],
      parentFilters: { is_active: 1 },
    });
    expect(args.filters).toEqual([
      ["BOM Item", "item_code", "like", "%CM5%"],
      ["BOM", "is_active", "=", 1],
    ]);
  });

  it("uses custom limit when provided", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      limit: 50,
    });
    expect(args.limit_page_length).toBe(50);
  });

  it("rejects invalid parent doctype", () => {
    expect(() =>
      buildChildQueryArgs({
        parentDoctype: "BOM; DROP TABLE",
        childDoctype: "BOM Item",
      }),
    ).toThrow("Invalid parent_doctype");
  });

  it("rejects invalid child field names", () => {
    expect(() =>
      buildChildQueryArgs({
        parentDoctype: "BOM",
        childDoctype: "BOM Item",
        childFields: ["item_code; DROP TABLE"],
      }),
    ).toThrow("Invalid field name in child_fields");
  });

  it("rejects malformed child_filters", () => {
    expect(() =>
      buildChildQueryArgs({
        parentDoctype: "BOM",
        childDoctype: "BOM Item",
        childFilters: [["field", "="] as unknown as [string, string, string]],
      }),
    ).toThrow("expected [field, operator, value]");
  });

  it("coerces JSON string parentFields", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      parentFields: '["name", "total_cost"]',
    });
    expect(args.fields).toContain("name");
    expect(args.fields).toContain("total_cost");
  });

  it("coerces JSON string childFields", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      childFields: '["item_code", "qty"]',
    });
    expect(args.fields).toContain("`tabBOM Item`.item_code");
    expect(args.fields).toContain("`tabBOM Item`.qty");
  });

  it("coerces JSON string childFilters", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      childFilters: '[["item_code", "like", "%CM5%"]]',
    });
    expect(args.filters).toEqual([["BOM Item", "item_code", "like", "%CM5%"]]);
  });

  it("coerces JSON string parentFilters", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      parentFilters: '{"is_active": 1}',
    });
    expect(args.filters).toEqual([["BOM", "is_active", "=", 1]]);
  });

  it("coerces string limit", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      limit: "50",
    });
    expect(args.limit_page_length).toBe(50);
  });

  it("defaults parentFields to ['name'] when empty array", () => {
    const args = buildChildQueryArgs({
      parentDoctype: "BOM",
      childDoctype: "BOM Item",
      parentFields: [],
    });
    expect(args.fields).toEqual(["name"]);
  });
});
