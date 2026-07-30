import React from "react";
import { expect, describe, it, vi } from "vitest";
import { render } from "@testing-library/react";
import MessageOptionsMenu from "../index";

describe("MessageOptionsMenu — alinhamento do popup", () => {
  it("mirrors the full bounding rect of anchorEl onto the invisible trigger, not just a zero-size corner point", () => {
    const anchorEl = document.createElement("button");
    document.body.appendChild(anchorEl);
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue({
      top: 120,
      left: 340,
      right: 356,
      bottom: 136,
      width: 16,
      height: 16,
      x: 340,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect);

    const { container } = render(
      <MessageOptionsMenu
        message={{ id: 1, fromMe: false }}
        menuOpen={false}
        handleClose={() => {}}
        anchorEl={anchorEl}
      />
    );

    const invisibleTrigger = container.querySelector('[style*="position: fixed"]') as HTMLElement;
    expect(invisibleTrigger).toBeTruthy();
    expect(invisibleTrigger.style.top).toBe("120px");
    expect(invisibleTrigger.style.left).toBe("340px");
    expect(invisibleTrigger.style.width).toBe("16px");
    expect(invisibleTrigger.style.height).toBe("16px");

    document.body.removeChild(anchorEl);
  });
});
