import { log } from "@/lib/log";
import Replicate from "replicate";
import sharp from "sharp";

export async function generateIcon(prompt: string): Promise<Blob | null> {
  const replicate = new Replicate();

  const response = await replicate.run(
    "fofr/sticker-maker:4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a",
    {
      input: {
        prompt,
      },
    }
  );

  log(response);

  const url = Array.isArray(response) ? response[0] : null;

  if (!url || typeof url !== "string" || !url.startsWith("https://")) return null;

  const arrayBuffer = await fetch(url).then((res) => res.arrayBuffer());

  // Make it crunchy
  const processedImageBuffer = await sharp(arrayBuffer)
    .resize(48, 48)
    .webp({ quality: 80 })
    .toBuffer();

  const blob = new Blob([new Uint8Array(processedImageBuffer)], { type: "image/webp" });

  return blob;
}
