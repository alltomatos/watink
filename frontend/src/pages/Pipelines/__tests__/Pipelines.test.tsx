import React from "react";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Pipelines from "../index";

// jsdom não implementa essas APIs do Radix Select (usadas no popover de opções).
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const mockApiGet = vi.fn();
const mockApiDelete = vi.fn();

vi.mock("../../../services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const pipeline = {
  id: 1,
  name: "Funil de Vendas",
  description: "",
  type: "kanban",
  stages: [{ id: 10, name: "Novo" }],
};

describe("Pipelines page — delete", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApiGet.mockReset();
    mockApiDelete.mockReset();
    mockApiGet.mockResolvedValue({ data: [pipeline] });
    mockApiDelete.mockResolvedValue({ data: { message: "ok" } });
  });

  it("asks for confirmation before deleting, and calls DELETE /pipelines/:id on confirm", async () => {
    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Funil de Vendas")).toBeInTheDocument());

    const deleteButton = document.querySelector(
      "button:has(svg.lucide-trash2)"
    ) as HTMLButtonElement;
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton);

    expect(screen.getByText("Excluir pipeline")).toBeInTheDocument();
    expect(mockApiDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Ok"));

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith("/pipelines/1"));
  });
});

describe("Pipelines page — ordenação", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      data: [
        { id: 1, name: "Zebra", description: "", type: "kanban", stages: [], createdAt: "2026-06-01T00:00:00Z" },
        { id: 2, name: "Alfa", description: "", type: "kanban", stages: [], createdAt: "2026-01-01T00:00:00Z" },
      ],
    });
  });

  const cardTitles = () =>
    Array.from(document.querySelectorAll("p.font-semibold")).map((el) => el.textContent);

  it("sorts by name (A-Z) by default", async () => {
    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Alfa")).toBeInTheDocument());
    expect(cardTitles()).toEqual(["Alfa", "Zebra"]);
  });

  it("sorts by most recent when the sort option changes", async () => {
    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Alfa")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Mais recentes"));

    await waitFor(() => expect(cardTitles()).toEqual(["Zebra", "Alfa"]));
  });
});
