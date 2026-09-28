import {
  Animation,
  ArcRotateCamera,
  Color3,
  Color4,
  CubicEase,
  DirectionalLight,
  EasingFunction,
  Engine,
  HemisphericLight,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import type { Architecture } from "./architecture";
import { createBlips } from "./blips";
import { BRIDGE_STATE, createBridge, type BridgeView } from "./bridge";
import { createCallout } from "./callout";
import { createIsland, type IslandView } from "./island";
import { layoutIslands } from "./layout";
import { createMapGrade } from "./postfx";
import { MAP_THEME } from "./theme";
import { createWater } from "./water";

const CAMERA = {
  alpha: -Math.PI / 2,
  beta: 0.42,
  fov: 0.45,
  fitMargin: 1.1,
  maxBeta: 1.05,
};

export type World = {
  select: (islandId: string | null) => void;
  onIslandPicked: (listener: (islandId: string | null) => void) => void;
  dispose: () => void;
};

function createCamera(scene: Scene, canvas: HTMLCanvasElement, extent: number): ArcRotateCamera {
  const fitRadius = (extent * CAMERA.fitMargin) / Math.tan(CAMERA.fov / 2);
  const camera = new ArcRotateCamera("camera", CAMERA.alpha, CAMERA.beta, fitRadius, Vector3.Zero(), scene);
  camera.fov = CAMERA.fov;
  camera.lowerBetaLimit = 0.05;
  camera.upperBetaLimit = CAMERA.maxBeta;
  camera.lowerRadiusLimit = fitRadius * 0.12;
  camera.upperRadiusLimit = fitRadius * 1.6;
  camera.wheelDeltaPercentage = 0.02;
  camera.panningSensibility = 12;
  camera.minZ = 1;
  camera.maxZ = fitRadius * 4;
  camera.attachControl(canvas, true);
  return camera;
}

function createLights(scene: Scene, extent: number): ShadowGenerator {
  const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  sky.intensity = 0.85;
  sky.groundColor = Color3.FromHexString("#3a4652");
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.35).normalize(), scene);
  sun.position = new Vector3(extent, extent * 1.5, -extent);
  sun.intensity = 0.7;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.002;
  shadows.setDarkness(0.4);
  return shadows;
}

