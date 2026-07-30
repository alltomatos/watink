import React from "react";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TicketQuickShortcuts from "../index";

const mockApiGet = vi.fn();
const mockApiPut = vi.fn();

vi.mock("../../../services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
  },
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../pages/Tickets/components/TicketTagsSection", () => ({
  default: ({ ticketId }: { ticketId: number }) => (
    <div data-testid="tags-section">tags for {ticketId}</div>
  ),
}));

const pipeline = {
  id: 1,
  name: "Vendas",
  stages: [
    { id: 10, name: "Novo" },
    { id: 11, name: "Em Andamento" },
  ],
};

describe("TicketQuickShortcuts", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPut.mockReset();
  });

  it("opens the tags shortcut and renders TicketTagsSection scoped to the ticket", async () => {
    render(<TicketQuickShortcuts ticketId={42} />);

    fireEvent.click(screen.getByLabelText("Adicionar tag rapidamente"));

    await waitFor(() => expect(screen.getByTestId("tags-section")).toBeInTheDocument());
    expect(screen.getByText("tags for 42")).toBeInTheDocument();
  });

  it("loads the linked deal's pipeline and moves it to another stage", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/deals") return Promise.resolve({ data: { deals: [{ id: 5, stageId: 10 }] } });
      if (url === "/pipelines") return Promise.resolve({ data: [pipeline] });
      return Promise.resolve({ data: [] });
    });
    mockApiPut.mockResolvedValue({ data: { id: 5, stageId: 11 } });

    render(<TicketQuickShortcuts ticketId={42} />);

    fireEvent.click(screen.getByLabelText("Mover no pipeline"));

    await waitFor(() => expect(screen.getByText("Vendas")).toBeInTheDocument());

    // Radix Select needs these jsdom polyfills to open its options popover.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Em Andamento"));

    await waitFor(() =>
      expect(mockApiPut).toHaveBeenCalledWith("/deals/5", { stageId: 11 })
    );
  });

  it("shows a message when the ticket has no linked deal", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/deals") return Promise.resolve({ data: { deals: [] } });
      return Promise.resolve({ data: [] });
    });

    render(<TicketQuickShortcuts ticketId={42} />);

    fireEvent.click(screen.getByLabelText("Mover no pipeline"));

    await waitFor(() =>
      expect(screen.getByText("Nenhum negócio vinculado a este ticket.")).toBeInTheDocument()
    );
  });
});
