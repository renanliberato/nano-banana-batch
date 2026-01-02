import { describe, expect, it } from "vitest";
import { buildGridSpec } from "../../src/grid.js";
import { buildCombinedPrompt, describePosition, renderTemplate } from "../../src/prompt.js";

const items = [
  { prompt: "first", imageUrl: "https://example.com/1" },
  { prompt: "second", imageUrl: "https://example.com/2" },
  { prompt: "third", imageUrl: "https://example.com/3" },
  { prompt: "fourth", imageUrl: "https://example.com/4" },
];

describe("prompt", () => {
  it("renderTemplate replaces known placeholders", () => {
    const template = "Grid {{cells}} size {{gridSize}} {{missing}}";
    const result = renderTemplate(template, { cells: 2, gridSize: 2048 });
    expect(result).toBe("Grid 2 size 2048 {{missing}}");
  });

  it("describePosition labels row and column", () => {
    expect(describePosition(0, 2)).toBe("row 1, col 1, top-left");
    expect(describePosition(3, 2)).toBe("row 2, col 2, bottom-right");
    expect(describePosition(4, 3)).toBe("row 2, col 2, middle-center");
  });

  it("buildCombinedPrompt injects tiles and positions", async () => {
    const spec = buildGridSpec(items.length, 2048, 5);
    const systemPrompt = "Grid {{cells}}x{{cells}} size {{gridSize}}";
    const prompt = await buildCombinedPrompt(items, spec, systemPrompt);

    expect(prompt).toContain("Grid 2x2 size 2048");
    expect(prompt).toContain("1. (row 1, col 1, top-left): first");
    expect(prompt).toContain("2. (row 1, col 2, top-right): second");
    expect(prompt).toContain("3. (row 2, col 1, bottom-left): third");
    expect(prompt).toContain("4. (row 2, col 2, bottom-right): fourth");
  });
});
