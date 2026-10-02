// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getMe, login } from "@/lib/api/auth";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }));
}

async function kindOf(promise: Promise<unknown>) {
  const error = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => vi.unstubAllGlobals());

describe("auth client", () => {
  it("returns the token and employee on 200", async () => {
    mockFetch(200, { access_token: "t", token_type: "bearer", employee: { id: 1 } });
    await expect(login("a@b.com", "pw")).resolves.toMatchObject({ access_token: "t" });
  });

  it("maps 401 to invalid_credentials", async () => {
    mockFetch(401, { detail: "nope" });
    expect((await kindOf(login("a@b.com", "bad"))).kind).toBe("invalid_credentials");
  });

  it("maps 403 to inactive_account", async () => {
    mockFetch(403, { detail: "inactive" });
    expect((await kindOf(login("a@b.com", "pw"))).kind).toBe("inactive_account");
  });

  it("surfaces FastAPI 422 validation messages", async () => {
    mockFetch(422, { detail: [{ msg: "value is not a valid email address" }] });
    const error = await kindOf(login("x", "pw"));
    expect(error.kind).toBe("validation");
    expect(error.message).toContain("valid email");
  });

  it("maps 5xx to a retryable server error", async () => {
    mockFetch(500, {});
    const error = await kindOf(login("a@b.com", "pw"));
    expect(error.kind).toBe("server");
    expect(error.retryable).toBe(true);
  });

  it("maps a rejected fetch to a retryable network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await kindOf(login("a@b.com", "pw"));
    expect(error.kind).toBe("network");
    expect(error.retryable).toBe(true);
  });

  it("fails fast as offline without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect((await kindOf(login("a@b.com", "pw"))).kind).toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("sends the bearer token to /auth/me and words a 401 as an expired session", async () => {
    mockFetch(401, { detail: "expired" });
    const error = await kindOf(getMe("tok"));
    expect(error.message).toMatch(/expired/i);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
});
