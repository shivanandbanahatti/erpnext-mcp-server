import { describe, expect, it } from "vitest";
import {
  buildFlowDiagramScene,
  EMPTY_EXCALIDRAW_SCENE,
  normalizeSceneJson,
} from "./workshop-board.js";

describe("normalizeSceneJson", () => {
  it("returns default empty scene when null", () => {
    const out = normalizeSceneJson(null);
    expect(JSON.parse(out)).toEqual(EMPTY_EXCALIDRAW_SCENE);
  });

  it("stringifies objects", () => {
    const scene = { type: "excalidraw", version: 2, elements: [{ id: "a" }] };
    expect(JSON.parse(normalizeSceneJson(scene))).toEqual(scene);
  });

  it("accepts valid JSON strings", () => {
    const raw = '{"type":"excalidraw","version":2,"elements":[]}';
    expect(normalizeSceneJson(raw)).toBe(raw);
  });
});

describe("buildFlowDiagramScene", () => {
  it("builds boxes, labels, and arrows for each step", () => {
    const scene = buildFlowDiagramScene(["A", "B", "C"], { title: "Flow" });
    const elements = scene.elements as { type: string }[];
    const types = elements.map((e) => e.type);
    expect(types).toContain("rectangle");
    expect(types).toContain("text");
    expect(types).toContain("arrow");
    expect(elements.length).toBeGreaterThanOrEqual(7);
  });
});
