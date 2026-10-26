// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

describe("auth client storage cleanup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not crash when Chrome denies browser storage access", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    });
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    });

    await expect(import("@/lib/api/auth")).resolves.toBeDefined();
  });
});
