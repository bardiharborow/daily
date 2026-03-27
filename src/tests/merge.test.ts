import { describe, expect, it } from "vitest";
import { mergeUpdates } from "../merge";
import type { UpdatesByCategory } from "../types";

describe("mergeUpdates", () => {
  it("returns an empty map for an empty input", () => {
    expect(mergeUpdates([])).toEqual(new Map());
  });

  it("returns the single map unchanged", () => {
    const input: UpdatesByCategory[] = [
      new Map([["Code Review", ["✅ PR one (#1)"]]]),
    ];
    expect(mergeUpdates(input)).toEqual(
      new Map([["Code Review", ["✅ PR one (#1)"]]]),
    );
  });

  it("concatenates arrays under the same key", () => {
    const input: UpdatesByCategory[] = [
      new Map([["Code Review", ["✅ PR one (#1)"]]]),
      new Map([["Code Review", ["❌ PR two (#2)"]]]),
    ];
    expect(mergeUpdates(input)).toEqual(
      new Map([["Code Review", ["✅ PR one (#1)", "❌ PR two (#2)"]]]),
    );
  });

  it("keeps disjoint keys from different plugins separate", () => {
    const input: UpdatesByCategory[] = [
      new Map([["Code Review", ["✅ PR one (#1)"]]]),
      new Map([["Deployments", ["Deployed v1.2.3"]]]),
    ];
    expect(mergeUpdates(input)).toEqual(
      new Map([
        ["Code Review", ["✅ PR one (#1)"]],
        ["Deployments", ["Deployed v1.2.3"]],
      ]),
    );
  });

  it("preserves order — first plugin's items come before second plugin's", () => {
    const input: UpdatesByCategory[] = [
      new Map([["A", ["first", "second"]]]),
      new Map([["A", ["third"]]]),
    ];
    expect(mergeUpdates(input)).toEqual(
      new Map([["A", ["first", "second", "third"]]]),
    );
  });

  it("handles an empty array value for a key without dropping it", () => {
    const input: UpdatesByCategory[] = [
      new Map([["Code Review", []]]),
      new Map([["Code Review", ["✅ PR one (#1)"]]]),
    ];
    expect(mergeUpdates(input)).toEqual(
      new Map([["Code Review", ["✅ PR one (#1)"]]]),
    );
  });
});
