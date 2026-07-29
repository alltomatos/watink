import React from "react";
import { expect, describe, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContactsBulkActionsBar from "../ContactsBulkActionsBar";

vi.mock("../../../../translate/i18n", () => ({
  i18n: { t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key) },
}));

describe("ContactsBulkActionsBar", () => {
  it("renders nothing when selectedCount is 0", () => {
    const { container } = render(
      <ContactsBulkActionsBar selectedCount={0} onDeleteSelected={vi.fn()} onDeselectAll={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count and wires the delete/deselect buttons when there is a selection", () => {
    const onDeleteSelected = vi.fn();
    const onDeselectAll = vi.fn();
    render(
      <ContactsBulkActionsBar selectedCount={3} onDeleteSelected={onDeleteSelected} onDeselectAll={onDeselectAll} />
    );

    expect(screen.getByText("contacts.selection.selectedCount:3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("contacts.buttons.deleteSelected"));
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("contacts.buttons.deselectAll"));
    expect(onDeselectAll).toHaveBeenCalledTimes(1);
  });
});
