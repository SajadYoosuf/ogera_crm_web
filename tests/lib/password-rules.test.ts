import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, validateNewPassword } from "@/lib/password-rules";

describe("validateNewPassword", () => {
  it("accepts a password of 6 to 10 characters that matches the confirmation", () => {
    expect(validateNewPassword("abcdef", "abcdef")).toEqual({});
    expect(validateNewPassword("abcdefghij", "abcdefghij")).toEqual({});
  });

  it("rejects passwords shorter than 6 characters", () => {
    expect(validateNewPassword("abcde", "abcde").password).toBe("Use at least 6 characters.");
  });

  it("rejects passwords longer than the 15-character maximum", () => {
    const tooLong = "x".repeat(PASSWORD_MAX_LENGTH + 1);
    expect(validateNewPassword(tooLong, tooLong).password).toBe(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  });

  it("reports a mismatch only once the confirmation has text", () => {
    expect(validateNewPassword("NewPass123", "").confirm).toBeUndefined();
    expect(validateNewPassword("NewPass123", "NewPass12").confirm).toBe("Passwords don't match.");
  });
});
