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
  it("keeps stable tab labels and marks the current route", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "표현" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "암기" })).toHaveAttribute("href", "/memorize");

    fireEvent.click(screen.getByRole("link", { name: "암기" }));

    expect(screen.getByRole("link", { name: "암기" })).toHaveAttribute("href", "/memorize");
    expect(screen.queryByRole("link", { name: "이동 중…" })).not.toBeInTheDocument();
  });
});
