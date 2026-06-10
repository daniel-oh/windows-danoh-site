// Byte-exact sibling of readFileAsText, for paths that must not care
// what's inside the file (move/rename). A text decode/encode round
// trip mangles any non-UTF-8 payload, e.g. images saved by generated
// programs.
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as ArrayBuffer);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
