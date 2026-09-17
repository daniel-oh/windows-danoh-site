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

class Registry {
  async get(key: string): Promise<any> {
    const id = currId++;
    window.parent.postMessage({ operation: "get", key, id }, PARENT_TARGET);
    return new Promise((resolve, _reject) => {
      window.addEventListener("message", (event) => {
        if (!fromParent(event)) return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
  async set(key: string, value: any): Promise<void> {
    const id = currId++;
    window.parent.postMessage({ operation: "set", key, value, id }, PARENT_TARGET);
  }

  async delete(key: string): Promise<void> {
    const id = currId++;
    window.parent.postMessage({ operation: "delete", key, id }, PARENT_TARGET);
  }

  async listKeys(): Promise<string[]> {
    const id = currId++;
    window.parent.postMessage({ operation: "listKeys", id }, PARENT_TARGET);
    return new Promise((resolve, _reject) => {
      window.addEventListener("message", (event) => {
        if (!fromParent(event)) return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
}

(window as any).chat = (messages: any[], returnJson?: boolean) => {
  const id = currId++;
  window.parent.postMessage(
    { operation: "chat", value: messages, id, returnJson },
    PARENT_TARGET
  );
  return new Promise((resolve, _reject) => {
    const messageHandler = (event: MessageEvent) => {
      if (!fromParent(event)) return;
      if (event.data.id === id) {
        window.removeEventListener("message", messageHandler);
        resolve(event.data.value);
      }
    };
    window.addEventListener("message", messageHandler);
  });
};

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
