import sharp from "sharp";

const UPLOAD_ENDPOINT = process.env.UPLOAD_ENDPOINT;
const UPLOAD_API_KEY = process.env.UPLOAD_API_KEY;
const UPLOAD_BEARER_TOKEN = process.env.UPLOAD_BEARER_TOKEN;

if (!UPLOAD_ENDPOINT || !UPLOAD_API_KEY) {
  throw new Error("Missing UPLOAD_ENDPOINT or UPLOAD_API_KEY.");
}

const sources = [
  {
    name: "cell-1",
    url: "https://i.redd.it/nseep4kq76ge1.png",
    prompt: "black shirt",
  },
  {
    name: "cell-2",
    url: "https://i.redd.it/nseep4kq76ge1.png",
    prompt: "green shirt",
  },
  {
    name: "cell-3",
    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgJGhRl-PIGyBHQAW7K3Z8OUF6x_I6_edo0A&s",
    prompt: "sun glasses",
  },
  {
    name: "cell-4",
    url: "https://i.insider.com/656078df4ca513d8242e2811?width=700",
    prompt: "black suit",
  },
];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadJpeg(buffer, name) {
  const headers = {
    "X-API-Key": UPLOAD_API_KEY,
  };
  if (UPLOAD_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${UPLOAD_BEARER_TOKEN}`;
  }

  const formData = new FormData();
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  formData.append(
    "image",
    new Blob([bytes], { type: "image/jpeg" }),
    `${name}.jpg`
  );

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Upload failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const data = await response.json();
  if (!data?.url || !data?.id) {
    throw new Error(`Upload response missing id or url for ${name}.`);
  }
  return data;
}

const results = [];

for (const source of sources) {
  console.log(`[prepare-example-inputs] Downloading ${source.url}`);
  const buffer = await download(source.url);
  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();
  console.log(
    `[prepare-example-inputs] Resized ${source.name} to 1024x1024 (${resized.byteLength} bytes)`
  );
  const uploaded = await uploadJpeg(resized, source.name);
  console.log(`[prepare-example-inputs] Uploaded ${source.name}:`, uploaded.url);
  results.push({
    ...source,
    resizedUrl: uploaded.url,
    uploadId: uploaded.id,
  });
}

console.log("\n[prepare-example-inputs] Updated sources:");
console.log(JSON.stringify(results, null, 2));
