import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "icons");

await mkdir(iconsDir, { recursive: true });

const color = { r: 37, g: 99, b: 235 };

for (const size of [16, 48, 128]) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toFile(join(iconsDir, `icon${size}.png`));
}

console.log("Wrote icons to icons/");
