const FRIENDLY_MESSAGES: Record<string, string> = {
  chat: "The AI chat is temporarily unavailable. Please try again in a moment.",
  help: "The AI service is temporarily unavailable. Please try again in a moment.",
  name: "Couldn't generate a name right now. Using a default.",
  icon: "Couldn't generate an icon right now. Using a default.",
  program: "Couldn't generate the program. Please try again.",
  image: "Couldn't generate the image. Please try again.",
};

export function upstreamErrorResponse(label: string, err: unknown): Response {
  console.error(`[upstream:${label}]`, err);
  const message = FRIENDLY_MESSAGES[label] ?? "Upstream service error.";
  return new Response(JSON.stringify({ error: message }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
