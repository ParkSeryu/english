import type { AnchorHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockPathname = "/expressions";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname
}));

vi.mock("next/link", () => ({
  default: ({ href, children, onClick, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  )
}));

import { BottomNav } from "@/components/BottomNav";

describe("BottomNav", () => {
  it("shows immediate pending feedback when tapping another navigation item", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "표현" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("link", { name: "암기" }));

    expect(screen.getByRole("link", { name: "이동 중…" })).toHaveAttribute("href", "/memorize");
  });
});
