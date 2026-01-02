import { DEFAULT_GRID_SIZE, DEFAULT_MARGIN, MODEL_ID } from "./constants.js";
import { assertGridImageSize, buildGridImage, buildGridSpec, splitGridImage } from "./grid.js";
import { downloadAndValidateImage } from "./images.js";
import { buildCombinedPrompt } from "./prompt.js";
import { resolveReplicateClient, resolveOutputBuffer } from "./replicate.js";
import { resolveUploadFunction } from "./upload.js";
import { assertFetchAvailable, assertOutputFormat, assertValidItems } from "./validation.js";
import type { NanoBananaBatchItem, NanoBananaBatchOptions, NanoBananaBatchResult } from "./types.js";

export async function runNanoBananaProBatch(
  items: NanoBananaBatchItem[],
  options: NanoBananaBatchOptions
): Promise<NanoBananaBatchResult[]> {
  if (!options) {
    throw new Error("Options are required and must include upload.");
  }
  assertFetchAvailable();
  assertValidItems(items);

  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const margin = options.margin ?? DEFAULT_MARGIN;
  const gridSpec = buildGridSpec(items.length, gridSize, margin);

  const outputFormat = options.outputFormat ?? "png";
  assertOutputFormat(outputFormat);

  const validatedImages = await Promise.all(
    items.map((item) => downloadAndValidateImage(item.imageUrl))
  );

  const gridBuffer = await buildGridImage(
    validatedImages,
    gridSpec,
    outputFormat
  );

  const upload = resolveUploadFunction(options.upload);
  const uploadedUrl = await upload(gridBuffer);

  const prompt = await buildCombinedPrompt(items, gridSpec, options.systemPrompt);

  const replicateClient = resolveReplicateClient(options.replicate);

  const input: Record<string, unknown> = {
    prompt,
    image_input: [uploadedUrl],
    output_format: outputFormat,
    aspect_ratio: options.aspectRatio ?? "match_input_image",
  };

  if (options.resolution) {
    input.resolution = options.resolution;
  }

  if (options.safetyFilterLevel) {
    input.safety_filter_level = options.safetyFilterLevel;
  }

  const output = await replicateClient.run(MODEL_ID, { input });
  const outputBuffer = await resolveOutputBuffer(output);
  await assertGridImageSize(outputBuffer, gridSpec);

  const tiles = await splitGridImage(outputBuffer, gridSpec, outputFormat);

  return tiles.map((buffer, index) => ({
    index,
    prompt: items[index].prompt,
    inputImageUrl: items[index].imageUrl,
    outputImage: buffer,
    outputFormat,
  }));
}

export type {
  AspectRatio,
  NanoBananaBatchItem,
  NanoBananaBatchOptions,
  NanoBananaBatchResult,
  OutputFormat,
  Resolution,
  SafetyFilterLevel,
} from "./types.js";
export type { ReplicateClient, ReplicateOptions } from "./replicate.js";
export type {
  UploadClient,
  UploadFunction,
  UploadHandler,
} from "./upload.js";
