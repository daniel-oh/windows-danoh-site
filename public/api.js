// iframe/api.ts
var currId = 0;
var PARENT_TARGET = "*";
var fromParent = (event) => event.source === window.parent;
function request(message, timeoutMs) {
  const id = currId++;
  return new Promise((resolve) => {
    let timer;
    const onReply = (event) => {
      if (!fromParent(event))
        return;
      if (event.data?.id !== id)
        return;
      window.removeEventListener("message", onReply);
      if (timer)
        clearTimeout(timer);
      resolve(event.data.value);
    };
    window.addEventListener("message", onReply);
    if (timeoutMs != null) {
      timer = setTimeout(() => {
        window.removeEventListener("message", onReply);
        resolve(undefined);
      }, timeoutMs);
    }
    window.parent.postMessage({ ...message, id }, PARENT_TARGET);
  });
}
var WRITE_ACK_TIMEOUT_MS = 400;

class Registry {
  get(key) {
    return request({ operation: "get", key });
  }
  set(key, value) {
    return request({ operation: "set", key, value }, WRITE_ACK_TIMEOUT_MS);
  }
  delete(key) {
    return request({ operation: "delete", key }, WRITE_ACK_TIMEOUT_MS);
  }
  listKeys() {
    return request({ operation: "listKeys" });
  }
}
window.chat = (messages, returnJson) => request({ operation: "chat", value: messages, returnJson });
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
