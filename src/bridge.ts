import { Color3, Curve3, Mesh, MeshBuilder, Path3D, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { Bridge, KindStyle } from "./architecture";
import { GROUND_LEVEL, type IslandView } from "./island";
import { MAP_THEME } from "./theme";

const SPAN = {
  pathPoints: 48,
  deckRadius: 0.6,
  routeRadius: 0.42,
  routeGlow: 0.9,
  hoverRadius: 1.6,
  laneSpacing: 2.2,
  archBase: 1.2,
  archPerLength: 0.05,
  shoreInset: 0.9,
  pillarAt: [0.2, 0.5, 0.8],
  carsPerBridge: 3,
  carSpeed: 14,
};

export const BRIDGE_STATE = {
  resting: "resting",
  hovered: "hovered",
  dimmed: "dimmed",
} as const;

export type BridgeState = (typeof BRIDGE_STATE)[keyof typeof BRIDGE_STATE];

const BRIDGE_STATE_LOOK: Record<BridgeState, { alpha: number; routeGlow: number; interactive: boolean }> = {
  resting: { alpha: 1, routeGlow: SPAN.routeGlow, interactive: true },
  hovered: { alpha: 1, routeGlow: 1.6, interactive: true },
  dimmed: { alpha: 0.12, routeGlow: SPAN.routeGlow, interactive: false },
};

export type BridgeView = {
  bridge: Bridge;
  meshes: Mesh[];
  anchor: TransformNode;
  setState: (state: BridgeState) => void;
  animate: (seconds: number) => void;
};

export function createBridge(params: {
  bridge: Bridge;
  from: IslandView;
  to: IslandView;
  lane: number;
  laneCount: number;
  kindStyle: KindStyle;
  scene: Scene;
}): BridgeView {
  const { bridge, from, to, lane, laneCount, kindStyle, scene } = params;
  const name = `${bridge.from}->${bridge.to}:${bridge.kind}`;
  const fromCenter = from.root.position;
  const toCenter = to.root.position;
  const heading = Math.atan2(toCenter.z - fromCenter.z, toCenter.x - fromCenter.x);
  const direction = new Vector3(Math.cos(heading), 0, Math.sin(heading));
  const side = new Vector3(-direction.z, 0, direction.x).scale((lane - (laneCount - 1) / 2) * SPAN.laneSpacing);

  const start = fromCenter.add(direction.scale(from.shoreRadiusAt(heading) * SPAN.shoreInset)).add(side);
  const end = toCenter.subtract(direction.scale(to.shoreRadiusAt(heading + Math.PI) * SPAN.shoreInset)).add(side);
  start.y = GROUND_LEVEL;
  end.y = GROUND_LEVEL;
  const length = Vector3.Distance(start, end);
  const control = Vector3.Center(start, end);
  control.y = GROUND_LEVEL + (SPAN.archBase + length * SPAN.archPerLength) * 2;
  const points = Curve3.CreateQuadraticBezier(start, control, end, SPAN.pathPoints).getPoints();
  const path = new Path3D(points);

  const color = Color3.FromHexString(kindStyle.color);
  const material = new StandardMaterial(`${name}-route-material`, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(SPAN.routeGlow);
  material.specularColor = Color3.Black();
  const deckMaterial = new StandardMaterial(`${name}-deck-material`, scene);
  deckMaterial.diffuseColor = MAP_THEME.roadDeck;
  deckMaterial.specularColor = Color3.Black();

  const deck = MeshBuilder.CreateTube(`${name}-deck`, { path: points, radius: SPAN.deckRadius, tessellation: 8, cap: Mesh.CAP_ALL }, scene);
  deck.material = deckMaterial;
  deck.isPickable = false;
  const routePoints = points.map((point) => point.add(new Vector3(0, SPAN.deckRadius * 0.7, 0)));
  const route = MeshBuilder.CreateTube(`${name}-route`, { path: routePoints, radius: SPAN.routeRadius, tessellation: 6, cap: Mesh.CAP_ALL }, scene);
  route.material = material;
  route.isPickable = false;
  const meshes: Mesh[] = [deck, route];

  for (const fraction of SPAN.pillarAt) {
    const top = path.getPointAt(fraction);
    const pillar = MeshBuilder.CreateCylinder(`${name}-pillar`, { diameter: 0.3, height: top.y + 0.5, tessellation: 6 }, scene);
    pillar.position.set(top.x, (top.y - 0.5) / 2, top.z);
    pillar.material = deckMaterial;
    pillar.isPickable = false;
    meshes.push(pillar);
  }

  const carMaterial = new StandardMaterial(`${name}-car-material`, scene);
  carMaterial.diffuseColor = Color3.White();
  carMaterial.emissiveColor = Color3.White().scale(0.6);
  const cars = Array.from({ length: SPAN.carsPerBridge }, (_, index) => {
    const car = MeshBuilder.CreateBox(`${name}-car-${index}`, { width: 0.8, height: 0.35, depth: 0.45 }, scene);
    car.material = carMaterial;
    car.isPickable = false;
    return car;
  });

  const lapSeconds = length / SPAN.carSpeed;
  const animate = (seconds: number) => {
    cars.forEach((car, index) => {
      const fraction = ((seconds / lapSeconds + index / cars.length) % 1 + 1) % 1;
      const point = path.getPointAt(fraction);
      const tangent = path.getTangentAt(fraction, true);
      car.position.set(point.x, point.y + SPAN.deckRadius + 0.2, point.z);
      car.rotation.set(0, -Math.atan2(tangent.z, tangent.x), Math.asin(Math.max(-1, Math.min(1, tangent.y))));
    });
  };
  animate(0);

  const hoverArea = MeshBuilder.CreateTube(`${name}-hover-area`, { path: points, radius: SPAN.hoverRadius, tessellation: 6 }, scene);
  hoverArea.visibility = 0;
  hoverArea.metadata = { bridge };

  const anchor = new TransformNode(`${name}-anchor`, scene);
  anchor.position = path.getPointAt(0.5).add(new Vector3(0, SPAN.deckRadius, 0));

  const setState = (state: BridgeState) => {
    const look = BRIDGE_STATE_LOOK[state];
    material.alpha = look.alpha;
    deckMaterial.alpha = look.alpha;
    material.emissiveColor = color.scale(look.routeGlow);
    cars.forEach((car) => car.setEnabled(look.interactive));
    hoverArea.isPickable = look.interactive;
  };

  return { bridge, meshes, anchor, setState, animate };
}
