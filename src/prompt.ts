import { readFile } from "node:fs/promises";
import { SYSTEM_PROMPT_TEMPLATE_URL } from "./constants.js";
import type { GridSpec } from "./grid.js";
import type { NanoBananaBatchItem } from "./types.js";

let cachedSystemPromptTemplate: string | null = null;

export async function buildCombinedPrompt(
  items: NanoBananaBatchItem[],
  spec: GridSpec,
  systemPrompt?: string
): Promise<string> {
  const template = systemPrompt ?? (await loadSystemPromptTemplate());
  const basePrompt = renderTemplate(template, {
    cells: spec.cells,
    margin: spec.margin,
    gridSize: spec.gridSize,
    cellSize: spec.cellSize,
  }).trim();

  const promptLines = items.map((item, index) => {
    const position = describePosition(index, spec.cells);
    return `${index + 1}. (${position}): ${item.prompt}`;
  });

  return `${basePrompt}\n\nTile prompts (row-major, left-to-right, top-to-bottom):\n${promptLines.join("\n")}`;
}

export function renderTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return match;
  });
}

export function describePosition(index: number, cells: number): string {
  const row = Math.floor(index / cells);
  const col = index % cells;
  const rowLabels = cells === 2 ? ["top", "bottom"] : ["top", "middle", "bottom"];
  const colLabels = cells === 2 ? ["left", "right"] : ["left", "center", "right"];
  const rowName = rowLabels[row] ?? `row${row + 1}`;
  const colName = colLabels[col] ?? `col${col + 1}`;
  return `row ${row + 1}, col ${col + 1}, ${rowName}-${colName}`;
}

async function loadSystemPromptTemplate(): Promise<string> {
  if (cachedSystemPromptTemplate) {
    return cachedSystemPromptTemplate;
  }

  const template = await readFile(SYSTEM_PROMPT_TEMPLATE_URL, "utf8");
  cachedSystemPromptTemplate = template;
  return template;
}
