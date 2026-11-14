import { describe, expect, it } from "vitest";
import { createGuestEnsurer } from "@/lib/product/guestClient";

const ok = () => new Response("{}", { status: 200 });

describe("createGuestEnsurer", () => {
  it("sends one POST /api/guest for concurrent and later callers", async () => {
    const calls: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fetchFn = (async (url: string) => {
      calls.push(url);
      await gate;
      return ok();
    }) as unknown as typeof fetch;
    const ensure = createGuestEnsurer();
    const a = ensure(fetchFn);
    const b = ensure(fetchFn);
    release();
    await Promise.all([a, b]);
    await ensure(fetchFn);
    expect(calls).toEqual(["/api/guest"]);
  });

  it("tries again after a failure, and never rejects", async () => {
    let n = 0;
    const fetchFn = (async () => {
      n += 1;
      if (n === 1) throw new Error("offline");
      if (n === 2) return new Response("{}", { status: 503 });
      return ok();
    }) as unknown as typeof fetch;
    const ensure = createGuestEnsurer();
    await expect(ensure(fetchFn)).resolves.toBeUndefined();
    await ensure(fetchFn);
    await ensure(fetchFn);
    await ensure(fetchFn);
    expect(n).toBe(3);
  });
});
