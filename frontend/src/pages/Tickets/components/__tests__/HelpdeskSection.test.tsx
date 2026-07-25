import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import HelpdeskSection from "../HelpdeskSection";

const mockPluginApiGet = vi.fn();
vi.mock("../../../../services/pluginApi", () => ({
  default: {
    get: (...args: unknown[]) => mockPluginApiGet(...args),
  },
}));

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock("../../../../services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("HelpdeskSection", () => {
  beforeEach(() => {
    mockPluginApiGet.mockReset();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue({ data: [] });
  });

  it("renders nothing when the helpdesk plugin is not active", async () => {
    mockPluginApiGet.mockResolvedValueOnce({ data: { active: [] } });

    const { container } = render(
      <HelpdeskSection contactId={1} contactName="Raul Jefferson" />
    );

    await waitFor(() => expect(mockPluginApiGet).toHaveBeenCalledWith("/plugins/installed"));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the 'Abrir Protocolo' button when the helpdesk plugin is active", async () => {
    mockPluginApiGet.mockResolvedValueOnce({ data: { active: ["helpdesk"] } });

    render(<HelpdeskSection contactId={1} contactName="Raul Jefferson" />);

    expect(await screen.findByText("Abrir Protocolo")).toBeInTheDocument();
  });

  it("opens the protocol modal, pre-filled with the current contact, on click", async () => {
    mockPluginApiGet.mockResolvedValueOnce({ data: { active: ["helpdesk"] } });

    render(<HelpdeskSection contactId={42} contactName="Raul Jefferson" />);

    const button = await screen.findByText("Abrir Protocolo");
    fireEvent.click(button);

    expect(await screen.findByText("Novo Protocolo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Raul Jefferson")).toBeInTheDocument();
  });
});
