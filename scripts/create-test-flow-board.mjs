#!/usr/bin/env node
/**
 * Invoke MCP workshop board tools against a site (same code path as Cursor MCP).
 * Usage:
 *   ERPNEXT_URL=https://erp.athrutec.com ERPNEXT_API_KEY=... ERPNEXT_API_SECRET=... \
 *     node scripts/create-test-flow-board.mjs
 */

import axios from "axios";
import https from "https";
import {
  buildFlowDiagramScene,
  handleWorkshopBoardTool,
} from "../build/workshop-board.js";

const baseUrl = (process.env.ERPNEXT_URL || "").replace(/\/$/, "");
const apiKey = process.env.ERPNEXT_API_KEY?.trim();
const apiSecret = process.env.ERPNEXT_API_SECRET?.trim();

if (!baseUrl || !apiKey || !apiSecret) {
  console.error("Set ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET");
  process.exit(1);
}

const insecure = process.env.ERPNEXT_INSECURE_SSL === "1";
const http = axios.create({
  baseURL: baseUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `token ${apiKey}:${apiSecret}`,
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: !insecure }),
});

const client = {
  async callMethod(method, args) {
    const res = await http.post(`/api/method/${method}`, args);
    return res.data.message;
  },
  async getDocList(doctype, filters, fields, limit) {
    const params = {};
    if (fields?.length) params.fields = JSON.stringify(fields);
    if (filters) params.filters = JSON.stringify(filters);
    if (limit) params.limit_page_length = limit;
    const res = await http.get(`/api/resource/${encodeURIComponent(doctype)}`, {
      params,
    });
    return res.data.data;
  },
};

const steps = [
  "Start",
  "Submit request",
  "Manager review",
  "Approved?",
  "Complete",
];

const createResult = await handleWorkshopBoardTool(
  "create_workshop_board",
  {
    title: "MCP Test Workflow",
    flow_diagram_title: "Test approval workflow",
    flow_diagram_steps: steps,
  },
  client,
);

const createPayload = JSON.parse(createResult.content[0].text);
if (createResult.isError || createPayload.error) {
  console.error("CREATE FAILED:", createPayload);
  process.exit(1);
}

const boardName = createPayload.board?.name;
console.log("Created:", boardName);

const getResult = await handleWorkshopBoardTool(
  "get_workshop_board",
  { name: boardName },
  client,
);

const loaded = JSON.parse(getResult.content[0].text);
if (getResult.isError || loaded.error) {
  console.error("GET FAILED:", loaded);
  process.exit(1);
}

const elementCount = loaded.scene?.elements?.length ?? 0;
console.log("Verified:", {
  name: loaded.name,
  title: loaded.title,
  status: loaded.status,
  elementCount,
  editorUrl: `${baseUrl}/app/wb-editor/${encodeURIComponent(boardName)}`,
});

if (elementCount < 5) {
  console.error("Expected flow diagram elements; got", elementCount);
  process.exit(1);
}

console.log("OK — MCP flow diagram board is ready.");
