import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { Island, KindStyle } from "./architecture";
import type { IslandPlacement } from "./layout";
import { createRandom, randomBetween, type Random } from "./random";
import { MAP_THEME } from "./theme";

export const GROUND_LEVEL = 1.4;

const TERRAIN = {
  beachScale: 1.08,
  landScale: 0.95,
  cityScale: 0.74,
  cityPadMargin: 0.05,
  plazaRadius: 3.2,
  lotSpacing: 2.6,
  lotsPerBlock: 2,
  streetWidth: 0.45,
  tessellation: 72,
  shoreHarmonics: [
    { frequency: 2, amplitude: 0.07 },
    { frequency: 3, amplitude: 0.05 },
    { frequency: 5, amplitude: 0.03 },
    { frequency: 9, amplitude: 0.012 },
  ],
};

export type IslandView = {
  island: Island;
  root: TransformNode;
  marker: Mesh;
  labelAnchor: TransformNode;
  pickMeshes: Mesh[];
  shoreRadiusAt: (angle: number) => number;
};

type ShoreProfile = (angle: number) => number;

type CityGrid = {
  angle: number;
  toWorld: (u: number, v: number) => { x: number; z: number };
  insideCity: (x: number, z: number) => boolean;
  reach: number;
};

function createShoreProfile(random: Random, radius: number): ShoreProfile {
  const harmonics = TERRAIN.shoreHarmonics.map((harmonic) => ({ ...harmonic, phase: random() * Math.PI * 2 }));
  return (angle) => radius * (1 + harmonics.reduce((sum, h) => sum + h.amplitude * Math.sin(h.frequency * angle + h.phase), 0));
}

function createShoreSlab(params: {
  name: string;
  scene: Scene;
  shore: ShoreProfile;
  scale: number;
  bottom: number;
  top: number;
  material: StandardMaterial;
  parent: TransformNode;
}): Mesh {
  const { name, scene, shore, scale, bottom, top, material, parent } = params;
  const slab = MeshBuilder.CreateCylinder(name, { diameter: 2, height: top - bottom, tessellation: TERRAIN.tessellation, updatable: true }, scene);
  const positions = slab.getVerticesData("position")!;
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index]!;
    const z = positions[index + 2]!;
    if (Math.hypot(x, z) > 1e-4) {
      const reach = shore(Math.atan2(z, x)) * scale;
      positions[index] = x * reach;
      positions[index + 2] = z * reach;
    }
  }
  slab.updateVerticesData("position", positions);
  slab.createNormals(false);
  slab.refreshBoundingInfo();
  slab.position.y = (top + bottom) / 2;
  slab.material = material;
  slab.parent = parent;
  return slab;
}

function createMatteMaterial(name: string, color: Color3, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = Color3.Black();
  return material;
}

function createCityGrid(random: Random, shore: ShoreProfile): CityGrid {
  const angle = random() * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    angle,
    toWorld: (u, v) => ({ x: u * cos - v * sin, z: u * sin + v * cos }),
    insideCity: (x, z) => Math.hypot(x, z) < shore(Math.atan2(z, x)) * TERRAIN.cityScale,
    reach: shore(0) * 1.3,
  };
}

function createStreets(params: { island: Island; scene: Scene; grid: CityGrid; parent: TransformNode }): Mesh {
  const { island, scene, grid, parent } = params;
  const blockPitch = TERRAIN.lotSpacing * TERRAIN.lotsPerBlock;
  const segments: Matrix[] = [];
  const rotation = Quaternion.RotationAxis(Vector3.Up(), -grid.angle);
  for (let line = -grid.reach; line <= grid.reach; line += blockPitch) {
    const snapped = Math.round(line / blockPitch) * blockPitch;
    for (let along = -grid.reach; along <= grid.reach; along += TERRAIN.lotSpacing) {
      const segmentInside = (toWorld: (offset: number) => { x: number; z: number }) =>
        [0, TERRAIN.lotSpacing].every((offset) => {
          const end = toWorld(along + offset);
          return grid.insideCity(end.x, end.z);
        });
      const alongU = grid.toWorld(snapped, along + TERRAIN.lotSpacing / 2);
      if (segmentInside((offset) => grid.toWorld(snapped, offset))) {
        segments.push(Matrix.Compose(new Vector3(TERRAIN.streetWidth, 1, TERRAIN.lotSpacing + TERRAIN.streetWidth), rotation, new Vector3(alongU.x, GROUND_LEVEL + 0.03, alongU.z)));
      }
      const alongV = grid.toWorld(along + TERRAIN.lotSpacing / 2, snapped);
      if (segmentInside((offset) => grid.toWorld(offset, snapped))) {
        segments.push(Matrix.Compose(new Vector3(TERRAIN.lotSpacing + TERRAIN.streetWidth, 1, TERRAIN.streetWidth), rotation, new Vector3(alongV.x, GROUND_LEVEL + 0.03, alongV.z)));
      }
    }
  }
  const street = MeshBuilder.CreateBox(`${island.id}-streets`, { width: 1, height: 0.04, depth: 1 }, scene);
  street.material = createMatteMaterial(`${island.id}-streets-material`, MAP_THEME.street, scene);
  street.parent = parent;
  const matrices = new Float32Array(segments.length * 16);
  segments.forEach((segment, index) => segment.copyToArray(matrices, index * 16));
  street.thinInstanceSetBuffer("matrix", matrices, 16);
  street.isPickable = false;
  return street;
}

