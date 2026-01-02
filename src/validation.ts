import type { NanoBananaBatchItem, OutputFormat } from "./types.js";

export function assertFetchAvailable(): void {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available. Use Node.js 18+.");
  }
}

export function assertValidItems(items: NanoBananaBatchItem[]): void {
  if (!Array.isArray(items)) {
    throw new Error("Items must be an array.");
  }

  if (items.length !== 4 && items.length !== 9) {
    throw new Error("Items array length must be 4 or 9.");
  }

  items.forEach((item, index) => {
    if (!item || typeof item.prompt !== "string" || item.prompt.trim().length === 0) {
      throw new Error(`Item ${index} has an invalid prompt.`);
    }
    if (!item.imageUrl || typeof item.imageUrl !== "string") {
      throw new Error(`Item ${index} has an invalid imageUrl.`);
    }
  });
}

export function assertOutputFormat(value: string): asserts value is OutputFormat {
  if (value !== "png" && value !== "jpg") {
    throw new Error("outputFormat must be \"png\" or \"jpg\".");
  }
}
