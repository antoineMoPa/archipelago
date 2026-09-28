import { Effect, MeshBuilder, Scene, ShaderMaterial } from "@babylonjs/core";
import { MAX_ISLANDS } from "./architecture";
import type { IslandPlacement } from "./layout";
import { MAP_THEME } from "./theme";

const SHORE_REACH = 1.08;

Effect.ShadersStore.mapWaterVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec3 vWorld;
void main() {
  vWorld = (world * vec4(position, 1.0)).xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

Effect.ShadersStore.mapWaterFragmentShader = `
precision highp float;
#define MAX_ISLANDS ${MAX_ISLANDS}
varying vec3 vWorld;
uniform vec3 shores[MAX_ISLANDS];
uniform float shoreCount;
uniform float time;
uniform vec3 deepSea;
uniform vec3 openSea;
uniform vec3 shallowSea;
uniform vec3 surf;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float distanceToShore = 1e5;
  for (int i = 0; i < MAX_ISLANDS; i++) {
    if (float(i) >= shoreCount) break;
    distanceToShore = min(distanceToShore, length(vWorld.xz - shores[i].xy) - shores[i].z);
  }
  vec2 drift = vWorld.xz * 0.045 + vec2(time * 0.05, time * 0.03);
  float ripple = noise(drift) * 0.6 + noise(drift * 2.7) * 0.4;
  float depth = distanceToShore + (ripple - 0.5) * 6.0;

  vec3 color = mix(deepSea, openSea, smoothstep(140.0, 20.0, depth));
  color = mix(color, shallowSea, smoothstep(16.0, 1.0, depth));
  color = mix(color, surf, smoothstep(2.5, 0.0, depth) * 0.8);

  float band = fract(depth / 11.0);
  float contour = smoothstep(0.05, 0.0, min(band, 1.0 - band)) * smoothstep(110.0, 18.0, depth) * step(3.0, depth);
  color += contour * 0.05;
  color += (ripple - 0.5) * 0.025;
  gl_FragColor = vec4(color, 1.0);
}
`;

export function createWater(params: { scene: Scene; extent: number; placements: IslandPlacement[] }): void {
  const { scene, extent, placements } = params;
  const water = MeshBuilder.CreateGround("water", { width: extent * 12, height: extent * 12 }, scene);
  const material = new ShaderMaterial("water-material", scene, "mapWater", {
    attributes: ["position"],
    uniforms: ["world", "worldViewProjection", "shores", "shoreCount", "time", "deepSea", "openSea", "shallowSea", "surf"],
  });
  const shores = new Array<number>(MAX_ISLANDS * 3).fill(0);
  placements.forEach((placement, index) => shores.splice(index * 3, 3, placement.x, placement.z, placement.radius * SHORE_REACH));
  material.setArray3("shores", shores);
  material.setFloat("shoreCount", placements.length);
  material.setColor3("deepSea", MAP_THEME.deepSea);
  material.setColor3("openSea", MAP_THEME.openSea);
  material.setColor3("shallowSea", MAP_THEME.shallowSea);
  material.setColor3("surf", MAP_THEME.surf);
  const startedAt = performance.now();
  material.onBindObservable.add(() => material.getEffect()?.setFloat("time", (performance.now() - startedAt) / 1000));
  water.material = material;
}
