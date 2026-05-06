import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ExecutiveSummary from "../app/components/ExecutiveSummary/ExecutiveSummary";

describe("ExecutiveSummary", () => {
  it("renders formatted alert titles and stripped tooltip text", () => {
    render(
      <ExecutiveSummary
        data={{
          risky_services_alert:
            "Detected <strong>risky</strong> services on the network.",
        }}
      />,
    );

    expect(screen.getByText("Risky Services Alert")).toBeInTheDocument();

    const infoButtons = screen.getAllByRole("button", { name: "Information" });
    fireEvent.mouseEnter(infoButtons[2]);

    expect(
      screen.getByText((content, element) => {
        const hasText =
          element?.textContent === "Detected risky services on the network.";
        const isDeepest =
          element?.firstElementChild === null ||
          element?.firstElementChild?.textContent !==
            "Detected risky services on the network.";
        return hasText && isDeepest;
      }),
    ).toBeInTheDocument();
  });

  it("scrolls to the mapped panel when an alert link is clicked", () => {
    const target = document.createElement("div");
    target.id = "service-risk-breakdown-panel";
    document.body.appendChild(target);

    render(
      <ExecutiveSummary
        data={{
          risky_services_alert: "Detected risky services.",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Risky Services Alert" }));

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    document.body.removeChild(target);
  });

  it("renders the panel empty state when no alerts are present", () => {
    render(<ExecutiveSummary data={{}} />);

    const toggleButton = screen.getByText("+");
    // Note: if it doesn't have a name, use screen.getByText('+')

    fireEvent.click(toggleButton);

    expect(screen.getByText("No Results")).toBeInTheDocument();
  });
});
