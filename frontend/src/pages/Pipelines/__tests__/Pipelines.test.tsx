import React from "react";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
const mockApiPost = vi.fn();

vi.mock("../../../services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
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

const openPipelineMenu = async () => {
  const menuButton = document.querySelector(
    "button:has(svg.lucide-ellipsis-vertical)"
  ) as HTMLButtonElement;
  expect(menuButton).toBeTruthy();
  // Radix DropdownMenuTrigger listens for a real pointerdown+click sequence
  // (not just synthetic click) -- and userEvent's native .focus() emulation
  // causes an infinite focus/blur loop between Radix FocusScope instances in
  // jsdom when this menu closes into a Dialog opening (ConfirmationModal),
  // so we dispatch the minimal event sequence directly instead of userEvent.
  fireEvent.pointerDown(menuButton, { pointerId: 1, button: 0 });
  fireEvent.click(menuButton);
  await waitFor(() => expect(screen.getByText("Excluir")).toBeInTheDocument());
};

describe("Pipelines page — ações do card (excluir/duplicar/exportar)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApiGet.mockReset();
    mockApiDelete.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue({ data: [pipeline] });
    mockApiDelete.mockResolvedValue({ data: { message: "ok" } });
    mockApiPost.mockResolvedValue({ data: { ...pipeline, id: 2 } });
  });

  it("asks for confirmation before deleting, and calls DELETE /pipelines/:id on confirm", async () => {
    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Funil de Vendas")).toBeInTheDocument());

    await openPipelineMenu();
    fireEvent.click(screen.getByText("Excluir"));

    await waitFor(() => expect(screen.getByText("Excluir pipeline")).toBeInTheDocument());
    expect(mockApiDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Ok"));

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith("/pipelines/1"));
  });

  it("duplicates the pipeline via POST /pipelines with a '(cópia)' suffix", async () => {
    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Funil de Vendas")).toBeInTheDocument());

    await openPipelineMenu();
    fireEvent.click(screen.getByText("Duplicar"));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        "/pipelines",
        expect.objectContaining({ name: "Funil de Vendas (cópia)" })
      )
    );
  });

  it("exports the pipeline via GET /pipelines/export/:id", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith("/pipelines/export/")) {
        return Promise.resolve({ data: pipeline });
      }
      return Promise.resolve({ data: [pipeline] });
    });

    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Funil de Vendas")).toBeInTheDocument());

    await openPipelineMenu();
    fireEvent.click(screen.getByText("Exportar JSON"));

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/pipelines/export/1"));
  });
});

describe("Pipelines page — métricas rápidas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApiGet.mockReset();
  });

  it("shows deal count and total value when dealsCount > 0", async () => {
    mockApiGet.mockResolvedValue({
      data: [{ ...pipeline, dealsCount: 3, dealsValue: 1250.5 }],
    });

    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("3 negócios")).toBeInTheDocument());
    expect(screen.getByText("R$ 1.250,50")).toBeInTheDocument();
  });

  it("hides the metrics row when there are no deals", async () => {
    mockApiGet.mockResolvedValue({ data: [pipeline] });

    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Funil de Vendas")).toBeInTheDocument());
    expect(screen.queryByText(/negócio/)).not.toBeInTheDocument();
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

  it("filters the list by search term", async () => {
    render(
      <MemoryRouter>
        <Pipelines />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Alfa")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Buscar pipeline..."), {
      target: { value: "zeb" },
    });

    await waitFor(() => expect(cardTitles()).toEqual(["Zebra"]));
  });
});
