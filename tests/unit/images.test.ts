import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAndValidateImage } from "../../src/images.js";
import { createSolidPng } from "../helpers.js";

describe("downloadAndValidateImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resizes non-1024 inputs with transparent padding", async () => {
    const source = await createSolidPng(800, 600, { r: 255, g: 0, b: 0 });
    const fetchMock = vi.fn(async () => new Response(source, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadAndValidateImage("mock://image");
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
    expect(result.format).toBe("png");

    const corner = await sharp(result.buffer)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(corner[3]).toBe(0);

    const center = await sharp(result.buffer)
      .ensureAlpha()
      .extract({ left: 512, top: 512, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(center[0]).toBe(255);
    expect(center[1]).toBe(0);
    expect(center[2]).toBe(0);
    expect(center[3]).toBe(255);
  });
});
