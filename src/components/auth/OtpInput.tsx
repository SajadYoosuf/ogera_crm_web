"use client";

import { ClipboardEvent, KeyboardEvent, useRef } from "react";

type OtpInputProps = {
  digits: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/** Six single-digit boxes: auto-advances, backspace steps back, and a pasted code fills every box. */
export default function OtpInput({ digits, onChange, disabled }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function focusBox(index: number) {
    inputs.current[index]?.focus();
  }

  function fillFrom(start: number, text: string) {
    const next = [...digits];
    const chars = text.replace(/\D/g, "").split("");
    chars.forEach((char, offset) => {
      if (start + offset < next.length) next[start + offset] = char;
    });
    onChange(next);
    focusBox(Math.min(start + chars.length, next.length - 1));
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (typed.length > 1) {
      fillFrom(index, typed);
      return;
    }
    const next = [...digits];
    next[index] = typed;
    onChange(next);
    if (typed && index < digits.length - 1) focusBox(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      onChange(next);
      focusBox(index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      focusBox(index - 1);
    } else if (event.key === "ArrowRight" && index < digits.length - 1) {
      focusBox(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData("text"));
  }

  return (
    <div className="login-otp-row" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          className="login-otp-box"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
