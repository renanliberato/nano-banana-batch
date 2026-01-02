import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { runNanoBananaProBatch } from "../../src/index.js";
import { buildGridSpec } from "../../src/grid.js";
import { buildCombinedPrompt } from "../../src/prompt.js";
import { ReplicateSdkClient } from "../../src/replicate.js";
import { createFetchUpload } from "./upload-with-fetch.js";

const SHOULD_RUN = process.env.RUN_EXAMPLE === "true";
const describeExample = SHOULD_RUN ? describe : describe.skip;

const UPLOAD_ENDPOINT = process.env.UPLOAD_ENDPOINT;
const UPLOAD_API_KEY = process.env.UPLOAD_API_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const EXAMPLE_OUTPUT_DIR = process.env.EXAMPLE_OUTPUT_DIR;
const OUTPUT_ROOT =
  EXAMPLE_OUTPUT_DIR && EXAMPLE_OUTPUT_DIR.startsWith("tests/examples")
    ? EXAMPLE_OUTPUT_DIR
    : "tests/examples/output";
const OUTPUT_FORMAT = (process.env.EXAMPLE_OUTPUT_FORMAT ?? "jpg") as
  | "png"
  | "jpg";
const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const OUTPUT_DIR = join(OUTPUT_ROOT, `example-2x2-${RUN_TIMESTAMP}`);

const execFileAsync = promisify(execFile);

const prepareExampleInputs = async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/prepare-example-inputs.mjs"],
    {
      cwd: process.cwd(),
      env: process.env,
    }
  );
  const marker = "[prepare-example-inputs] Updated sources:";
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Missing updated sources marker in prepare-example-inputs output.");
  }
  const jsonStart = stdout.indexOf("\n", markerIndex);
  const jsonText = jsonStart === -1 ? "" : stdout.slice(jsonStart).trim();
  if (!jsonText) {
    throw new Error("Missing JSON output from prepare-example-inputs.");
  }
  const parsed = JSON.parse(jsonText) as Array<{
    prompt: string;
    resizedUrl: string;
  }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("prepare-example-inputs returned no sources.");
  }
  return parsed;
};

