import { describe, expect, it, vi } from "vitest";

import { TtlCache } from "../../src/cache/ttl-cache.js";

describe("TtlCache", () => {
  it("reuses a cached value until the ttl expires", async () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string, number>();
    const loader = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    await expect(cache.getOrLoad("key", 10_000, loader)).resolves.toBe(1);
    await expect(cache.getOrLoad("key", 10_000, loader)).resolves.toBe(1);

    vi.advanceTimersByTime(10_001);

    await expect(cache.getOrLoad("key", 10_000, loader)).resolves.toBe(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
