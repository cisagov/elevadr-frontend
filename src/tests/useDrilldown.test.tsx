import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useDrilldown } from "../app/hooks/useDrilldown";

interface TestData {
  value: string;
}

interface HarnessProps {
  fetcher: (key: string) => Promise<TestData>;
}

function Harness({ fetcher }: HarnessProps): JSX.Element {
  const drilldown = useDrilldown<TestData, string>(fetcher);

  return (
    <div>
      <button type="button" onClick={() => void drilldown.open("alpha")}>
        Open
      </button>
      <button type="button" onClick={drilldown.close}>
        Close
      </button>
      <span data-testid="selected-key">{drilldown.selectedKey ?? "none"}</span>
      <span data-testid="loading">{String(drilldown.isLoading)}</span>
      <span data-testid="error">{drilldown.error ?? "none"}</span>
      <span data-testid="value">{drilldown.data?.value ?? "none"}</span>
    </div>
  );
}

describe("useDrilldown", () => {
  it("loads drilldown data for the selected key", async () => {
    const fetcher = jest.fn(async (key: string) => ({ value: `payload:${key}` }));

    render(<Harness fetcher={fetcher} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByTestId("selected-key")).toHaveTextContent("alpha");

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("value")).toHaveTextContent("payload:alpha");
  });

  it("stores a normalized error when the fetcher fails", async () => {
    const fetcher = jest.fn(async () => {
      throw new Error("failed to fetch");
    });

    render(<Harness fetcher={fetcher} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("failed to fetch");
    });
    expect(screen.getByTestId("value")).toHaveTextContent("none");
  });

  it("clears drilldown state on close", async () => {
    const fetcher = jest.fn(async (key: string) => ({ value: key }));

    render(<Harness fetcher={fetcher} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByTestId("selected-key")).toHaveTextContent("none");
    expect(screen.getByTestId("value")).toHaveTextContent("none");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });
});
