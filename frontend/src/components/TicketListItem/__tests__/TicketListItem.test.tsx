import React from "react";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TicketListItem from "../index";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ ticketId: undefined }),
}));

vi.mock("../../../helpers/urlUtils", () => ({
  getBackendUrl: (url: string | null) => url,
}));

vi.mock("../../MarkdownWrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseTicket = {
  id: 1,
  status: "open" as const,
  updatedAt: new Date().toISOString(),
  unreadMessages: 0,
  contact: { id: 1, name: "João Silva" },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TicketListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o nome do contato", () => {
    render(<TicketListItem ticket={baseTicket} />);
    expect(screen.getByText("João Silva")).toBeTruthy();
  });

  it("não exibe badge quando o tipo é individual", () => {
    const { container } = render(<TicketListItem ticket={baseTicket} />);
    const badge = container.querySelector(".bg-violet-500, .bg-emerald-500, .bg-sky-500");
    expect(badge).toBeNull();
  });

  it("exibe badge community (violet-500) quando isCommunity=true", () => {
    const { container } = render(
      <TicketListItem ticket={{ ...baseTicket, isCommunity: true }} />
    );
    expect(container.querySelector(".bg-violet-500")).toBeTruthy();
  });

  it("exibe badge community (violet-500) quando isSubGroup=true", () => {
    const { container } = render(
      <TicketListItem ticket={{ ...baseTicket, isSubGroup: true }} />
    );
    expect(container.querySelector(".bg-violet-500")).toBeTruthy();
  });

  it("exibe badge group (emerald-500) quando isGroup=true", () => {
    const { container } = render(
      <TicketListItem ticket={{ ...baseTicket, isGroup: true }} />
    );
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  });

  it("exibe badge newsletter (sky-500) quando isNewsletter=true", () => {
    const { container } = render(
      <TicketListItem ticket={{ ...baseTicket, isNewsletter: true }} />
    );
    expect(container.querySelector(".bg-sky-500")).toBeTruthy();
  });

  it("isCommunity tem precedência sobre isGroup", () => {
    const { container } = render(
      <TicketListItem
        ticket={{ ...baseTicket, isCommunity: true, isGroup: true }}
      />
    );
    expect(container.querySelector(".bg-violet-500")).toBeTruthy();
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
  });

  it("exibe badge de não lidas quando unreadMessages > 0", () => {
    render(
      <TicketListItem ticket={{ ...baseTicket, unreadMessages: 3 }} />
    );
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("não exibe badge de não lidas quando unreadMessages === 0", () => {
    render(
      <TicketListItem ticket={{ ...baseTicket, unreadMessages: 0 }} />
    );
    expect(screen.queryByText("0")).toBeNull();
  });

  it("exibe o nome da conexão como badge", () => {
    render(
      <TicketListItem
        ticket={{ ...baseTicket, whatsapp: { name: "zap-01" } }}
      />
    );
    expect(screen.getByText("zap-01")).toBeTruthy();
  });

  it("exibe as tags do ticket", () => {
    render(
      <TicketListItem
        ticket={{
          ...baseTicket,
          tags: [{ id: 1, name: "Urgente", color: "red" }],
        }}
      />
    );
    expect(screen.getByText("Urgente")).toBeTruthy();
  });
});
