import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchUpload } from "../examples/upload-with-fetch.js";

const responseBody = { id: "img-1", url: "http://example.com/output.png" };

describe("upload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads with headers and returns parsed url", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const upload = createFetchUpload({
      endpoint: "http://localhost:8080/upload",
      outputFormat: "png",
      apiKey: "api-key",
      bearerToken: "token",
      headers: { "X-Test": "1" },
    });
    const result = await upload({
      buffer: Buffer.from("payload"),
      outputFormat: "png",
    });

    expect(result).toBe(responseBody.url);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(init?.method).toBe("POST");
    expect(headers["X-API-Key"]).toBe("api-key");
    expect(headers["Authorization"]).toBe("Bearer token");
    expect(headers["X-Test"]).toBe("1");
  });

  it("throws when response is missing id or url", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "img-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const upload = createFetchUpload({
      endpoint: "http://localhost:8080/upload",
      outputFormat: "png",
    });
    await expect(
      upload({ buffer: Buffer.from("payload"), outputFormat: "png" })
    ).rejects.toThrow("Upload response missing id or url.");
  });
});
