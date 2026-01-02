import type { ReplicateModelId } from "./replicate.js";

export const MODEL_ID: ReplicateModelId = "google/nano-banana-pro";
export const DEFAULT_GRID_SIZE = 2048;
export const DEFAULT_MARGIN = 5;
export const SYSTEM_PROMPT_TEMPLATE_URL = new URL(
  "./prompts/nano-banana-system.txt",
  import.meta.url
);
