export function normalizeL2(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

export function compressUuidMap(
  pairs: [string, string][]
): Record<string, string> {
  const sortedPairs = pairs.map(([a, b]) => [a, b].sort()).sort();
  const map: Record<string, string> = {};

  for (const [a, b] of sortedPairs) {
    const rootA = map[a!] || a || "";
    const rootB = map[b!] || b || "";
    const root = rootA < rootB ? rootA : rootB;

    map[a!] = root;
    map[b!] = root;
  }

  return map;
}

// Tipos auxiliares
export interface EntityNode {
  uuid: string;
  name: string;
  type: string;
  summary?: string;
  properties?: Record<string, any>;
  nameEmbedding?: number[];
}

export interface EntityEdge {
  uuid: string;
  sourceNodeUuid: string;
  targetNodeUuid: string;
  type: string;
  fact: string;
  factEmbedding?: number[];
}

export interface EpisodicNode {
  uuid: string;
  name: string;
}
