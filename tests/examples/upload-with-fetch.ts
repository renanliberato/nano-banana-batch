import type { OutputFormat } from "../../src/types.js";
import type { UploadFunction } from "../../src/upload.js";

interface UploadedImage {
  id: string;
  url: string;
}

export interface FetchUploadOptions {
  endpoint: string;
  outputFormat: OutputFormat;
  apiKey?: string;
  bearerToken?: string;
  headers?: Record<string, string>;
  filename?: string;
  mimeType?: string;
}

function resolveMimeType(outputFormat: OutputFormat): string {
  return outputFormat === "png" ? "image/png" : "image/jpeg";
}

function resolveFilename(outputFormat: OutputFormat): string {
  return outputFormat === "png" ? "grid.png" : "grid.jpg";
}

export function createFetchUpload(options: FetchUploadOptions): UploadFunction {
  return async (buffer: Buffer) => {
    const headers: Record<string, string> = { ...options.headers };

    if (options.apiKey) {
      headers["X-API-Key"] = options.apiKey;
    }

    if (options.bearerToken) {
      headers["Authorization"] = `Bearer ${options.bearerToken}`;
    }

    const formData = new FormData();
    const mimeType = options.mimeType ?? resolveMimeType(options.outputFormat);
    const filename = options.filename ?? resolveFilename(options.outputFormat);
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    formData.append("image", new Blob([bytes], { type: mimeType }), filename);

    const response = await fetch(options.endpoint, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      let details = "";
      try {
        details = await response.text();
      } catch {
        details = "";
      }
      const suffix = details ? ` ${details}` : "";
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}${suffix}`
      );
    }

    const data = (await response.json()) as Partial<UploadedImage>;
    if (!data.url || !data.id) {
      throw new Error("Upload response missing id or url.");
    }

    return data.url;
  };
}
