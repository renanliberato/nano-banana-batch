# nano-banana-batch

Batch wrapper for Replicate `google/nano-banana-pro`. It packs 4 or 9 prompt+image pairs into a single grid request, runs the model once, then splits the output back into tiles.

## Why this exists

- One model call handles multiple edits, so you pay the overhead once.
- Consistent layout: tiles are positioned deterministically in a 2x2 or 3x3 grid.
- Drop-in: you supply URLs, prompts, and an upload function.

## How it works

1. Downloads each input image, validates it is PNG/JPEG, and resizes to 1024x1024 if needed.
2. Builds a 2048x2048 grid with 5px white margins between tiles.
3. Uploads the grid to your image host.
4. Compiles a grid-aware prompt (with per-tile instructions).
5. Calls Replicate with `image_input` set to the uploaded grid URL.
6. Splits the model output back into individual tiles.

## Requirements

- Node.js 18+ (global `fetch` is required).
- `sharp` native dependency; most platforms use prebuilt binaries, but some environments need libvips toolchain.
- ESM-only package (no CJS build).

## Usage

```ts
import { writeFile } from "node:fs/promises";
import { runNanoBananaProBatch } from "nano-banana-batch";

const results = await runNanoBananaProBatch(
  [
    { prompt: "Make it sunset", imageUrl: "https://example.com/a.png" },
    { prompt: "Add neon lights", imageUrl: "https://example.com/b.png" },
    { prompt: "Make it winter", imageUrl: "https://example.com/c.png" },
    { prompt: "Make it rainy", imageUrl: "https://example.com/d.png" }
  ],
  {
    replicate: { token: process.env.REPLICATE_API_TOKEN },
    upload: async (buffer) => {
      // See "Upload helper (fetch + multipart)" below for a full implementation.
      return "https://your-hosted-url";
    },
    outputFormat: "png",
    resolution: "2K",
    aspectRatio: "match_input_image",
    safetyFilterLevel: "block_only_high"
  }
);

await Promise.all(
  results.map((result, index) =>
    writeFile(`output-${index + 1}.png`, result.outputImage)
  )
);
```

## API

### `runNanoBananaProBatch(items, options)`

- `items`: array of 4 or 9 `{ prompt, imageUrl }` entries.
- `options.upload`: required upload handler; receives a grid `Buffer` and returns a public URL.
- `options.replicate`: `{ token?: string; client?: ReplicateClient }` to configure auth or inject a client.
- `options.outputFormat`: `"png"` (default) or `"jpg"`.
- `options.resolution`: `"1K" | "2K" | "4K"` (passed through to Replicate).
- `options.safetyFilterLevel`: `"block_low_and_above" | "block_medium_and_above" | "block_only_high"`.
- `options.aspectRatio`: `"match_input_image" | "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"`.
- `options.gridSize`: output grid size in pixels (default `2048`).
- `options.margin`: margin between tiles in pixels (default `5`).
- `options.systemPrompt`: override the base system prompt template.

Returns a `Promise<NanoBananaBatchResult[]>` where each entry contains:

- `index`: tile index in row-major order.
- `prompt`: original prompt for that tile.
- `inputImageUrl`: original input URL.
- `outputImage`: output tile image `Buffer`.
- `outputFormat`: `"png"` or `"jpg"`.

### Upload helper (fetch + multipart)

```ts
import type { UploadFunction } from "nano-banana-batch";

const upload: UploadFunction = async (buffer) => {
  const formData = new FormData();
  formData.append(
    "image",
    new Blob([buffer], { type: "image/png" }),
    "grid.png"
  );

  const response = await fetch(process.env.UPLOAD_ENDPOINT!, {
    method: "POST",
    headers: { "X-API-Key": process.env.UPLOAD_API_KEY! },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Upload failed: ${response.status} ${response.statusText} ${details}`);
  }

  const data = (await response.json()) as { id?: string; url?: string };
  if (!data.id || !data.url) {
    throw new Error("Upload response missing id or url.");
  }
  return data.url;
};
```

## Example run (real)

This repository ships a verbose example test that shows exactly what gets uploaded and sent to Replicate, then saves the grid and tiles to disk.

```bash
RUN_EXAMPLE=true \
EXAMPLE_OUTPUT_FORMAT="jpg" \
UPLOAD_ENDPOINT="https://image-hosting-production.up.railway.app/upload" \
UPLOAD_API_KEY="<your-upload-api-key>" \
REPLICATE_API_TOKEN="<your-replicate-token>" \
EXAMPLE_OUTPUT_DIR="tests/examples/output" \
npm run test -- --dir tests/examples
```

Sample output (trimmed):

```
[example] Upload endpoint: https://image-hosting-production.up.railway.app/upload
[example] Compiled prompt:
You are given a single square input image that is a grid of multiple images.
The grid has 2 rows and 2 columns with 5px white margins between tiles.
The input grid is 2048x2048. Each tile is 1021x1021 pixels.
Each tile must be edited independently using its corresponding prompt and its own input tile as reference.
Output a single 2048x2048 image with the same grid layout, margins, and tile positions.

