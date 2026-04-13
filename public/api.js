// iframe/api.ts
var currId = 0;
var _parentOrigin = window.location.origin;

class Registry {
  async get(key) {
    const id = currId++;
    window.parent.postMessage({ operation: "get", key, id }, _parentOrigin);
    return new Promise((resolve, reject) => {
      window.addEventListener("message", (event) => {
        if (event.origin !== _parentOrigin) return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
  async set(key, value) {
    const id = currId++;
    window.parent.postMessage({ operation: "set", key, value, id }, _parentOrigin);
  }
  async delete(key) {
    const id = currId++;
    window.parent.postMessage({ operation: "delete", key, id }, _parentOrigin);
  }
  async listKeys() {
    const id = currId++;
    window.parent.postMessage({ operation: "listKeys", id }, _parentOrigin);
    return new Promise((resolve, reject) => {
      window.addEventListener("message", (event) => {
        if (event.origin !== _parentOrigin) return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
}
window.chat = (messages, returnJson) => {
  const id = currId++;
  window.parent.postMessage(
    { operation: "chat", value: messages, id, returnJson },
    _parentOrigin
  );
  return new Promise((resolve, reject) => {
    window.addEventListener("message", (event) => {
      if (event.origin !== _parentOrigin) return;
      if (event.data.id === id) {
        resolve(event.data.value);
      }
    });
  });
};
var onSaveCallback = null;
window.registerOnSave = (callback) => {
  onSaveCallback = callback;
  window.parent.postMessage({ operation: "registerOnSave" }, _parentOrigin);
};
var onOpenCallback = null;
window.registerOnOpen = (callback) => {
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
window.registry = new Registry();