export function createWorld(canvas: HTMLCanvasElement, architecture: Architecture): World {
  const engine = new Engine(canvas, true, { stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(MAP_THEME.horizon);
  const placements = layoutIslands(architecture);
  const extent = Math.max(...[...placements.values()].map((placement) => Math.hypot(placement.x, placement.z) + placement.radius));

  const camera = createCamera(scene, canvas, extent);
  const shadows = createLights(scene, extent);
  createWater({ scene, extent, placements: [...placements.values()] });
  createMapGrade(scene, camera);

  const islandViews = new Map<string, IslandView>();
  for (const island of architecture.islands) {
    const view = createIsland({ island, placement: placements.get(island.id)!, kindStyle: architecture.islandKinds[island.kind]!, seed: architecture.seed, scene });
    view.pickMeshes.forEach((mesh) => {
      mesh.receiveShadows = true;
      shadows.addShadowCaster(mesh);
    });
    islandViews.set(island.id, view);
  }

  const lanesByPair = new Map<string, Architecture["bridges"]>();
  for (const bridge of architecture.bridges) {
    const pairKey = [bridge.from, bridge.to].sort().join("|");
    lanesByPair.set(pairKey, [...(lanesByPair.get(pairKey) ?? []), bridge]);
  }
  const bridgeViews: BridgeView[] = architecture.bridges.map((bridge) => {
    const lanes = lanesByPair.get([bridge.from, bridge.to].sort().join("|"))!;
    const [first, second] = [bridge.from, bridge.to].sort();
    const view = createBridge({
      bridge,
      from: islandViews.get(first!)!,
      to: islandViews.get(second!)!,
      lane: lanes.indexOf(bridge),
      laneCount: lanes.length,
      kindStyle: architecture.bridgeKinds[bridge.kind]!,
      scene,
    });
    view.meshes.forEach((mesh) => shadows.addShadowCaster(mesh));
    return view;
  });

  const gui = AdvancedDynamicTexture.CreateFullscreenUI("map-ui", true, scene);
  gui.layer!.applyPostProcess = false;
  const blips = createBlips({ gui, architecture, islandViews });
  const callout = createCallout(gui);
  const labelOf = (id: string) => islandViews.get(id)!.island.label;

  let selectedId: string | null = null;
  const restingStateOf = (view: BridgeView) =>
    selectedId === null || view.bridge.from === selectedId || view.bridge.to === selectedId ? BRIDGE_STATE.resting : BRIDGE_STATE.dimmed;

  const select = (islandId: string | null) => {
    selectedId = islandId;
    bridgeViews.forEach((view) => view.setState(restingStateOf(view)));
    blips.setSelected(islandId);
    if (islandId === null) {
      return;
    }
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    Animation.CreateAndStartAnimation("focus", camera, "target", 60, 45, camera.target.clone(), islandViews.get(islandId)!.root.position.clone(), Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
  };

  const pickListeners: ((islandId: string | null) => void)[] = [];
  let hovered: { key: string; release: () => void } | null = null;
  const clearHover = () => {
    hovered?.release();
    hovered = null;
    callout.hide();
  };
  const hover = (key: string, engage: () => () => void) => {
    if (hovered?.key === key) return;
    hovered?.release();
    hovered = { key, release: engage() };
  };

  const hoverIsland = (view: IslandView) =>
    hover(`island:${view.island.id}`, () => {
      const island = view.island;
      const dependsOn = architecture.bridges.filter((bridge) => bridge.from === island.id).length;
      const usedBy = architecture.bridges.filter((bridge) => bridge.to === island.id).length;
      const kindStyle = architecture.islandKinds[island.kind]!;
      blips.setLabelVisible(island.id, false);
      callout.show(view.labelAnchor, {
        title: island.label,
        subtitle: `${kindStyle.label} · ${island.path} · depends on ${dependsOn}, used by ${usedBy}`,
        description: island.description,
        accentColor: kindStyle.color,
      });
      return () => blips.setLabelVisible(island.id, true);
    });

  const hoverBridge = (view: BridgeView) =>
    hover(`bridge:${bridgeViews.indexOf(view)}`, () => {
      const bridge = view.bridge;
      const kindStyle = architecture.bridgeKinds[bridge.kind]!;
      callout.show(view.anchor, {
        title: bridge.title,
        subtitle: `${labelOf(bridge.from)} → ${labelOf(bridge.to)} · ${kindStyle.label}`,
        description: bridge.description,
        accentColor: kindStyle.color,
      });
      view.setState(BRIDGE_STATE.hovered);
      return () => view.setState(restingStateOf(view));
    });

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === PointerEventTypes.POINTERTAP) {
      const islandId: string | null = pointerInfo.pickInfo?.pickedMesh?.metadata?.islandId ?? null;
      pickListeners.forEach((listener) => listener(islandId));
    }
    if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
      const metadata = scene.pick(scene.pointerX, scene.pointerY).pickedMesh?.metadata;
      canvas.style.cursor = metadata?.islandId !== undefined ? "pointer" : "default";
      if (metadata?.islandId !== undefined) {
        hoverIsland(islandViews.get(metadata.islandId)!);
      } else if (metadata?.bridge !== undefined) {
        hoverBridge(bridgeViews.find((view) => view.bridge === metadata.bridge)!);
      } else {
        clearHover();
      }
    }
  });

  const startedAt = performance.now();
  scene.onBeforeRenderObservable.add(() => {
    const seconds = (performance.now() - startedAt) / 1000;
    bridgeViews.forEach((view) => {
      const forward = view.bridge.from === [view.bridge.from, view.bridge.to].sort()[0];
      view.animate(forward ? seconds : -seconds);
    });
    blips.animate(seconds);
  });

  engine.runRenderLoop(() => scene.render());
  const resize = () => engine.resize();
  window.addEventListener("resize", resize);

  return {
    select,
    onIslandPicked: (listener) => pickListeners.push(listener),
    dispose: () => {
      window.removeEventListener("resize", resize);
      engine.dispose();
    },
  };
}
