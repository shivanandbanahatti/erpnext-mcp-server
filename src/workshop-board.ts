/**
 * Workshop Board MCP tools — wrap workshop_board.api.board whitelisted methods.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { extractErrorDetail } from "./errors.js";

export const WORKSHOP_BOARD_METHODS = {
  create: "workshop_board.api.board.create_board",
  get: "workshop_board.api.board.get_board",
  save: "workshop_board.api.board.save_board",
} as const;

export const EMPTY_EXCALIDRAW_SCENE = {
  type: "excalidraw",
  version: 2,
  source: "erpnext-mcp-server",
  elements: [],
  appState: {},
  files: {},
} as const;

function randomId(): string {
  return Math.random().toString(36).slice(2, 15);
}

function elementBase(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    strokeColor: "#1e1e1e",
    backgroundColor: "#a5d8ff",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    angle: 0,
    groupIds: [] as string[],
    frameId: null,
    link: null,
    index: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    isDeleted: false,
    locked: false,
    boundElements: null as { id: string; type: string }[] | null,
    updated: Date.now(),
    ...overrides,
  };
}

/**
 * Build a vertical flow-diagram Excalidraw scene (boxes + labels + arrows).
 * Use as `initial_scene_json` in create_workshop_board or `scene_json` in save_workshop_board.
 */
export function buildFlowDiagramScene(
  steps: string[],
  options?: { title?: string; startX?: number; startY?: number },
): Record<string, unknown> {
  const startX = options?.startX ?? 120;
  const startY = options?.startY ?? 80;
  const boxW = 220;
  const boxH = 72;
  const gapY = 48;
  const elements: Record<string, unknown>[] = [];

  if (options?.title) {
    const titleId = randomId();
    elements.push(
      elementBase({
        id: titleId,
        type: "text",
        x: startX,
        y: startY - 56,
        width: boxW + 80,
        height: 36,
        backgroundColor: "transparent",
        text: options.title,
        fontSize: 28,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: 28,
        containerId: null,
        originalText: options.title,
        lineHeight: 1.25,
      }),
    );
  }

  const boxIds: string[] = [];

  steps.forEach((label, index) => {
    const boxId = randomId();
    const textId = randomId();
    const y = startY + index * (boxH + gapY);
    const isDecision = label.toLowerCase().includes("?");

    boxIds.push(boxId);
    elements.push(
      elementBase({
        id: boxId,
        type: isDecision ? "diamond" : "rectangle",
        x: startX,
        y,
        width: boxW,
        height: boxH,
        backgroundColor: isDecision ? "#ffec99" : "#a5d8ff",
        roundness: isDecision ? null : { type: 3 },
        boundElements: [{ id: textId, type: "text" }],
      }),
    );
    elements.push(
      elementBase({
        id: textId,
        type: "text",
        x: startX + 12,
        y: y + (isDecision ? 18 : 22),
        width: boxW - 24,
        height: boxH - 20,
        backgroundColor: "transparent",
        roundness: null,
        boundElements: null,
        text: label,
        fontSize: 18,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        baseline: 18,
        containerId: boxId,
        originalText: label,
        lineHeight: 1.25,
      }),
    );

    if (index > 0) {
      const prevY = startY + (index - 1) * (boxH + gapY);
      const arrowId = randomId();
      const fromBottom = prevY + boxH;
      const arrowLen = y - fromBottom;
      elements.push(
        elementBase({
          id: arrowId,
          type: "arrow",
          x: startX + boxW / 2,
          y: fromBottom,
          width: 0,
          height: arrowLen,
          backgroundColor: "transparent",
          roundness: null,
          boundElements: null,
          points: [
            [0, 0],
            [0, arrowLen],
          ],
          lastCommittedPoint: null,
          startBinding: null,
          endBinding: null,
          startArrowhead: null,
          endArrowhead: "arrow",
          elbowed: false,
        }),
      );
    }
  });

  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
    },
    files: {},
  };
}

export interface WorkshopBoardApiClient {
  callMethod(
    method: string,
    args?: Record<string, unknown>,
    httpMethod?: "GET" | "POST",
  ): Promise<unknown>;
}

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function toolText(data: unknown, isError = false): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function toolError(message: string): ToolResult {
  return toolText({ error: message }, true);
}

