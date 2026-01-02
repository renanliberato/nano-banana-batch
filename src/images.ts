import sharp from "sharp";

export interface ValidatedImage {
  buffer: Buffer;
  format: "jpeg" | "png";
}

export async function downloadAndValidateImage(url: string): Promise<ValidatedImage> {
  const buffer = await downloadImage(url);
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions for ${url}.`);
  }

  if (metadata.format !== "jpeg" && metadata.format !== "png") {
    throw new Error(`Image ${url} must be JPEG or PNG.`);
  }

  let outputBuffer = buffer;
  let outputFormat = metadata.format;

  if (metadata.width !== 1024 || metadata.height !== 1024) {
    outputBuffer = await sharp(buffer)
      .rotate()
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    outputFormat = "png";
  }

  return {
    buffer: outputBuffer,
    format: outputFormat,
  };
}

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
