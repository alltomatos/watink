import React from "react";
import { expect, describe, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PipelineStageList from "../PipelineStageList";
import type { StageFormItem } from "../../pipelineCreatorTypes";

const stages: StageFormItem[] = [
  { name: "Novo", colorKey: "blue" },
  { name: "Em Andamento", colorKey: "yellow" },
  { name: "Fechado", colorKey: "green" },
];

const noop = () => {};

describe("PipelineStageList — reordenação", () => {
  it("calls onMoveStage(index, 'down') when the down arrow is clicked", () => {
    const onMoveStage = vi.fn();
    render(
      <PipelineStageList
        stages={stages}
        onStageChange={noop}
        onStageColorChange={noop}
        onAddStage={noop}
        onRemoveStage={noop}
        onMoveStage={onMoveStage}
      />
    );

    fireEvent.click(screen.getByLabelText('Mover "Novo" para baixo'));
    expect(onMoveStage).toHaveBeenCalledWith(0, "down");
  });

  it("calls onMoveStage(index, 'up') when the up arrow is clicked", () => {
    const onMoveStage = vi.fn();
    render(
      <PipelineStageList
        stages={stages}
        onStageChange={noop}
        onStageColorChange={noop}
        onAddStage={noop}
        onRemoveStage={noop}
        onMoveStage={onMoveStage}
      />
    );

    fireEvent.click(screen.getByLabelText('Mover "Em Andamento" para cima'));
    expect(onMoveStage).toHaveBeenCalledWith(1, "up");
  });

  it("disables the up arrow on the first stage and the down arrow on the last stage", () => {
    render(
      <PipelineStageList
        stages={stages}
        onStageChange={noop}
        onStageColorChange={noop}
        onAddStage={noop}
        onRemoveStage={noop}
        onMoveStage={noop}
      />
    );

    expect(screen.getByLabelText('Mover "Novo" para cima')).toBeDisabled();
    expect(screen.getByLabelText('Mover "Fechado" para baixo')).toBeDisabled();
    expect(screen.getByLabelText('Mover "Em Andamento" para cima')).not.toBeDisabled();
    expect(screen.getByLabelText('Mover "Em Andamento" para baixo')).not.toBeDisabled();
  });
});
