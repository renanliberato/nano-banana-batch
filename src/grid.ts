import sharp from "sharp";
import type { OutputFormat } from "./types.js";
import type { ValidatedImage } from "./images.js";

export interface GridSpec {
  gridSize: number;
  cells: number;
  margin: number;
  cellSize: number;
  paddingLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
}

export function buildGridSpec(count: number, gridSize: number, margin: number): GridSpec {
  const cells = Math.sqrt(count);
  if (cells !== 2 && cells !== 3) {
    throw new Error("Grid size must be 2x2 or 3x3.");
  }

  if (!Number.isInteger(gridSize) || gridSize <= 0) {
    throw new Error("gridSize must be a positive integer.");
  }

  if (!Number.isInteger(margin) || margin < 0) {
    throw new Error("margin must be a non-negative integer.");
  }

  const innerMargin = margin * (cells - 1);
  const cellSize = Math.floor((gridSize - innerMargin) / cells);
  if (cellSize <= 0) {
    throw new Error("Computed cell size is invalid.");
  }

  const contentSize = cellSize * cells + innerMargin;
  const extra = gridSize - contentSize;
  const paddingLeft = Math.floor(extra / 2);
  const paddingTop = Math.floor(extra / 2);
  const paddingRight = extra - paddingLeft;
  const paddingBottom = extra - paddingTop;

  return {
    gridSize,
    cells,
    margin,
    cellSize,
    paddingLeft,
    paddingTop,
    paddingRight,
    paddingBottom,
  };
}

export function gridPosition(index: number, spec: GridSpec): { left: number; top: number } {
  const row = Math.floor(index / spec.cells);
  const col = index % spec.cells;
  const left = spec.paddingLeft + col * (spec.cellSize + spec.margin);
  const top = spec.paddingTop + row * (spec.cellSize + spec.margin);
  return { left, top };
}

export async function buildGridImage(
  images: ValidatedImage[],
  spec: GridSpec,
  outputFormat: OutputFormat
): Promise<Buffer> {
  const composites = await Promise.all(
    images.map(async (image, index) => {
      const resized = await sharp(image.buffer)
        .rotate()
        .resize(spec.cellSize, spec.cellSize, { fit: "fill" })
        .toBuffer();

      const position = gridPosition(index, spec);
      return {
        input: resized,
        left: position.left,
        top: position.top,
      };
    })
  );

  const base = sharp({
    create: {
      width: spec.gridSize,
      height: spec.gridSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).composite(composites);

  return outputFormat === "png"
    ? base.png().toBuffer()
    : base.jpeg({ quality: 95 }).toBuffer();
}

export async function splitGridImage(
  outputBuffer: Buffer,
  spec: GridSpec,
  outputFormat: OutputFormat
): Promise<Buffer[]> {
  const base = sharp(outputBuffer);
  const tasks = Array.from({ length: spec.cells * spec.cells }, (_, index) => {
    const position = gridPosition(index, spec);
    const extracted = base.clone().extract({
      left: position.left,
      top: position.top,
      width: spec.cellSize,
      height: spec.cellSize,
    });

    return outputFormat === "png"
      ? extracted.png().toBuffer()
      : extracted.jpeg({ quality: 95 }).toBuffer();
  });

  return Promise.all(tasks);
}

export async function assertGridImageSize(
  outputBuffer: Buffer,
  spec: GridSpec
): Promise<void> {
  const outputMetadata = await sharp(outputBuffer).metadata();
  if (!outputMetadata.width || !outputMetadata.height) {
    throw new Error("Unable to read output image dimensions.");
  }
  if (outputMetadata.width !== spec.gridSize || outputMetadata.height !== spec.gridSize) {
    throw new Error(
      `Unexpected output size ${outputMetadata.width}x${outputMetadata.height}. Expected ${spec.gridSize}x${spec.gridSize}.`
    );
  }
}