/** Normalize scene_json from MCP args (object or JSON string). */
export function normalizeSceneJson(raw: unknown): string {
  if (raw == null) {
    return JSON.stringify(EMPTY_EXCALIDRAW_SCENE);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return JSON.stringify(EMPTY_EXCALIDRAW_SCENE);
    }
    JSON.parse(trimmed);
    return trimmed;
  }
  if (typeof raw === "object") {
    return JSON.stringify(raw);
  }
  throw new McpError(ErrorCode.InvalidParams, "scene_json must be a JSON object or string");
}

export const WORKSHOP_BOARD_TOOLS = [
  {
    name: "create_workshop_board",
    description:
      "Create a Workshop Board (Excalidraw whiteboard) on a Frappe site with workshop_board installed. Returns board name (e.g. WB-00001). Optionally link to a Project or Task via reference_doctype/reference_name.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Board title (required)",
        },
        reference_doctype: {
          type: "string",
          description: "Optional linked DocType (e.g. Project, Task)",
        },
        reference_name: {
          type: "string",
          description: "Optional linked document name",
        },
        initial_scene_json: {
          type: "object",
          additionalProperties: true,
          description:
            "Optional Excalidraw scene JSON object. If omitted, an empty scene is saved after create via save_workshop_board.",
        },
        flow_diagram_steps: {
          type: "array",
          items: { type: "string" },
          description:
            "Shortcut: build a vertical flow diagram (boxes + arrows). Example: [\"Start\", \"Review request\", \"Approved?\", \"Done\"]. Ignored if initial_scene_json is set.",
        },
        flow_diagram_title: {
          type: "string",
          description: "Optional heading shown above flow_diagram_steps boxes",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_workshop_board",
    description:
      "Load a Workshop Board and its Excalidraw scene. Provide name, or reference_doctype + reference_name (auto-creates when missing if the API user has permission).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Workshop Board name (e.g. WB-00001)",
        },
        reference_doctype: {
          type: "string",
          description: "Linked DocType when loading by reference",
        },
        reference_name: {
          type: "string",
          description: "Linked document name when loading by reference",
        },
      },
    },
  },
  {
    name: "save_workshop_board",
    description:
      "Update a Workshop Board Excalidraw scene (and optional title/preview). Sets status from Draft to Active when saving. scene_json is required.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Workshop Board name (e.g. WB-00001)",
        },
        scene_json: {
          description: "Excalidraw scene as JSON object or string",
        },
        title: {
          type: "string",
          description: "Optional new title",
        },
        preview_svg: {
          type: "string",
          description: "Optional SVG preview markup",
        },
      },
      required: ["name", "scene_json"],
    },
  },
  {
    name: "list_workshop_boards",
    description:
      "List Workshop Board documents with optional filters (title, status, reference).",
    inputSchema: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          items: { type: "string" },
          description:
            'Fields to return (default: name, title, status, reference_doctype, reference_name, modified)',
        },
        filters: {
          type: "object",
          additionalProperties: true,
          description: "ERPNext filters, e.g. {\"status\": \"Active\"}",
        },
        limit: {
          type: "number",
          description: "Max rows (default 20)",
        },
      },
    },
  },
] as const;

export type WorkshopBoardToolName = (typeof WORKSHOP_BOARD_TOOLS)[number]["name"];

export interface WorkshopBoardListClient extends WorkshopBoardApiClient {
  getDocList(
    doctype: string,
    filters?: Record<string, unknown>,
    fields?: string[],
    limit?: number,
  ): Promise<unknown[]>;
}

export async function handleWorkshopBoardTool(
  toolName: string,
  args: Record<string, unknown> | undefined,
  client: WorkshopBoardListClient,
): Promise<ToolResult | null> {
  switch (toolName) {
    case "create_workshop_board":
      return handleCreate(args, client);
    case "get_workshop_board":
      return handleGet(args, client);
    case "save_workshop_board":
      return handleSave(args, client);
    case "list_workshop_boards":
      return handleList(args, client);
    default:
      return null;
  }
}

