import sharp from "sharp";

export async function createSolidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

export async function getPixel(
  buffer: Buffer,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number }> {
  const { data } = await sharp(buffer)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { r: data[0], g: data[1], b: data[2] };
}

export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}