describeExample("runNanoBananaProBatch (example)", () => {
  it(
    "processes a 2x2 batch against live upload and Replicate",
    async () => {
      if (!UPLOAD_ENDPOINT || !UPLOAD_API_KEY || !REPLICATE_API_TOKEN) {
        throw new Error(
          "Missing required env vars: UPLOAD_ENDPOINT, UPLOAD_API_KEY, REPLICATE_API_TOKEN."
        );
      }

      const sources = await prepareExampleInputs();
      const items = sources.map((source) => ({
        imageUrl: source.resizedUrl,
        prompt: source.prompt,
      }));

      const spec = buildGridSpec(items.length, 2048, 5);
      const compiledPrompt = await buildCombinedPrompt(items, spec);
      const ensureOutputDir = async () => {
        await mkdir(OUTPUT_DIR, { recursive: true });
      };
      const outputExt = OUTPUT_FORMAT === "png" ? "png" : "jpg";
      const downloadBuffer = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to download ${url}: ${response.status} ${response.statusText}`
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      };
      console.log("[example] Upload endpoint:", UPLOAD_ENDPOINT);
      console.log("[example] Output dir:", OUTPUT_DIR);
      console.log("[example] Compiled prompt:\n", compiledPrompt);

      const uploadWithFetch = createFetchUpload({
        endpoint: UPLOAD_ENDPOINT,
        apiKey: UPLOAD_API_KEY,
        outputFormat: OUTPUT_FORMAT,
      });
      const replicateClient = new ReplicateSdkClient(REPLICATE_API_TOKEN);

      const results = await runNanoBananaProBatch(items, {
        outputFormat: OUTPUT_FORMAT,
        upload: async (buffer) => {
          console.log(
            "[example] Uploading grid image:",
            `${buffer.byteLength} bytes`,
            `format=${OUTPUT_FORMAT}`
          );
          await ensureOutputDir();
          const gridPath = join(
            OUTPUT_DIR,
            OUTPUT_FORMAT === "png" ? "grid.png" : "grid.jpg"
          );
          await writeFile(gridPath, buffer);
          console.log(`[example] Wrote ${gridPath}`);
          const url = await uploadWithFetch(buffer);
          console.log("[example] Upload url:", url);
          return url;
        },
        replicate: {
          client: {
            async run(modelId, { input }) {
              console.log("[example] Replicate model:", modelId);
              console.log("[example] Replicate input:", input);
              const imageInput = (input as { image_input?: unknown }).image_input;
              console.log(
                "[example] Replicate image_input type:",
                Array.isArray(imageInput) ? "array" : typeof imageInput
              );
              const output = await replicateClient.run(modelId, { input });
              console.log("[example] Replicate output type:", typeof output);
              if (Buffer.isBuffer(output)) {
                console.log(
                  "[example] Replicate output buffer:",
                  `${output.byteLength} bytes`
                );
                await ensureOutputDir();
                const gridPath = join(OUTPUT_DIR, `grid-response.${outputExt}`);
                await writeFile(gridPath, output);
                console.log(`[example] Wrote ${gridPath}`);
                return output;
              }
              if (typeof output === "string") {
                console.log("[example] Replicate output url:", output);
                const buffer = await downloadBuffer(output);
                await ensureOutputDir();
                const gridPath = join(OUTPUT_DIR, `grid-response.${outputExt}`);
                await writeFile(gridPath, buffer);
                console.log(`[example] Wrote ${gridPath}`);
                return buffer;
              }
              if (
                output &&
                typeof (output as { url?: () => string }).url === "function"
              ) {
                const url = (output as { url: () => string }).url();
                console.log("[example] Replicate output url():", url);
                const buffer = await downloadBuffer(url);
                await ensureOutputDir();
                const gridPath = join(OUTPUT_DIR, `grid-response.${outputExt}`);
                await writeFile(gridPath, buffer);
                console.log(`[example] Wrote ${gridPath}`);
                return buffer;
              }
              if (output && typeof (output as { url?: string }).url === "string") {
                console.log(
                  "[example] Replicate output url:",
                  (output as { url: string }).url
                );
                const url = (output as { url: string }).url;
                const buffer = await downloadBuffer(url);
                await ensureOutputDir();
                const gridPath = join(OUTPUT_DIR, `grid-response.${outputExt}`);
                await writeFile(gridPath, buffer);
                console.log(`[example] Wrote ${gridPath}`);
                return buffer;
              }
              if (
                output &&
                typeof (output as { arrayBuffer?: () => Promise<ArrayBuffer> })
                  .arrayBuffer === "function"
              ) {
                const original =
                  output as unknown as { arrayBuffer: () => Promise<ArrayBuffer> };
                const arrayBuffer = await original.arrayBuffer();
                console.log(
                  "[example] Replicate output arrayBuffer:",
                  `${arrayBuffer.byteLength} bytes`
                );
                const buffer = Buffer.from(arrayBuffer);
                await ensureOutputDir();
                const gridPath = join(OUTPUT_DIR, `grid-response.${outputExt}`);
                await writeFile(gridPath, buffer);
                console.log(`[example] Wrote ${gridPath}`);
                return buffer;
              }
              return output;
            },
          },
        },
      });

      expect(results).toHaveLength(4);

      await ensureOutputDir();

      await Promise.all(
        results.map(async (result, index) => {
          expect(result.prompt).toBe(items[index].prompt);
          expect(result.inputImageUrl).toBe(items[index].imageUrl);
          expect(result.outputFormat).toBe(OUTPUT_FORMAT);
          expect(result.outputImage.byteLength).toBeGreaterThan(0);

          const metadata = await sharp(result.outputImage).metadata();
          expect(metadata.width).toBe(spec.cellSize);
          expect(metadata.height).toBe(spec.cellSize);

          console.log(
            `[example] Tile ${index + 1}:`,
            `${metadata.width}x${metadata.height}`,
            `${result.outputImage.byteLength} bytes`
          );

          const outputPath = join(
            OUTPUT_DIR,
            `tile-${index + 1}.${outputExt}`
          );
          await writeFile(outputPath, result.outputImage);
          console.log(`[example] Wrote ${outputPath}`);
        })
      );
    },
    { timeout: 720_000 }
  );
});
