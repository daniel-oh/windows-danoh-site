import Anthropic from "@anthropic-ai/sdk";

type MessageStream = ReturnType<Anthropic["messages"]["stream"]>;

const MAX_STREAM_SIZE = 5 * 1024 * 1024; // 5MB

// Shown in the app window when the model produced no HTML at all. Static
// strings only: nothing from the model or the visitor is interpolated.
function emptyResultHtml(stopReason: string): string {
  const message =
    stopReason === "refusal"
      ? "The model declined to build that one. Try describing it differently."
      : stopReason === "max_tokens"
      ? "That one ran out of room before any of it could be drawn. Try a simpler description."
      : "Nothing came back this time. Close this window and try again.";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="danoh-error" content="generation-empty">
<link rel="stylesheet" href="/vendor/98.css">
<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;padding:16px;background:#c0c0c0;font-family:"Pixelated MS Sans Serif",Arial,sans-serif}p{font-size:13px;line-height:1.5;margin:0;max-width:340px}</style>
</head><body><p>${message}</p></body></html>`;
}

export function streamAnthropicHtml(
  stream: MessageStream,
  options?: { injectIntoHead?: string }
): ReadableStream {
  const injectIntoHead = options?.injectIntoHead;

  return new ReadableStream({
    async start(controller) {
      let closed = false;

      function safeClose() {
        if (closed) return;
        closed = true;
        controller.close();
      }

      function safeError(e: unknown) {
        if (closed) return;
        closed = true;
        controller.error(e);
      }

      try {
        let programResult = "";
        let startedSending = false;
        let sentIndex = 0;

        for await (const event of stream) {
          // Abort if client disconnected
          if (controller.desiredSize === null) {
            stream.abort();
            break;
          }

          if (
            event.type !== "content_block_delta" ||
            event.delta.type !== "text_delta"
          ) {
            continue;
          }

          const value = event.delta.text;
          programResult += value;

          if (programResult.length > MAX_STREAM_SIZE) {
            stream.abort();
            safeError(new Error("Stream too large"));
            break;
          }

          if (startedSending) {
            const match = programResult.match(/<\/html>/);
            if (match) {
              controller.enqueue(
                programResult.slice(sentIndex, match.index! + match[0].length)
              );
              break;
            } else {
              controller.enqueue(value);
              sentIndex = programResult.length;
            }
          } else {
            const match = programResult.match(/<head>|<body>/);
            if (match) {
              const afterMatch = programResult.slice(
                match.index! + match[0].length
              );
              let newContent =
                match[0] === "<body>"
                  ? `<head>${injectIntoHead ?? ""}</head><body>` + afterMatch
                  : `<head>${injectIntoHead ?? ""}` + afterMatch;

              const endOfHtml = newContent.match(/<\/html>/);
              newContent = endOfHtml
                ? newContent.slice(0, endOfHtml.index! + endOfHtml[0].length)
                : newContent;

              programResult = `<!DOCTYPE html><html>` + newContent;
              controller.enqueue(programResult);
              sentIndex = programResult.length;
              startedSending = true;
            }
          }
        }

        if (!startedSending) {
          // Not one byte of HTML arrived. That used to render as a blank
          // window. It is likelier now: Sonnet 5 can decline a request
          // (stop_reason "refusal") and its thinking shares max_tokens with
          // the output. Say what happened instead.
          let stopReason = "";
          try {
            stopReason = (await stream.finalMessage()).stop_reason ?? "";
          } catch {
            /* aborted or errored stream: fall through to the generic note */
          }
          controller.enqueue(emptyResultHtml(stopReason));
          safeClose();
          return;
        }
        if (!programResult.includes("</html>")) {
          controller.enqueue("</html>");
        }
        safeClose();
      } catch (e) {
        console.error("Stream error:", e);
        try {
          stream.abort();
        } catch { /* already closed */ }
        safeError(e);
      }
    },
    cancel() {
      // Client disconnected — abort the Anthropic stream to stop billing
      try {
        stream.abort();
      } catch { /* already closed */ }
    },
  }).pipeThrough(new TextEncoderStream());
}
