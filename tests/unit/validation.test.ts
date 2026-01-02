import { describe, expect, it } from "vitest";
import { assertOutputFormat, assertValidItems } from "../../src/validation.js";

const validItems = Array.from({ length: 4 }, (_, index) => ({
  prompt: `Prompt ${index + 1}`,
  imageUrl: `https://example.com/${index + 1}.png`,
}));

describe("validation", () => {
  it("assertValidItems accepts 4 items", () => {
    expect(() => assertValidItems(validItems)).not.toThrow();
  });

  it("assertValidItems rejects invalid length", () => {
    expect(() => assertValidItems(validItems.slice(0, 3))).toThrow(
      "Items array length must be 4 or 9."
    );
  });

  it("assertValidItems rejects empty prompt", () => {
    const items = [...validItems];
    items[0] = { ...items[0], prompt: "" };
    expect(() => assertValidItems(items)).toThrow("Item 0 has an invalid prompt.");
  });

  it("assertOutputFormat accepts png and jpg", () => {
    expect(() => assertOutputFormat("png")).not.toThrow();
    expect(() => assertOutputFormat("jpg")).not.toThrow();
  });

  it("assertOutputFormat rejects other values", () => {
    expect(() => assertOutputFormat("gif")).toThrow(
      "outputFormat must be \"png\" or \"jpg\"."
    );
  });
});
