import React from "react";
import { expect, describe, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContactsTable from "../ContactsTable";
import { Contact } from "../../contactsTypes";
import { TooltipProvider } from "../../../../components/ui/tooltip";

vi.mock("../../../../translate/i18n", () => ({
  i18n: { t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key) },
}));

vi.mock("../../../../helpers/urlUtils", () => ({
  getBackendUrl: (path?: string) => path ?? "",
}));

const contacts: Contact[] = [
  { id: 1, name: "Ana", number: "111", email: "ana@test.com" },
  { id: 2, name: "Bob", number: "222", email: "bob@test.com" },
];

const noop = () => {};

function renderTable(props: Partial<React.ComponentProps<typeof ContactsTable>> = {}) {
  return render(
    <TooltipProvider>
      <ContactsTable
        contacts={contacts}
        loading={false}
        onStartChat={noop}
        onEdit={noop}
        onMakeClient={noop}
        onDelete={noop}
        selectedIds={new Set()}
        isAllSelected={false}
        onToggleSelected={noop}
        onToggleSelectAll={noop}
        {...props}
      />
    </TooltipProvider>
  );
}

describe("ContactsTable — bulk selection", () => {
  it("calls onToggleSelected when a row checkbox is clicked", () => {
    const onToggleSelected = vi.fn();
    renderTable({ onToggleSelected });

    const rowCheckbox = screen.getByRole("checkbox", { name: "Ana" });
    fireEvent.click(rowCheckbox);
    expect(onToggleSelected).toHaveBeenCalledWith(1);
  });

  it("reflects selectedIds as checked state per row", () => {
    renderTable({ selectedIds: new Set([2]) });

    expect(screen.getByRole("checkbox", { name: "Ana" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Bob" })).toBeChecked();
  });

  it("calls onToggleSelectAll when the header checkbox is clicked", () => {
    const onToggleSelectAll = vi.fn();
    renderTable({ onToggleSelectAll });

    const headerCheckbox = screen.getByRole("checkbox", { name: "contacts.selection.selectedCount:0" });
    fireEvent.click(headerCheckbox);
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
  });
});
