import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CampaignRiskWarning from "../components/CampaignRiskWarning";

describe("CampaignRiskWarning", () => {
    it("always renders the risk text, never collapsible/dismissible", () => {
        render(<CampaignRiskWarning checked={false} onChange={vi.fn()} />);
        expect(screen.getByText("Risco de banimento da conexão")).toBeInTheDocument();
        expect(screen.getByRole("checkbox")).toBeInTheDocument();
        // No collapse/dismiss control of any kind next to the warning.
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("calls onChange when the checkbox is toggled", () => {
        const onChange = vi.fn();
        render(<CampaignRiskWarning checked={false} onChange={onChange} />);
        fireEvent.click(screen.getByRole("checkbox"));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it("reflects the checked state passed in", () => {
        render(<CampaignRiskWarning checked onChange={vi.fn()} />);
        expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "checked");
    });
});

/**
 * GroupCampaignEditor wires `disabled={!riskAckChecked}` into both the Save
 * and Start buttons -- exercised here with a minimal harness (the real
 * editor page needs routing/API mocks far beyond what this component
 * owns), matching the AC's "Salvar/Disparar desabilitados sem o checkbox".
 */
const EditorHarness: React.FC = () => {
    const [checked, setChecked] = useState(false);
    return (
        <div>
            <CampaignRiskWarning checked={checked} onChange={setChecked} />
            <button disabled={!checked}>Salvar rascunho</button>
            <button disabled={!checked}>Disparar</button>
        </div>
    );
};

describe("CampaignRiskWarning gating Save/Start", () => {
    it("disables Save and Start until the checkbox is marked", () => {
        render(<EditorHarness />);
        expect(screen.getByText("Salvar rascunho")).toBeDisabled();
        expect(screen.getByText("Disparar")).toBeDisabled();

        fireEvent.click(screen.getByRole("checkbox"));

        expect(screen.getByText("Salvar rascunho")).toBeEnabled();
        expect(screen.getByText("Disparar")).toBeEnabled();
    });
});
