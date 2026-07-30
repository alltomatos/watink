import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import TransferTicketModal from "../index";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock("../../../services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
  },
}));

vi.mock("../../../errors/toastError", () => ({
  default: vi.fn(),
}));

const mockQueuesData = [
  { id: 1, name: "Suporte", color: "#ff0000" },
  { id: 2, name: "Vendas", color: "#00ff00" },
];

vi.mock("../../../hooks/useQueues", () => ({
  default: () => ({ data: mockQueuesData }),
}));

vi.mock("../../../hooks/useWhatsApps", () => ({
  default: () => ({
    loading: false,
    whatsApps: [
      { id: 10, name: "WhatsApp Principal", status: "CONNECTED" },
      { id: 11, name: "WhatsApp Secundário", status: "CONNECTED" },
    ],
    reloadWhatsApps: vi.fn(),
  }),
}));

vi.mock("../../../context/Auth/AuthContext", () => ({
  AuthContext: React.createContext({
    user: { id: 1, name: "Admin", profile: "admin", permissions: [] },
  }),
}));

vi.mock("../../../translate/i18n", () => ({
  i18n: {
    t: (key: string) => {
      const map: Record<string, string> = {
        "transferTicketModal.title": "Transferir Ticket",
        "transferTicketModal.fieldLabel": "Atendente",
        "transferTicketModal.fieldQueueLabel": "Fila",
        "transferTicketModal.fieldQueuePlaceholder": "Selecione uma fila",
        "transferTicketModal.fieldConnectionLabel": "Conexão",
        "transferTicketModal.fieldConnectionPlaceholder": "Selecione uma conexão",
        "transferTicketModal.buttons.cancel": "Cancelar",
        "transferTicketModal.buttons.ok": "Transferir",
      };
      return map[key] ?? key;
    },
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultProps = {
  modalOpen: true,
  onClose: vi.fn(),
  ticketid: 42,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(props = {}) {
  return render(<TransferTicketModal {...defaultProps} {...props} />);
}

/**
 * Helper: triggers the debounced search using fake timers, then restores real
 * timers so that subsequent `waitFor` calls work correctly.
 */
async function triggerDebouncedSearch(input: HTMLElement, value: string) {
  vi.useFakeTimers();
  fireEvent.change(input, { target: { value } });
  await act(() => vi.advanceTimersByTimeAsync(600));
  vi.useRealTimers();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TransferTicketModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockApiPut.mockResolvedValue({});
  });

  // ── Renderização ──────────────────────────────────────────────────────────

  it("renderiza o título do modal quando modalOpen=true", () => {
    renderModal();
    expect(screen.getByText("Transferir Ticket")).toBeInTheDocument();
  });

  it("não renderiza o modal quando modalOpen=false", () => {
    renderModal({ modalOpen: false });
    expect(screen.queryByText("Transferir Ticket")).not.toBeInTheDocument();
  });

  it("renderiza o campo de busca de usuário", () => {
    renderModal();
    expect(screen.getByPlaceholderText("Buscar usuário...")).toBeInTheDocument();
  });

  it("renderiza o seletor de fila com opções carregadas", () => {
    renderModal();
    expect(screen.getByText("Fila")).toBeInTheDocument();
  });

  it("exibe botões Cancelar e Transferir", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transferir" })).toBeInTheDocument();
  });

  it("botão Transferir começa desabilitado quando nenhum campo preenchido", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: "Transferir" });
    expect(btn).toBeDisabled();
  });

  // ── Campo de busca ─────────────────────────────────────────────────────────

  it("não dispara busca quando searchParam tem menos de 3 chars", async () => {
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: "ab" } });
    await act(() => vi.advanceTimersByTimeAsync(600));
    vi.useRealTimers();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("dispara busca após 500ms quando searchParam tem 3+ chars", async () => {
    mockApiGet.mockResolvedValue({ data: { users: [] } });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "tes");
    expect(mockApiGet).toHaveBeenCalledWith("/users/", { params: { searchParam: "tes" } });
  });

  it("exibe lista de usuários retornados pela API", async () => {
    mockApiGet.mockResolvedValue({
      data: {
        users: [
          { id: 2, name: "Maria Souza", queues: [] },
          { id: 3, name: "João Costa", queues: [] },
        ],
      },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "mar");
    await waitFor(() => {
      expect(screen.getByText("Maria Souza")).toBeInTheDocument();
      expect(screen.getByText("João Costa")).toBeInTheDocument();
    });
  });

  it("selecionar usuário da lista preenche o campo e oculta a lista", async () => {
    mockApiGet.mockResolvedValue({
      data: {
        users: [{ id: 2, name: "Maria Souza", queues: [] }],
      },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "mar");
    await waitFor(() => screen.getByText("Maria Souza"));
    fireEvent.click(screen.getByText("Maria Souza"));
    expect((input as HTMLInputElement).value).toBe("Maria Souza");
    expect(screen.queryByText("Maria Souza")).not.toBeInTheDocument();
  });

  it("ao selecionar usuário com filas próprias, atualiza seletor de fila", async () => {
    mockApiGet.mockResolvedValue({
      data: {
        users: [
          {
            id: 2,
            name: "Atendente X",
            queues: [{ id: 99, name: "Fila Específica" }],
          },
        ],
      },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "ate");
    await waitFor(() => screen.getByText("Atendente X"));
    fireEvent.click(screen.getByText("Atendente X"));
    // A fila específica do usuário deve estar disponível
    await waitFor(() => {
      expect(screen.getByText("Fila Específica")).toBeInTheDocument();
    });
  });

  it("alterar o campo após selecionar usuário limpa a seleção", async () => {
    mockApiGet.mockResolvedValue({
      data: { users: [{ id: 2, name: "Maria Souza", queues: [] }] },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "mar");
    await waitFor(() => screen.getByText("Maria Souza"));
    fireEvent.click(screen.getByText("Maria Souza"));
    // Alterar o campo novamente deve limpar selectedUser
    fireEvent.change(input, { target: { value: "outro" } });
    // Botão deve voltar a desabilitado (selectedUser limpo, sem fila/conexão)
    expect(screen.getByRole("button", { name: "Transferir" })).toBeDisabled();
  });

  // ── Submissão do formulário ────────────────────────────────────────────────

  it("chama api.put com userId ao submeter com usuário selecionado", async () => {
    mockApiGet.mockResolvedValue({
      data: { users: [{ id: 5, name: "Carlos Lima", queues: [] }] },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "car");
    await waitFor(() => screen.getByText("Carlos Lima"));
    fireEvent.click(screen.getByText("Carlos Lima"));
    const submitBtn = screen.getByRole("button", { name: "Transferir" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith("/tickets/42", expect.objectContaining({ userId: 5 }));
    });
  });

  it("navega para /tickets após submissão bem-sucedida", async () => {
    mockApiGet.mockResolvedValue({
      data: { users: [{ id: 5, name: "Carlos Lima", queues: [] }] },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "car");
    await waitFor(() => screen.getByText("Carlos Lima"));
    fireEvent.click(screen.getByText("Carlos Lima"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/tickets");
    });
  });

  it("chama toastError quando api.put rejeita", async () => {
    const { default: toastError } = await import("../../../errors/toastError");
    const apiError = new Error("Erro de servidor");
    mockApiPut.mockRejectedValue(apiError);
    mockApiGet.mockResolvedValue({
      data: { users: [{ id: 5, name: "Carlos Lima", queues: [] }] },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "car");
    await waitFor(() => screen.getByText("Carlos Lima"));
    fireEvent.click(screen.getByText("Carlos Lima"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    });
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(apiError);
    });
  });

  // ── Botão Cancelar ────────────────────────────────────────────────────────

  it("chama onClose ao clicar em Cancelar", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
  });

  // ── ticketWhatsappId ──────────────────────────────────────────────────────

  it("pré-seleciona conexão quando ticketWhatsappId é passado", () => {
    renderModal({ ticketWhatsappId: 10 });
    // O valor pré-selecionado "10" deve estar refletido; botão Transferir
    // deve estar habilitado pois há uma conexão selecionada
    const btn = screen.getByRole("button", { name: "Transferir" });
    expect(btn).not.toBeDisabled();
  });

  // ── Estado de loading ─────────────────────────────────────────────────────

  it("desabilita botões durante submissão", async () => {
    // Delay infinito para manter estado de loading
    mockApiPut.mockReturnValue(new Promise(() => {}));
    mockApiGet.mockResolvedValue({
      data: { users: [{ id: 5, name: "Carlos Lima", queues: [] }] },
    });
    renderModal();
    const input = screen.getByPlaceholderText("Buscar usuário...");
    await triggerDebouncedSearch(input, "car");
    await waitFor(() => screen.getByText("Carlos Lima"));
    fireEvent.click(screen.getByText("Carlos Lima"));
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    });
  });
});
