export const MAX_ISLANDS = 64;

export type KindStyle = {
  label: string;
  color: string;
};

export type IslandKindStyle = KindStyle & {
  glyph: string;
};

export type Island = {
  id: string;
  label: string;
  kind: string;
  size: number;
  path: string;
  description: string;
};

export type Bridge = {
  from: string;
  to: string;
  kind: string;
  title: string;
  description: string;
};

export type Architecture = {
  title: string;
  subtitle: string;
  seed: number;
  islandKinds: Record<string, IslandKindStyle>;
  bridgeKinds: Record<string, KindStyle>;
  islands: Island[];
  bridges: Bridge[];
};

class ArchitectureContractError extends Error {
  constructor(path: string, expectation: string, value: unknown) {
    super(`architecture${path}: expected ${expectation}, got ${JSON.stringify(value)}`);
  }
}

function readObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ArchitectureContractError(path, "an object", value);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ArchitectureContractError(`${path}.${key}`, "a non-empty string", value);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ArchitectureContractError(`${path}.${key}`, "a finite number >= 0", value);
  }
  return value;
}

function readArray(record: Record<string, unknown>, key: string, path: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new ArchitectureContractError(`${path}.${key}`, "an array", value);
  }
  return value;
}

function readKindStyles(record: Record<string, unknown>, key: string): Record<string, KindStyle> {
  const kinds = readObject(record[key], `.${key}`);
  const styles: Record<string, KindStyle> = {};
  for (const [kind, rawStyle] of Object.entries(kinds)) {
    const path = `.${key}.${kind}`;
    const style = readObject(rawStyle, path);
    const color = readString(style, "color", path);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new ArchitectureContractError(`${path}.color`, "a #rrggbb color", color);
    }
    styles[kind] = { label: readString(style, "label", path), color };
  }
  return styles;
}

function readIslandKindStyles(record: Record<string, unknown>): Record<string, IslandKindStyle> {
  const kinds = readObject(record.islandKinds, ".islandKinds");
  return Object.fromEntries(
    Object.entries(readKindStyles(record, "islandKinds")).map(([kind, style]) => {
      const glyph = readString(readObject(kinds[kind], `.islandKinds.${kind}`), "glyph", `.islandKinds.${kind}`);
      return [kind, { ...style, glyph }];
    }),
  );
}

export function parseArchitecture(json: unknown): Architecture {
  const root = readObject(json, "");
  const islandKinds = readIslandKindStyles(root);
  const bridgeKinds = readKindStyles(root, "bridgeKinds");

  const rawIslands = readArray(root, "islands", "");
  if (rawIslands.length === 0 || rawIslands.length > MAX_ISLANDS) {
    throw new ArchitectureContractError(".islands", `between 1 and ${MAX_ISLANDS} islands`, rawIslands.length);
  }
  const islands = rawIslands.map((rawIsland, index): Island => {
    const path = `.islands[${index}]`;
    const island = readObject(rawIsland, path);
    const kind = readString(island, "kind", path);
    if (!(kind in islandKinds)) {
      throw new ArchitectureContractError(`${path}.kind`, `one of ${Object.keys(islandKinds).join(", ")}`, kind);
    }
    return {
      id: readString(island, "id", path),
      label: readString(island, "label", path),
      kind,
      size: readNumber(island, "size", path),
      path: readString(island, "path", path),
      description: readString(island, "description", path),
    };
  });

  const islandIds = new Set<string>();
  islands.forEach((island, index) => {
    if (islandIds.has(island.id)) {
      throw new ArchitectureContractError(`.islands[${index}].id`, "a unique island id", island.id);
    }
    islandIds.add(island.id);
  });

  const bridges = readArray(root, "bridges", "").map((rawBridge, index): Bridge => {
    const path = `.bridges[${index}]`;
    const bridge = readObject(rawBridge, path);
    const from = readString(bridge, "from", path);
    const to = readString(bridge, "to", path);
    const kind = readString(bridge, "kind", path);
    if (!islandIds.has(from)) {
      throw new ArchitectureContractError(`${path}.from`, "an island id", from);
    }
    if (!islandIds.has(to) || to === from) {
      throw new ArchitectureContractError(`${path}.to`, "an island id different from `from`", to);
    }
    if (!(kind in bridgeKinds)) {
      throw new ArchitectureContractError(`${path}.kind`, `one of ${Object.keys(bridgeKinds).join(", ")}`, kind);
    }
    return { from, to, kind, title: readString(bridge, "title", path), description: readString(bridge, "description", path) };
  });

  return {
    title: readString(root, "title", ""),
    subtitle: readString(root, "subtitle", ""),
    seed: readNumber(root, "seed", ""),
    islandKinds,
    bridgeKinds,
    islands,
    bridges,
  };
}
