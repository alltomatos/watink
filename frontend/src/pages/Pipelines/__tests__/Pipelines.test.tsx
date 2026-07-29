import React from "react";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Pipelines from "../index";

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
