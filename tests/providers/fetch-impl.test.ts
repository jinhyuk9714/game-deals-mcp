import { afterEach, describe, expect, it, vi } from "vitest";

import { bindFetchImplementation } from "../../src/providers/fetch-impl.js";

describe("bindFetchImplementation", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("wraps the global fetch so runtimes requiring the global this do not throw", async () => {
    globalThis.fetch = vi.fn(function (this: unknown, input: URL | Request | string, init?: RequestInit) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      return Promise.resolve(
        new Response(JSON.stringify({ input: String(input), hasInit: Boolean(init) }), { status: 200 })
      );
    }) as typeof fetch;

    const fetchImpl = bindFetchImplementation();

    await expect(fetchImpl("https://example.com")).resolves.toBeInstanceOf(Response);
  });

  it("uses an explicitly provided fetch implementation as-is", async () => {
    const provided = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;

    const fetchImpl = bindFetchImplementation(provided);

    await fetchImpl("https://example.com");

    expect(provided).toHaveBeenCalledOnce();
  });
});
