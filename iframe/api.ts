let currId = 0;
// The parent is identified by WINDOW, not by origin string. The server
// used to inject window.__PARENT_ORIGIN__ from req.url, but inside the
// standalone container that is https://0.0.0.0:3000, so every message
// was addressed to an origin that never matched and the browser dropped
// it (registry.get() hung forever in prod). Programs saved back then
// still carry that bogus value in their HTML, which is why it is
// ignored here rather than corrected at the source only.
//
// "*" is safe as the target: window.parent is fixed by the DOM (this
// code only runs inside the desktop's sandboxed srcDoc iframe, and
// frame-ancestors 'self' stops anyone else from embedding the desktop).
// Replies are checked against event.source, which a sibling frame or
// popup cannot forge the way it could match a bare origin string.
const PARENT_TARGET = "*";
const fromParent = (event: MessageEvent) => event.source === window.parent;

// One request/response round trip with the desktop. The listener removes
// itself when its reply arrives: get() and listKeys() used to add a
// listener per call and never remove it, so an app that polls the
// registry leaked one for every call it ever made.
function request<T>(message: Record<string, unknown>, timeoutMs?: number): Promise<T> {
  const id = currId++;
  return new Promise<T>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onReply = (event: MessageEvent) => {
      if (!fromParent(event)) return;
      if (event.data?.id !== id) return;
      window.removeEventListener("message", onReply);
      if (timer) clearTimeout(timer);
      resolve(event.data.value);
    };
    window.addEventListener("message", onReply);
    if (timeoutMs != null) {
      timer = setTimeout(() => {
        window.removeEventListener("message", onReply);
        resolve(undefined as T);
      }, timeoutMs);
    }
    window.parent.postMessage({ ...message, id }, PARENT_TARGET);
  });
}

// Writes wait for the desktop to confirm the value is stored, so
// `await registry.set(k, v)` followed by `registry.get(k)` reads v. They
// used to resolve immediately, before anything was written.
//
// The timeout is for version skew, not for slowness: this file is cached
// by the CDN for hours and tabs stay open across deploys, so it can end up
// talking to an older desktop that never acknowledges writes. Waiting
// forever would hang every generated app that awaits a set. Past the
// timeout it behaves exactly like the old fire-and-forget.
const WRITE_ACK_TIMEOUT_MS = 400;

class Registry {
  get(key: string): Promise<any> {
    return request({ operation: "get", key });
  }

  set(key: string, value: any): Promise<void> {
    return request<void>({ operation: "set", key, value }, WRITE_ACK_TIMEOUT_MS);
  }

  delete(key: string): Promise<void> {
    return request<void>({ operation: "delete", key }, WRITE_ACK_TIMEOUT_MS);
  }

  listKeys(): Promise<string[]> {
    return request({ operation: "listKeys" });
  }
}

(window as any).chat = (messages: any[], returnJson?: boolean) =>
  request({ operation: "chat", value: messages, returnJson });

let onSaveCallback: (() => string) | null = null;
(window as any).registerOnSave = (callback: () => string) => {
  onSaveCallback = callback;
  window.parent.postMessage({ operation: "registerOnSave" }, PARENT_TARGET);
};

let onOpenCallback: ((content: string) => void) | null = null;
(window as any).registerOnOpen = (callback: (content: string) => void) => {
  onOpenCallback = callback;
  window.parent.postMessage({ operation: "registerOnOpen" }, PARENT_TARGET);
};

window.onmessage = (event) => {
  if (!fromParent(event)) return;
  if (event.data.operation === "save") {
    const content = onSaveCallback?.();
    if (content) {
      window.parent.postMessage({ operation: "saveComplete", content }, PARENT_TARGET);
    }
  }

  if (event.data.operation === "open") {
    const content = event.data.content;
    onOpenCallback?.(content);
  }
};

(window as any).registry = new Registry();
