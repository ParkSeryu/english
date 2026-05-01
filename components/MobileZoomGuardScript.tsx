export const mobileZoomGuardScript = `
(() => {
  if (window.__mobileZoomGuardInstalled) return;
  window.__mobileZoomGuardInstalled = true;

  const preventPinch = (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  };
  const preventGesture = (event) => event.preventDefault();

  document.addEventListener("touchmove", preventPinch, { passive: false });
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("gestureend", preventGesture, { passive: false });
})();
`.trim();

export function MobileZoomGuardScript() {
  return <script dangerouslySetInnerHTML={{ __html: mobileZoomGuardScript }} />;
}
