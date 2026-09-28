import type { Architecture } from "./architecture";
import { createRandom } from "./random";

export type IslandPlacement = {
  x: number;
  z: number;
  radius: number;
};

type Point = { x: number; z: number };

const LAYOUT = {
  minRadius: 7,
  radiusPerSizeDecade: 3.4,
  bridgeSlack: 30,
  shoreGap: 20,
  outskirtsFactor: 0.7,
  attempts: 12,
  stressIterations: 300,
  overlapPasses: 60,
};

export function islandRadius(size: number): number {
  return LAYOUT.minRadius + LAYOUT.radiusPerSizeDecade * Math.log10(size + 1);
}

function shortestSeaDistances(architecture: Architecture, radii: number[]): number[][] {
  const count = radii.length;
  const indexById = new Map(architecture.islands.map((island, index) => [island.id, index]));
  const distances = Array.from({ length: count }, (_, a) => Array.from({ length: count }, (_, b) => (a === b ? 0 : Infinity)));
  for (const bridge of architecture.bridges) {
    const a = indexById.get(bridge.from)!;
    const b = indexById.get(bridge.to)!;
    const span = radii[a]! + radii[b]! + LAYOUT.bridgeSlack;
    distances[a]![b] = Math.min(distances[a]![b]!, span);
    distances[b]![a] = Math.min(distances[b]![a]!, span);
  }
  for (let via = 0; via < count; via++) {
    for (let a = 0; a < count; a++) {
      for (let b = 0; b < count; b++) {
        const throughVia = distances[a]![via]! + distances[via]![b]!;
        if (throughVia < distances[a]![b]!) distances[a]![b] = throughVia;
      }
    }
  }
  const longestRoute = Math.max(...distances.flat().filter(Number.isFinite));
  return distances.map((row, a) => row.map((distance, b) => (Number.isFinite(distance) ? distance : longestRoute * LAYOUT.outskirtsFactor + radii[a]! + radii[b]!)));
}

function stressOf(points: Point[], targets: number[][]): number {
  let stress = 0;
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const target = targets[a]![b]!;
      const gap = Math.hypot(points[a]!.x - points[b]!.x, points[a]!.z - points[b]!.z) - target;
      stress += (gap * gap) / (target * target);
    }
  }
  return stress;
}

function relaxStress(points: Point[], targets: number[][]): void {
  for (let iteration = 0; iteration < LAYOUT.stressIterations; iteration++) {
    points.forEach((point, a) => {
      let weightSum = 0;
      let x = 0;
      let z = 0;
      points.forEach((other, b) => {
        if (a === b) return;
        const target = targets[a]![b]!;
        const weight = 1 / (target * target);
        const distance = Math.max(Math.hypot(point.x - other.x, point.z - other.z), 1e-3);
        x += weight * (other.x + (target * (point.x - other.x)) / distance);
        z += weight * (other.z + (target * (point.z - other.z)) / distance);
        weightSum += weight;
      });
      point.x = x / weightSum;
      point.z = z / weightSum;
    });
  }
}

function separateShores(points: Point[], radii: number[]): void {
  for (let pass = 0; pass < LAYOUT.overlapPasses; pass++) {
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        const dx = points[b]!.x - points[a]!.x;
        const dz = points[b]!.z - points[a]!.z;
        const distance = Math.max(Math.hypot(dx, dz), 1e-3);
        const overlap = radii[a]! + radii[b]! + LAYOUT.shoreGap - distance;
        if (overlap > 0) {
          const push = overlap / 2 / distance;
          points[a]!.x -= dx * push;
          points[a]!.z -= dz * push;
          points[b]!.x += dx * push;
          points[b]!.z += dz * push;
        }
      }
    }
  }
}

export function layoutIslands(architecture: Architecture): Map<string, IslandPlacement> {
  const radii = architecture.islands.map((island) => islandRadius(island.size));
  const targets = shortestSeaDistances(architecture, radii);
  const spread = Math.max(...targets.flat());

  let best: { points: Point[]; stress: number } | null = null;
  for (let attempt = 0; attempt < LAYOUT.attempts; attempt++) {
    const random = createRandom(architecture.seed + attempt, "layout");
    const points = radii.map(() => ({ x: (random() - 0.5) * spread, z: (random() - 0.5) * spread }));
    relaxStress(points, targets);
    separateShores(points, radii);
    const stress = stressOf(points, targets);
    if (best === null || stress < best.stress) {
      best = { points, stress };
    }
  }

  const points = best!.points;
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const centerZ = points.reduce((sum, point) => sum + point.z, 0) / points.length;
  return new Map(architecture.islands.map((island, index) => [island.id, { x: points[index]!.x - centerX, z: points[index]!.z - centerZ, radius: radii[index]! }]));
}
