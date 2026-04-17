let currId = 0;
// Parent origin is injected via a <script> in the head (see app/api/program/route.ts).
// Fall back to window.location.origin so a plain static include still works.
const _parentOrigin: string =
  (window as any).__PARENT_ORIGIN__ || window.location.origin;

class Registry {
  async get(key: string): Promise<any> {
    const id = currId++;
    window.parent.postMessage({ operation: "get", key, id }, _parentOrigin);
    return new Promise((resolve, _reject) => {
      window.addEventListener("message", (event) => {
        if (event.origin !== _parentOrigin) return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
  async set(key: string, value: any): Promise<void> {
    const id = currId++;
    window.parent.postMessage({ operation: "set", key, value, id }, _parentOrigin);
  }

  async delete(key: string): Promise<void> {
    const id = currId++;
    window.parent.postMessage({ operation: "delete", key, id }, _parentOrigin);
  }

  async listKeys(): Promise<string[]> {
    const id = currId++;
    window.parent.postMessage({ operation: "listKeys", id }, _parentOrigin);
    return new Promise((resolve, _reject) => {
      window.addEventListener("message", (event) => {
        if (event.origin !== _parentOrigin) return;
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
    _parentOrigin
  );
  return new Promise((resolve, _reject) => {
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== _parentOrigin) return;
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
  window.parent.postMessage({ operation: "registerOnSave" }, _parentOrigin);
};

let onOpenCallback: ((content: string) => void) | null = null;
(window as any).registerOnOpen = (callback: (content: string) => void) => {
  onOpenCallback = callback;
  window.parent.postMessage({ operation: "registerOnOpen" }, _parentOrigin);
};

window.onmessage = (event) => {
  if (event.origin !== _parentOrigin) return;
  if (event.data.operation === "save") {
    const content = onSaveCallback?.();
    if (content) {
      window.parent.postMessage({ operation: "saveComplete", content }, _parentOrigin);
    }
  }

  if (event.data.operation === "open") {
    const content = event.data.content;
    onOpenCallback?.(content);
  }
};

(window as any).registry = new Registry();
