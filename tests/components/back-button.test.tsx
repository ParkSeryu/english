import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/expressions/expression-1";
const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ back: mockBack, push: mockPush })
}));

import { BackButton } from "@/components/BackButton";

describe("BackButton", () => {
  beforeEach(() => {
    mockPathname = "/expressions/expression-1";
    mockBack.mockClear();
    mockPush.mockClear();
    window.history.pushState(null, "", "/previous-test-entry");
  });

  it("renders on logged-in non-home pages and uses browser history when available", () => {
    render(<BackButton enabled />);

    fireEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("falls back to the expressions list when a detail page has no usable history", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<BackButton enabled />);

    fireEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/expressions");
  });

  it("stays hidden on the home page and login page", () => {
    mockPathname = "/";
    const { rerender } = render(<BackButton enabled />);
    expect(screen.queryByRole("button", { name: "뒤로 가기" })).not.toBeInTheDocument();

    mockPathname = "/login";
    rerender(<BackButton enabled />);
    expect(screen.queryByRole("button", { name: "뒤로 가기" })).not.toBeInTheDocument();
  });
});
