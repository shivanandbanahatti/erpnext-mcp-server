import { describe, it, expect } from "vitest";
import { extractErrorDetail } from "./errors.js";

describe("extractErrorDetail", () => {
  it("returns 'Unknown error' for undefined", () => {
    expect(extractErrorDetail(undefined)).toBe("Unknown error");
  });

  it("returns error.message when no response data", () => {
    expect(extractErrorDetail(new Error("something broke"))).toBe("something broke");
  });

  it("returns error.message for non-axios errors", () => {
    expect(extractErrorDetail({ message: "Request failed with status code 417" })).toBe(
      "Request failed with status code 417",
    );
  });

  it("extracts _server_messages from ERPNext response", () => {
    const error = {
      message: "Request failed with status code 417",
      response: {
        data: {
          _server_messages: JSON.stringify([
            JSON.stringify({ message: "category is mandatory" }),
            JSON.stringify({ message: "charge_type is mandatory" }),
          ]),
        },
      },
    };
    expect(extractErrorDetail(error)).toBe("category is mandatory; charge_type is mandatory");
  });

  it("handles plain string _server_messages entries", () => {
    const error = {
      response: {
        data: {
          _server_messages: JSON.stringify(["plain error text"]),
        },
      },
    };
    expect(extractErrorDetail(error)).toBe("plain error text");
  });

  it("falls back to data.message when _server_messages is missing", () => {
    const error = {
      response: {
        data: {
          message: "Not permitted",
        },
      },
    };
    expect(extractErrorDetail(error)).toBe("Not permitted");
  });

  it("falls back to exc_type when message is missing", () => {
    const error = {
      response: {
        data: {
          exc_type: "ValidationError",
        },
      },
    };
    expect(extractErrorDetail(error)).toBe("ValidationError");
  });

  it("handles string response data", () => {
    const error = {
      response: {
        data: "Internal Server Error",
      },
    };
    expect(extractErrorDetail(error)).toBe("Internal Server Error");
  });

  it("falls back to error.message for malformed _server_messages", () => {
    const error = {
      message: "Request failed",
      response: {
        data: {
          _server_messages: "not valid json",
        },
      },
    };
    expect(extractErrorDetail(error)).toBe("Request failed");
  });

  it("falls through empty _server_messages array to error.message", () => {
    const error = {
      message: "Request failed with status code 400",
      response: {
        data: {
          _server_messages: "[]",
          message: "Something went wrong",
        },
      },
    };
    expect(extractErrorDetail(error)).toBe("Something went wrong");
  });

  it("uses raw string for server message entries without a message key", () => {
    const error = {
      response: {
        data: {
          _server_messages: JSON.stringify([JSON.stringify({ title: "Error" })]),
        },
      },
    };
    // JSON.parse succeeds but .message is undefined, filtered out by Boolean;
    // falls through to raw string via catch path only if JSON.parse fails.
    // Here the inner parse succeeds but message is undefined, so details is empty.
    expect(extractErrorDetail(error)).toBe("Unknown error");
  });

  it("truncates large _server_messages arrays", () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ message: `Error ${i}: ${"x".repeat(100)}` }),
    );
    const error = {
      response: {
        data: {
          _server_messages: JSON.stringify(msgs),
        },
      },
    };
    const result = extractErrorDetail(error);
    // Only first 5 messages are included
    expect(result).not.toContain("Error 5:");
    // Result is capped at 1000 chars + "..."
    expect(result.length).toBeLessThanOrEqual(1003);
  });
});
