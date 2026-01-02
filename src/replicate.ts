import Replicate from "replicate";
import { downloadImage } from "./images.js";

export type ReplicateModelId =
  | `${string}/${string}`
  | `${string}/${string}:${string}`;

export interface ReplicateClient {
  run(
    modelId: ReplicateModelId,
    options: { input: Record<string, unknown> }
  ): Promise<unknown>;
}

export interface ReplicateOptions {
  token?: string;
  client?: ReplicateClient;
}

export class ReplicateSdkClient implements ReplicateClient {
  private client: Replicate;
  private token?: string;

  constructor(token?: string) {
    this.token = token;
    this.client = token ? new Replicate({ auth: token }) : new Replicate();
  }

  run(
    modelId: ReplicateModelId,
    options: { input: Record<string, unknown> }
  ): Promise<unknown> {
    const input = { ...options.input };
    const imageInput = input.image_input;
    if (typeof imageInput === "string") {
      input.image_input = [imageInput];
    }
    if (Array.isArray(input.image_input)) {
      return runPredictionWithFetch(modelId, input, this.token);
    }
    return this.client.run(modelId, { input });
  }
}

export function resolveReplicateClient(options?: ReplicateOptions): ReplicateClient {
  if (options?.client) {
    return options.client;
  }
  return new ReplicateSdkClient(options?.token);
}

export async function resolveOutputBuffer(output: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(output)) {
    return output;
  }

  if (typeof output === "string") {
    return downloadImage(output);
  }

  if (output && typeof (output as { url?: () => string }).url === "function") {
    const url = (output as { url: () => string }).url();
    return downloadImage(url);
  }

  if (output && typeof (output as { url?: string }).url === "string") {
    return downloadImage((output as { url: string }).url);
  }

  if (output && typeof (output as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    const arrayBuffer = await (output as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error("Unsupported output type from Replicate.");
}

interface PredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
}

const REPLICATE_BASE_URL = "https://api.replicate.com/v1";
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_POLL_TIMEOUT_MS = 10 * 60 * 1000;

function parseModelId(modelId: ReplicateModelId): {
  owner: string;
  name: string;
  version?: string;
} {
  const [ownerName, version] = modelId.split(":");
  const [owner, name] = ownerName.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid model id: ${modelId}`);
  }
  return { owner, name, version };
}

async function replicateRequest(
  path: string,
  token: string | undefined,
  options: { method: string; body?: unknown }
): Promise<Response> {
  const auth = token ?? process.env.REPLICATE_API_TOKEN;
  if (!auth) {
    throw new Error("Missing Replicate API token.");
  }
  const response = await fetch(`${REPLICATE_BASE_URL}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Replicate API error: ${response.status} ${response.statusText} ${errorText}`
    );
  }
  return response;
}

async function createPrediction(
  modelId: ReplicateModelId,
  input: Record<string, unknown>,
  token?: string
): Promise<PredictionResponse> {
  const { owner, name, version } = parseModelId(modelId);
  if (version) {
    const response = await replicateRequest(
      "/predictions",
      token,
      {
        method: "POST",
        body: { version, input },
      }
    );
    return (await response.json()) as PredictionResponse;
  }

  const response = await replicateRequest(
    `/models/${owner}/${name}/predictions`,
    token,
    {
      method: "POST",
      body: { input },
    }
  );
  return (await response.json()) as PredictionResponse;
}

async function waitForPrediction(
  id: string,
  token?: string
): Promise<PredictionResponse> {
  const startedAt = Date.now();
  while (true) {
    const response = await replicateRequest(
      `/predictions/${id}`,
      token,
      { method: "GET" }
    );
    const prediction = (await response.json()) as PredictionResponse;
    if (prediction.status === "succeeded") {
      return prediction;
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Prediction failed: ${prediction.error ?? "unknown error"}`);
    }
    if (Date.now() - startedAt > DEFAULT_POLL_TIMEOUT_MS) {
      throw new Error("Prediction polling timed out.");
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
  }
}

async function runPredictionWithFetch(
  modelId: ReplicateModelId,
  input: Record<string, unknown>,
  token?: string
): Promise<unknown> {
  const created = await createPrediction(modelId, input, token);
  const completed = await waitForPrediction(created.id, token);
  return completed.output;
}
