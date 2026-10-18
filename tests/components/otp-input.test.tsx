// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OtpInput from "@/components/auth/OtpInput";

afterEach(cleanup);

function renderControlled(initial: string[] = ["", "", "", "", "", ""]) {
  const onChange = vi.fn();
  const view = render(<OtpInput digits={initial} onChange={onChange} />);
  return { onChange, boxes: () => screen.getAllByRole("textbox") as HTMLInputElement[], view };
}

describe("OtpInput", () => {
  it("keeps only the typed digit and moves focus to the next box", () => {
    const { onChange, boxes } = renderControlled();

    fireEvent.change(boxes()[0], { target: { value: "7" } });

    expect(onChange).toHaveBeenCalledWith(["7", "", "", "", "", ""]);
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it("ignores letters", () => {
    const { onChange, boxes } = renderControlled();

    fireEvent.change(boxes()[0], { target: { value: "a" } });

    expect(onChange).toHaveBeenCalledWith(["", "", "", "", "", ""]);
  });

  it("backspace on an empty box clears the previous box and steps back", () => {
    const { onChange, boxes } = renderControlled(["4", "5", "", "", "", ""]);

    fireEvent.keyDown(boxes()[2], { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith(["4", "", "", "", "", ""]);
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it("a pasted code fills every box in order", () => {
    const { onChange, boxes } = renderControlled();

    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => "123456" } });

    expect(onChange).toHaveBeenCalledWith(["1", "2", "3", "4", "5", "6"]);
  });
});
