import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  const originalCaches = Object.getOwnPropertyDescriptor(window, "caches");

  afterEach(() => {
    if (originalServiceWorker) Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    else Reflect.deleteProperty(navigator, "serviceWorker");

    if (originalCaches) Object.defineProperty(window, "caches", originalCaches);
    else Reflect.deleteProperty(window, "caches");
  });

  it("unregisters local service workers and clears app caches outside production", async () => {
    const unregister = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    const register = vi.fn();

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn(async () => [{ unregister }]),
        register
      }
    });
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: vi.fn(async () => ["english-review-v1-static", "other-cache"]),
        delete: deleteCache
      }
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => expect(unregister).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(deleteCache).toHaveBeenCalledWith("english-review-v1-static"));
    expect(deleteCache).not.toHaveBeenCalledWith("other-cache");
    expect(register).not.toHaveBeenCalled();
  });
});