function createBuildings(params: { island: Island; scene: Scene; random: Random; grid: CityGrid; kindColor: Color3; parent: TransformNode }): Mesh {
  const { island, scene, random, grid, kindColor, parent } = params;
  const lots: { x: number; z: number; centrality: number }[] = [];
  for (let u = -grid.reach; u <= grid.reach; u += TERRAIN.lotSpacing) {
    for (let v = -grid.reach; v <= grid.reach; v += TERRAIN.lotSpacing) {
      const snappedU = (Math.round(u / TERRAIN.lotSpacing) + 0.5) * TERRAIN.lotSpacing;
      const snappedV = (Math.round(v / TERRAIN.lotSpacing) + 0.5) * TERRAIN.lotSpacing;
      const { x, z } = grid.toWorld(snappedU, snappedV);
      const distance = Math.hypot(x, z);
      if (distance > TERRAIN.plazaRadius + 1 && grid.insideCity(x, z)) {
        lots.push({ x, z, centrality: 1 - distance / grid.reach });
      }
    }
  }
  lots.sort(() => random() - 0.5);

  const buildingCount = Math.min(lots.length, 4 + Math.round(island.size ** 0.55));
  const skylineHeight = 1.2 + Math.log10(island.size + 1) * 1.8;
  const box = MeshBuilder.CreateBox(`${island.id}-buildings`, { size: 1 }, scene);
  box.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0));
  box.material = createMatteMaterial(`${island.id}-buildings-material`, Color3.White(), scene);
  box.parent = parent;

  const rotation = Quaternion.RotationAxis(Vector3.Up(), -grid.angle);
  const matrices = new Float32Array(buildingCount * 16);
  const colors = new Float32Array(buildingCount * 4);
  for (let index = 0; index < buildingCount; index++) {
    const lot = lots[index]!;
    const height = 0.5 + skylineHeight * lot.centrality ** 1.2 * randomBetween(random, 0.4, 1.3);
    Matrix.Compose(
      new Vector3(randomBetween(random, 1.1, 1.8), height, randomBetween(random, 1.1, 1.8)),
      rotation,
      new Vector3(lot.x, GROUND_LEVEL, lot.z),
    ).copyToArray(matrices, index * 16);
    const roof = random() < 0.12 ? Color3.Lerp(kindColor, MAP_THEME.roof[0]!, 0.45) : MAP_THEME.roof[Math.floor(random() * MAP_THEME.roof.length)]!;
    colors.set([roof.r, roof.g, roof.b, 1], index * 4);
  }
  box.thinInstanceSetBuffer("matrix", matrices, 16);
  box.thinInstanceSetBuffer("color", colors, 4);
  return box;
}

function createPlazaMarker(params: { island: Island; scene: Scene; kindColor: Color3; parent: TransformNode }): Mesh {
  const { island, scene, kindColor, parent } = params;
  const marker = MeshBuilder.CreateCylinder(`${island.id}-plaza`, { diameter: TERRAIN.plazaRadius * 2, height: 0.08, tessellation: 40 }, scene);
  marker.position.y = GROUND_LEVEL + 0.04;
  const material = createMatteMaterial(`${island.id}-plaza-material`, Color3.Lerp(kindColor, MAP_THEME.cityGround, 0.35), scene);
  material.emissiveColor = kindColor.scale(0.25);
  marker.material = material;
  marker.parent = parent;

  const ring = MeshBuilder.CreateTorus(`${island.id}-plaza-ring`, { diameter: TERRAIN.plazaRadius * 2, thickness: 0.25, tessellation: 40 }, scene);
  ring.position.y = 0.06;
  ring.material = createMatteMaterial(`${island.id}-plaza-ring-material`, MAP_THEME.street, scene);
  ring.parent = marker;
  ring.isPickable = false;
  return marker;
}

export function createIsland(params: { island: Island; placement: IslandPlacement; kindStyle: KindStyle; seed: number; scene: Scene }): IslandView {
  const { island, placement, kindStyle, seed, scene } = params;
  const random = createRandom(seed, island.id);
  const shore = createShoreProfile(random, placement.radius);
  const kindColor = Color3.FromHexString(kindStyle.color);
  const grid = createCityGrid(random, shore);

  const root = new TransformNode(island.id, scene);
  root.position.set(placement.x, 0, placement.z);

  const beach = createShoreSlab({ name: `${island.id}-beach`, scene, shore, scale: TERRAIN.beachScale, bottom: -0.5, top: 0.8, material: createMatteMaterial(`${island.id}-beach-material`, MAP_THEME.beach, scene), parent: root });
  const landTint = Color3.Lerp(MAP_THEME.land, MAP_THEME.landHighlight, random());
  const land = createShoreSlab({ name: `${island.id}-land`, scene, shore, scale: TERRAIN.landScale, bottom: 0.4, top: GROUND_LEVEL - 0.05, material: createMatteMaterial(`${island.id}-land-material`, landTint, scene), parent: root });
  const cityPad = createShoreSlab({ name: `${island.id}-city`, scene, shore, scale: TERRAIN.cityScale + TERRAIN.cityPadMargin, bottom: GROUND_LEVEL - 0.3, top: GROUND_LEVEL, material: createMatteMaterial(`${island.id}-city-material`, MAP_THEME.cityGround, scene), parent: root });

  createStreets({ island, scene, grid, parent: root });
  const buildings = createBuildings({ island, scene, random, grid, kindColor, parent: root });
  const marker = createPlazaMarker({ island, scene, kindColor, parent: root });
  const labelAnchor = new TransformNode(`${island.id}-label-anchor`, scene);
  labelAnchor.parent = root;
  labelAnchor.position.y = GROUND_LEVEL + 0.5;

  const pickMeshes = [beach, land, cityPad, buildings, marker];
  for (const mesh of pickMeshes) {
    mesh.metadata = { islandId: island.id };
  }
  return { island, root, marker, labelAnchor, pickMeshes, shoreRadiusAt: (angle) => shore(angle) * TERRAIN.beachScale };
}
