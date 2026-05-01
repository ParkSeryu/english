import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileZoomGuard } from "@/components/MobileZoomGuard";

function touchMoveEvent(touchCount: number) {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: Array.from({ length: touchCount }, () => ({}))
  });
  return event;
}

describe("MobileZoomGuard", () => {
  it("prevents pinch zoom gestures while leaving single-touch scrolling alone", () => {
    const { unmount } = render(<MobileZoomGuard />);

    const singleTouchMove = touchMoveEvent(1);
    document.dispatchEvent(singleTouchMove);
    expect(singleTouchMove.defaultPrevented).toBe(false);

    const pinchMove = touchMoveEvent(2);
    document.dispatchEvent(pinchMove);
    expect(pinchMove.defaultPrevented).toBe(true);

    const webkitGesture = new Event("gesturestart", { bubbles: true, cancelable: true });
    document.dispatchEvent(webkitGesture);
    expect(webkitGesture.defaultPrevented).toBe(true);

    unmount();

    const afterCleanup = touchMoveEvent(2);
    document.dispatchEvent(afterCleanup);
    expect(afterCleanup.defaultPrevented).toBe(false);
  });
});
