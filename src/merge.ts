import type { UpdatesByCategory } from "./types";

export function mergeUpdates(maps: UpdatesByCategory[]): UpdatesByCategory {
  return maps.reduce((merged, map) => {
    map.forEach((value, key) => {
      merged.set(key, [...(merged.get(key) ?? []), ...value]);
    });
    return merged;
  }, new Map<string, Array<string>>());
}
