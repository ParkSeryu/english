"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isInternalNavigableLink(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (!isInternalNavigableLink(target)) return;
      setPending(true);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (!pending) return null;

  return (
    <div className="fixed inset-x-0 top-[57px] z-40 h-1 overflow-hidden bg-teal-100" role="progressbar" aria-label="화면 이동 중">
      <div className="h-full w-1/2 animate-[navigation-progress_1s_ease-in-out_infinite] rounded-r-full bg-teal-500 shadow-lg shadow-teal-300" />
    </div>
  );
}
