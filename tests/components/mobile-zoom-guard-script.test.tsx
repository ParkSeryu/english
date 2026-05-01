import { describe, expect, it } from "vitest";

import { mobileZoomGuardScript } from "@/components/MobileZoomGuardScript";

declare global {
  interface Window {
    __mobileZoomGuardInstalled?: boolean;
  }
}

function touchMoveEvent(touchCount: number) {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: Array.from({ length: touchCount }, () => ({}))
  });
  return event;
}

describe("mobileZoomGuardScript", () => {
  it("prevents pinch zoom gestures while leaving single-touch scrolling alone", () => {
    window.__mobileZoomGuardInstalled = false;
    new Function(mobileZoomGuardScript)();

    const singleTouchMove = touchMoveEvent(1);
    document.dispatchEvent(singleTouchMove);
    expect(singleTouchMove.defaultPrevented).toBe(false);

    const pinchMove = touchMoveEvent(2);
    document.dispatchEvent(pinchMove);
    expect(pinchMove.defaultPrevented).toBe(true);

    const webkitGesture = new Event("gesturestart", { bubbles: true, cancelable: true });
    document.dispatchEvent(webkitGesture);
    expect(webkitGesture.defaultPrevented).toBe(true);
  });
});
