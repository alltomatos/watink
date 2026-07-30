import React from "react";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import QrcodeModal from "../index";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../../services/api", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { qrcode: "initial-qr" } }),
  },
}));

type Handler = (...args: never[]) => void;
let capturedHandler: Handler | undefined;

vi.mock("../../../services/sse-client", () => ({
  subscribeToSocket: (handlers: Record<string, Handler>) => {
    capturedHandler = handlers.whatsappSession;
    return () => {};
  },
}));

vi.mock("../../../translate/i18n", () => ({
  i18n: { t: (key: string) => key },
}));

describe("QrcodeModal", () => {
  beforeEach(() => {
    capturedHandler = undefined;
  });

  it("closes automatically when session.status turns CONNECTED for a numeric whatsAppId matched against a string session.id", async () => {
    const onClose = vi.fn();
    render(<QrcodeModal open onClose={onClose} whatsAppId={42} />);

    await waitFor(() => expect(capturedHandler).toBeDefined());

    // Backend session.id arrives as number; whatsAppId prop can be number OR
    // string depending on the caller — the comparison must not depend on
    // strict type equality between the two.
    capturedHandler!({
      action: "update",
      session: { id: 42, qrcode: "" },
    } as never);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("ignores update events for a different session id", async () => {
    const onClose = vi.fn();
    render(<QrcodeModal open onClose={onClose} whatsAppId={42} />);

    await waitFor(() => expect(capturedHandler).toBeDefined());

    capturedHandler!({
      action: "update",
      session: { id: 99, qrcode: "" },
    } as never);

    expect(onClose).not.toHaveBeenCalled();
  });
});
