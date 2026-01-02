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
const OUTPUT_DIR = join(OUTPUT_ROOT, `example-3x3-${RUN_TIMESTAMP}`);

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
  const parsed = JSON.parse(jsonText) as Array<{ resizedUrl: string }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("prepare-example-inputs returned no sources.");
  }
  return parsed.map((source) => source.resizedUrl);
};

const prompts = [
  "black shirt",
  "green shirt",
  "sun glasses",
  "black suit",
  "red jacket",
  "blue jeans jacket",
  "yellow scarf",
  "white hat",
  "striped tie",
];

describeExample("runNanoBananaProBatch (example 3x3)", () => {
  it(
    "processes a 3x3 batch against live upload and Replicate",
    async () => {
      if (!UPLOAD_ENDPOINT || !UPLOAD_API_KEY || !REPLICATE_API_TOKEN) {
        throw new Error(
          "Missing required env vars: UPLOAD_ENDPOINT, UPLOAD_API_KEY, REPLICATE_API_TOKEN."
        );
      }

      const sourceUrls = await prepareExampleInputs();
      const items = prompts.map((prompt, index) => ({
        imageUrl: sourceUrls[index % sourceUrls.length],
        prompt,
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
      console.log("[example-3x3] Upload endpoint:", UPLOAD_ENDPOINT);
      console.log("[example-3x3] Output dir:", OUTPUT_DIR);
      console.log("[example-3x3] Compiled prompt:\n", compiledPrompt);

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
            "[example-3x3] Uploading grid image:",
            `${buffer.byteLength} bytes`,
            `format=${OUTPUT_FORMAT}`
          );
          await ensureOutputDir();
          const gridPath = join(OUTPUT_DIR, `grid-3x3.${outputExt}`);
          await writeFile(gridPath, buffer);
          console.log(`[example-3x3] Wrote ${gridPath}`);
          const url = await uploadWithFetch(buffer);
          console.log("[example-3x3] Upload url:", url);
          return url;
        },
        replicate: {
          client: {
            async run(modelId, { input }) {
              console.log("[example-3x3] Replicate model:", modelId);
              console.log("[example-3x3] Replicate input:", input);
              const imageInput = (input as { image_input?: unknown }).image_input;
              console.log(
                "[example-3x3] Replicate image_input type:",
                Array.isArray(imageInput) ? "array" : typeof imageInput
              );
              const output = await replicateClient.run(modelId, { input });
              console.log("[example-3x3] Replicate output type:", typeof output);
              if (Buffer.isBuffer(output)) {
                console.log(
                  "[example-3x3] Replicate output buffer:",
                  `${output.byteLength} bytes`
                );
                await ensureOutputDir();
                const gridPath = join(
                  OUTPUT_DIR,
                  `grid-3x3-response.${outputExt}`
                );
                await writeFile(gridPath, output);
                console.log(`[example-3x3] Wrote ${gridPath}`);
                return output;
              }
              if (typeof output === "string") {
                console.log("[example-3x3] Replicate output url:", output);
                const buffer = await downloadBuffer(output);
                await ensureOutputDir();
                const gridPath = join(
                  OUTPUT_DIR,
                  `grid-3x3-response.${outputExt}`
                );
                await writeFile(gridPath, buffer);
                console.log(`[example-3x3] Wrote ${gridPath}`);
                return buffer;
              }
              if (
                output &&
                typeof (output as { url?: () => string }).url === "function"
              ) {
                const url = (output as { url: () => string }).url();
                console.log("[example-3x3] Replicate output url():", url);
                const buffer = await downloadBuffer(url);
                await ensureOutputDir();
                const gridPath = join(
                  OUTPUT_DIR,
                  `grid-3x3-response.${outputExt}`
                );
                await writeFile(gridPath, buffer);
                console.log(`[example-3x3] Wrote ${gridPath}`);
                return buffer;
              }
              if (output && typeof (output as { url?: string }).url === "string") {
                console.log(
                  "[example-3x3] Replicate output url:",
                  (output as { url: string }).url
                );
                const url = (output as { url: string }).url;
                const buffer = await downloadBuffer(url);
                await ensureOutputDir();
                const gridPath = join(
                  OUTPUT_DIR,
                  `grid-3x3-response.${outputExt}`
                );
                await writeFile(gridPath, buffer);
                console.log(`[example-3x3] Wrote ${gridPath}`);
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
                  "[example-3x3] Replicate output arrayBuffer:",
                  `${arrayBuffer.byteLength} bytes`
                );
                const buffer = Buffer.from(arrayBuffer);
                await ensureOutputDir();
                const gridPath = join(
                  OUTPUT_DIR,
                  `grid-3x3-response.${outputExt}`
                );
                await writeFile(gridPath, buffer);
                console.log(`[example-3x3] Wrote ${gridPath}`);
                return buffer;
              }
              return output;
            },
          },
        },
      });

      expect(results).toHaveLength(9);

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
            `[example-3x3] Tile ${index + 1}:`,
            `${metadata.width}x${metadata.height}`,
            `${result.outputImage.byteLength} bytes`
          );

          const outputPath = join(
            OUTPUT_DIR,
            `tile-3x3-${index + 1}.${outputExt}`
          );
          await writeFile(outputPath, result.outputImage);
          console.log(`[example-3x3] Wrote ${outputPath}`);
        })
      );
    },
    { timeout: 720_000 }
  );
});
