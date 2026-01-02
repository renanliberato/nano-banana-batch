import type { ReplicateOptions } from "./replicate.js";
import type { UploadHandler } from "./upload.js";

export type OutputFormat = "png" | "jpg";
export type Resolution = "1K" | "2K" | "4K";
export type SafetyFilterLevel =
  | "block_low_and_above"
  | "block_medium_and_above"
  | "block_only_high";
export type AspectRatio =
  | "match_input_image"
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";

export interface NanoBananaBatchItem {
  prompt: string;
  imageUrl: string;
}

export interface NanoBananaBatchOptions {
  replicate?: ReplicateOptions;
  upload: UploadHandler;
  outputFormat?: OutputFormat;
  resolution?: Resolution;
  safetyFilterLevel?: SafetyFilterLevel;
  aspectRatio?: AspectRatio;
  gridSize?: number;
  margin?: number;
  systemPrompt?: string;
}

export interface NanoBananaBatchResult {
  index: number;
  prompt: string;
  inputImageUrl: string;
  outputImage: Buffer;
  outputFormat: OutputFormat;
}
