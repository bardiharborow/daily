import type { Plugin, UpdatesByCategory } from "./types";

export function mergeUpdates(maps: UpdatesByCategory[]): UpdatesByCategory {
  return maps.reduce((merged, map) => {
    map.forEach((value, key) => {
      merged.set(key, [...(merged.get(key) ?? []), ...value]);
    });
    return merged;
  }, new Map<string, Array<string>>());
}

export function formatUpdates(updates: UpdatesByCategory): string {
  return Array.from(updates.entries())
    .filter(([, lines]) => lines.length > 0)
    .map(([category, lines]) =>
      [category, ...lines.map((line) => `* ${line}`)].join("\n"),
    )
    .join("\n\n");
}

export async function fetchUpdates(
  since: Date,
  plugins: Array<Plugin>,
): Promise<UpdatesByCategory> {
  const updates = await Promise.all(
    plugins.map((plugin) => plugin.fetchUpdatesByCategory(since)),
  );

  return mergeUpdates(updates);
}