Tile prompts (row-major, left-to-right, top-to-bottom):
1. (row 1, col 1, top-left): black shirt
2. (row 1, col 2, top-right): green shirt
3. (row 2, col 1, bottom-left): sun glasses
4. (row 2, col 2, bottom-right): black suit

[example] Uploading grid image: 802001 bytes format=jpg
[example] Wrote tests/examples/output/grid.jpg
[example] Upload url: http://.../images/...
[example] Replicate model: google/nano-banana-pro
[example] Replicate input: { prompt: "...", image_input: [ "http://.../images/..." ], output_format: "jpg" }
[example] Replicate output url: https://replicate.delivery/.../tmprt3ahcx4.jpeg
[example] Wrote tests/examples/output/grid-response.jpg
[example] Tile 1: 1021x1021 158478 bytes
[example] Wrote tests/examples/output/tile-1.jpg
...
```

Artifacts written when `EXAMPLE_OUTPUT_DIR` is set:

- `tests/examples/output/grid.jpg` - input grid uploaded to the image host
- `tests/examples/output/grid-response.jpg` - full grid output returned by Replicate
- `tests/examples/output/tile-1.jpg` ... `tile-4.jpg` - extracted tiles

## Example outputs

These images are generated by the example run and stored under `docs/assets`.

<p>
  <img src="https://github.com/renanliberato/grid-imagen/blob/master/docs/assets/grid.jpg" width="420" alt="Input grid" />
  <img src="https://github.com/renanliberato/grid-imagen/blob/master/docs/assets/grid-response.jpg" width="420" alt="Replicate output grid" />
</p>
<p>
  <img src="https://github.com/renanliberato/grid-imagen/blob/master/docs/assets/tile-1.jpg" width="200" alt="Tile 1" />
  <img src="https://github.com/renanliberato/grid-imagen/blob/master/docs/assets/tile-2.jpg" width="200" alt="Tile 2" />
  <img src="https://github.com/renanliberato/grid-imagen/blob/master/docs/assets/tile-3.jpg" width="200" alt="Tile 3" />
  <img src="https://github.com/renanliberato/grid-imagen/blob/master/docs/assets/tile-4.jpg" width="200" alt="Tile 4" />
</p>

## Preparing example inputs

The demo inputs must be 1024x1024. If you want to regenerate them from arbitrary URLs and upload to your host:

```bash
UPLOAD_ENDPOINT="https://image-hosting-production.up.railway.app/upload" \
UPLOAD_API_KEY="<your-upload-api-key>" \
node scripts/prepare-example-inputs.mjs
```

## Error handling & limits

- Batches must contain exactly 4 or 9 items; other sizes throw.
- Inputs must be JPEG/PNG; non-image URLs or unsupported formats throw.
- Output format is limited to `"png"` or `"jpg"`.
- Replicate failures surface as errors (missing token, prediction failure, timeout).
- Upload handler errors are surfaced as-is (HTTP error/invalid JSON).

## Notes

- Input list must be exactly 4 or 9 items; each URL must point to a JPEG or PNG (inputs are resized to 1024x1024 with transparent padding if needed).
- Grid is 2048x2048 with 5px margins; tiles are resized to fit.
- Upload function must return a public URL for the generated grid image.
- The upload API used by your function must accept `multipart/form-data` with `image` and return `{ id, url }` if you follow the example helper in `tests/examples/upload-with-fetch.ts`.
- System prompt template lives at `src/prompts/nano-banana-system.txt` and supports `{{cells}}`, `{{margin}}`, `{{gridSize}}`, `{{cellSize}}`.
- For custom transports or tests, pass an `upload` function and/or `replicate.client`.
