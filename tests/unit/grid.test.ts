import { describe, expect, it } from "vitest";
import { buildGridImage, buildGridSpec, gridPosition, splitGridImage } from "../../src/grid.js";
import type { ValidatedImage } from "../../src/images.js";
import { createSolidPng, getPixel } from "../helpers.js";

const colors = [
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
];

describe("grid", () => {
  it("buildGridSpec computes 2x2 layout", () => {
    const spec = buildGridSpec(4, 2048, 5);
    expect(spec.cells).toBe(2);
    expect(spec.cellSize).toBe(1021);
    expect(spec.margin).toBe(5);
    expect(spec.paddingLeft).toBe(0);
    expect(spec.paddingRight).toBe(1);
  });

  it("gridPosition maps tile indexes", () => {
    const spec = buildGridSpec(4, 2048, 5);
    expect(gridPosition(0, spec)).toEqual({ left: 0, top: 0 });
    expect(gridPosition(1, spec)).toEqual({ left: 1026, top: 0 });
    expect(gridPosition(2, spec)).toEqual({ left: 0, top: 1026 });
    expect(gridPosition(3, spec)).toEqual({ left: 1026, top: 1026 });
  });

  it("buildGridImage and splitGridImage preserve tile colors", async () => {
    const spec = buildGridSpec(4, 2048, 5);
    const buffers = await Promise.all(
      colors.map((color) => createSolidPng(1024, 1024, color))
    );
    const images: ValidatedImage[] = buffers.map((buffer) => ({
      buffer,
      format: "png",
    }));

    const grid = await buildGridImage(images, spec, "png");
    const tiles = await splitGridImage(grid, spec, "png");

    expect(tiles).toHaveLength(4);

    const center = Math.floor(spec.cellSize / 2);
    const samples = await Promise.all(
      tiles.map((tile) => getPixel(tile, center, center))
    );

    samples.forEach((pixel, index) => {
      expect(pixel).toEqual(colors[index]);
    });
  });
});
