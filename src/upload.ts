export type UploadFunction = (buffer: Buffer) => Promise<string>;

export interface UploadClient {
  upload(buffer: Buffer): Promise<string>;
}

export type UploadHandler = UploadFunction | UploadClient;

export function resolveUploadFunction(upload?: UploadHandler): UploadFunction {
  if (typeof upload === "function") {
    return upload;
  }
  if (upload && typeof upload.upload === "function") {
    return (buffer: Buffer) => upload.upload(buffer);
  }
  throw new Error("Upload must be a function or client with upload(buffer).");
}
