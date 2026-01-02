import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcFile = resolve(rootDir, "src", "prompts", "nano-banana-system.txt");
const destDir = resolve(rootDir, "dist", "prompts");

await mkdir(destDir, { recursive: true });
await copyFile(srcFile, resolve(destDir, "nano-banana-system.txt"));
