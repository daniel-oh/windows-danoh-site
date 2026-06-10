export async function waitForElement(
  id: string,
  timeout = 5000
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    function checkElement() {
      const element = document.getElementById(id);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        // Timing out is normal (window closed before it rendered) —
        // resolve null per the signature instead of rejecting, so the
        // fire-and-forget .then() call sites don't produce unhandled
        // rejection noise.
        resolve(null);
      } else {
        requestAnimationFrame(checkElement);
      }
    }

    requestAnimationFrame(checkElement);
  });
}
