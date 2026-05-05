import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpressionReviewStats } from "@/components/ExpressionReviewStats";

describe("ExpressionReviewStats", () => {
  it("hides review counters when the expression is not in memorization cards", () => {
    const { container } = render(<ExpressionReviewStats expression={{ is_memorization_enabled: false, known_count: 3, unknown_count: 2 }} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/틀림|외움/)).not.toBeInTheDocument();
  });

  it("shows review counters for expressions included in memorization cards", () => {
    render(<ExpressionReviewStats expression={{ is_memorization_enabled: true, known_count: 3, unknown_count: 2 }} />);

    expect(screen.getByText("틀림 2회 · 외움 3회")).toBeInTheDocument();
  });

  it("renders the stacked list version only for memorization card expressions", () => {
    render(<ExpressionReviewStats expression={{ is_memorization_enabled: true, known_count: 1, unknown_count: 4 }} variant="stacked" />);

    expect(screen.getByText("틀림")).toBeInTheDocument();
    expect(screen.getByText("4회")).toBeInTheDocument();
    expect(screen.getByText("외움")).toBeInTheDocument();
    expect(screen.getByText("1회")).toBeInTheDocument();
  });
});
