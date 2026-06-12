// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SingleLabelWorkspace from "@/components/single-label-workspace";

describe("single-label workspace", () => {
  it("renders an obvious form with an immutable warning requirement", () => {
    render(<SingleLabelWorkspace />);
    expect(screen.getByRole("heading", { name: "Check one label" })).toBeVisible();
    expect(screen.getByText("Always required")).toBeVisible();
    expect(screen.getByRole("button", { name: "Verify label" })).toBeEnabled();
  });
});
