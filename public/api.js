// iframe/api.ts
var currId = 0;
var PARENT_TARGET = "*";
var fromParent = (event) => event.source === window.parent;

class Registry {
  async get(key) {
    const id = currId++;
    window.parent.postMessage({ operation: "get", key, id }, PARENT_TARGET);
    return new Promise((resolve, _reject) => {
      window.addEventListener("message", (event) => {
        if (!fromParent(event))
          return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
  async set(key, value) {
    const id = currId++;
    window.parent.postMessage({ operation: "set", key, value, id }, PARENT_TARGET);
  }
  async delete(key) {
    const id = currId++;
    window.parent.postMessage({ operation: "delete", key, id }, PARENT_TARGET);
  }
  async listKeys() {
    const id = currId++;
    window.parent.postMessage({ operation: "listKeys", id }, PARENT_TARGET);
    return new Promise((resolve, _reject) => {
      window.addEventListener("message", (event) => {
        if (!fromParent(event))
          return;
        if (event.data.id === id) {
          resolve(event.data.value);
        }
      });
    });
  }
}
window.chat = (messages, returnJson) => {
  const id = currId++;
  window.parent.postMessage({ operation: "chat", value: messages, id, returnJson }, PARENT_TARGET);
  return new Promise((resolve, _reject) => {
    const messageHandler = (event) => {
      if (!fromParent(event))
        return;
      if (event.data.id === id) {
        window.removeEventListener("message", messageHandler);
        resolve(event.data.value);
      }
    };
    window.addEventListener("message", messageHandler);
  });
};
var onSaveCallback = null;
window.registerOnSave = (callback) => {
  onSaveCallback = callback;
  window.parent.postMessage({ operation: "registerOnSave" }, PARENT_TARGET);
};
var onOpenCallback = null;
window.registerOnOpen = (callback) => {
  onOpenCallback = callback;
  window.parent.postMessage({ operation: "registerOnOpen" }, PARENT_TARGET);
};
window.onmessage = (event) => {
  if (!fromParent(event))
    return;
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
window.registry = new Registry;
