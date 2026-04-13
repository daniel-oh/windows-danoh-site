import Anthropic from "@anthropic-ai/sdk";

type MessageStream = ReturnType<Anthropic["messages"]["stream"]>;

const MAX_STREAM_SIZE = 5 * 1024 * 1024; // 5MB

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
          controller.enqueue("<!DOCTYPE html><html>");
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
