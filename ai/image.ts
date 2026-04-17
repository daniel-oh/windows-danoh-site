import { log } from "@/lib/log";
import { withTimeout } from "@/lib/api/upstreamError";
import Replicate from "replicate";
import sharp from "sharp";

const REPLICATE_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

// Block private / link-local / loopback hosts to prevent SSRF if an
// upstream ever returns a URL pointing at internal infrastructure.
function isDisallowedHost(host: string): boolean {
  if (!host) return true;
  const lower = host.toLowerCase();
  if (lower === "localhost" || lower === "metadata.google.internal") return true;
  const ipv4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const a = parseInt(ipv4[1], 10);
    const b = parseInt(ipv4[2], 10);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return !isDisallowedHost(u.hostname);
  } catch {
    return false;
  }
}

export async function generateIcon(prompt: string): Promise<Blob | null> {
  const replicate = new Replicate();

  const response = await withTimeout(
    replicate.run(
      "fofr/sticker-maker:4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a",
      { input: { prompt } }
    ),
    REPLICATE_TIMEOUT_MS,
    "replicate.run"
  );

  log(response);

  const url = Array.isArray(response) ? response[0] : null;

  if (!url || typeof url !== "string" || !isSafeUrl(url)) return null;

  const arrayBuffer = await withTimeout(
    fetch(url).then((res) => res.arrayBuffer()),
    FETCH_TIMEOUT_MS,
    "icon fetch"
  );

  // Make it crunchy
  const processedImageBuffer = await sharp(arrayBuffer)
    .resize(48, 48)
    .webp({ quality: 80 })
    .toBuffer();

  const blob = new Blob([new Uint8Array(processedImageBuffer)], { type: "image/webp" });

  return blob;
}