async function handleCreate(
  args: Record<string, unknown> | undefined,
  client: WorkshopBoardApiClient,
): Promise<ToolResult> {
  const title = args?.title;
  if (typeof title !== "string" || !title.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "title is required");
  }

  const methodArgs: Record<string, unknown> = { title: title.trim() };
  if (typeof args?.reference_doctype === "string" && args.reference_doctype) {
    methodArgs.reference_doctype = args.reference_doctype;
  }
  if (typeof args?.reference_name === "string" && args.reference_name) {
    methodArgs.reference_name = args.reference_name;
  }

  try {
    const created = (await client.callMethod(WORKSHOP_BOARD_METHODS.create, methodArgs)) as {
      name: string;
    };

    let saved: unknown = null;
    let sceneToSave: unknown = args?.initial_scene_json;

    if (sceneToSave == null && Array.isArray(args?.flow_diagram_steps)) {
      const steps = args.flow_diagram_steps.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      );
      if (steps.length) {
        const title =
          typeof args?.flow_diagram_title === "string" ? args.flow_diagram_title : undefined;
        sceneToSave = buildFlowDiagramScene(steps, { title });
      }
    }

    if (sceneToSave != null) {
      const sceneJson = normalizeSceneJson(sceneToSave);
      saved = await client.callMethod(WORKSHOP_BOARD_METHODS.save, {
        name: created.name,
        scene_json: sceneJson,
      });
    }

    return toolText({
      status: "success",
      board: created,
      ...(saved ? { saved } : {}),
      hint: saved
        ? undefined
        : "Call save_workshop_board with scene_json to persist drawing data.",
    });
  } catch (error: unknown) {
    return toolError(`Failed to create Workshop Board: ${extractErrorDetail(error)}`);
  }
}

async function handleGet(
  args: Record<string, unknown> | undefined,
  client: WorkshopBoardApiClient,
): Promise<ToolResult> {
  const name = args?.name;
  const reference_doctype = args?.reference_doctype;
  const reference_name = args?.reference_name;

  const hasName = typeof name === "string" && name;
  const hasRef =
    typeof reference_doctype === "string" &&
    reference_doctype &&
    typeof reference_name === "string" &&
    reference_name;

  if (!hasName && !hasRef) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Provide name or both reference_doctype and reference_name",
    );
  }

  const methodArgs: Record<string, unknown> = {};
  if (hasName) {
    methodArgs.name = name;
  }
  if (hasRef) {
    methodArgs.reference_doctype = reference_doctype;
    methodArgs.reference_name = reference_name;
  }

  try {
    const board = await client.callMethod(WORKSHOP_BOARD_METHODS.get, methodArgs);
    return toolText(board);
  } catch (error: unknown) {
    return toolError(`Failed to get Workshop Board: ${extractErrorDetail(error)}`);
  }
}

async function handleSave(
  args: Record<string, unknown> | undefined,
  client: WorkshopBoardApiClient,
): Promise<ToolResult> {
  const boardName = args?.name;
  if (typeof boardName !== "string" || !boardName) {
    throw new McpError(ErrorCode.InvalidParams, "name is required");
  }
  if (args?.scene_json == null) {
    throw new McpError(ErrorCode.InvalidParams, "scene_json is required");
  }

  const sceneJson = normalizeSceneJson(args.scene_json);
  const methodArgs: Record<string, unknown> = {
    name: boardName,
    scene_json: sceneJson,
  };
  if (typeof args?.title === "string" && args.title) {
    methodArgs.title = args.title;
  }
  if (typeof args?.preview_svg === "string") {
    methodArgs.preview_svg = args.preview_svg;
  }

  try {
    const result = await client.callMethod(WORKSHOP_BOARD_METHODS.save, methodArgs);
    return toolText({ status: "success", ...((result as object) || {}) });
  } catch (error: unknown) {
    return toolError(
      `Failed to save Workshop Board ${boardName}: ${extractErrorDetail(error)}`,
    );
  }
}

async function handleList(
  args: Record<string, unknown> | undefined,
  client: WorkshopBoardListClient,
): Promise<ToolResult> {
  const defaultFields = [
    "name",
    "title",
    "status",
    "reference_doctype",
    "reference_name",
    "modified",
  ];

  let fields = defaultFields;
  if (Array.isArray(args?.fields)) {
    fields = args.fields.filter((f): f is string => typeof f === "string");
  }

  let filters: Record<string, unknown> | undefined;
  if (args?.filters != null) {
    if (typeof args.filters !== "object" || Array.isArray(args.filters)) {
      throw new McpError(ErrorCode.InvalidParams, "filters must be a JSON object");
    }
    filters = args.filters as Record<string, unknown>;
  }

  const limit = typeof args?.limit === "number" ? args.limit : 20;

  try {
    const boards = await client.getDocList("Workshop Board", filters, fields, limit);
    return toolText({ count: boards.length, boards });
  } catch (error: unknown) {
    return toolError(`Failed to list Workshop Boards: ${extractErrorDetail(error)}`);
  }
}
