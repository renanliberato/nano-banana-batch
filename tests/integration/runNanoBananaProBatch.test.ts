import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runNanoBananaProBatch } from "../../src/index.js";
import { buildGridSpec } from "../../src/grid.js";
import type { ReplicateClient, UploadFunction } from "../../src/index.js";
import { bufferToArrayBuffer, createSolidPng, getPixel } from "../helpers.js";

const colors = [
  { name: "red", rgb: { r: 255, g: 0, b: 0 } },
  { name: "green", rgb: { r: 0, g: 255, b: 0 } },
  { name: "blue", rgb: { r: 0, g: 0, b: 255 } },
  { name: "yellow", rgb: { r: 255, g: 255, b: 0 } },
];

describe("runNanoBananaProBatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("processes a 2x2 batch with mock upload and replicate", async () => {
    const imageMap = new Map<string, Buffer>();
    const items = [] as { prompt: string; imageUrl: string }[];

    for (const [index, color] of colors.entries()) {
      const url = `mock://image-${index + 1}`;
      const buffer = await createSolidPng(1024, 1024, color.rgb);
      imageMap.set(url, buffer);
      items.push({ prompt: `Prompt ${color.name}`, imageUrl: url });
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const buffer = imageMap.get(url);
      if (!buffer) {
        return new Response("not found", { status: 404 });
      }
      return new Response(buffer, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    let uploadedBuffer: Buffer | null = null;

    const upload: UploadFunction = async (buffer) => {
      uploadedBuffer = buffer;
      return "mock://upload";
    };

    const replicateClient: ReplicateClient = {
      async run(modelId, { input }) {
        expect(modelId).toBe("google/nano-banana-pro");
        const typedInput = input as { image_input?: string[]; prompt?: string };
        expect(typedInput.image_input).toEqual(["mock://upload"]);
        expect(String(typedInput.prompt)).toContain("Tile prompts");

        if (!uploadedBuffer) {
          throw new Error("Missing uploaded buffer");
        }

        return {
          arrayBuffer: async () => bufferToArrayBuffer(uploadedBuffer),
        };
      },
    };

    const results = await runNanoBananaProBatch(items, {
      outputFormat: "png",
      upload,
      replicate: { client: replicateClient },
    });

    expect(results).toHaveLength(4);

    const spec = buildGridSpec(items.length, 2048, 5);
    const center = Math.floor(spec.cellSize / 2);

    await Promise.all(
      results.map(async (result, index) => {
        const metadata = await sharp(result.outputImage).metadata();
        expect(metadata.width).toBe(spec.cellSize);
        expect(metadata.height).toBe(spec.cellSize);
        expect(result.outputFormat).toBe("png");

        const pixel = await getPixel(result.outputImage, center, center);
        expect(pixel).toEqual(colors[index].rgb);
      })
    );
  });
});
