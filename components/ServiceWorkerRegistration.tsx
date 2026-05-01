"use client";

import { useEffect } from "react";

const isLocalhost = (hostname: string) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
      if ("caches" in window) {
        void caches.keys().then((cacheNames) => Promise.all(cacheNames.filter((cacheName) => cacheName.startsWith("english-review-")).map((cacheName) => caches.delete(cacheName))));
      }
      return;
    }

    const { hostname, protocol } = window.location;
    const canUseServiceWorker = protocol === "https:" || isLocalhost(hostname);
    if (!canUseServiceWorker) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // PWA support should never block the app shell.
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
