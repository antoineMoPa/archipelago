import { Camera, ColorCurves, DefaultRenderingPipeline, Effect, ImageProcessingConfiguration, PostProcess, Scene } from "@babylonjs/core";

const GRADE = {
  outlineDepthThreshold: 0.35,
  outlineStrength: 0.55,
  contrast: 1.18,
  exposure: 1.12,
  vignetteWeight: 2.6,
  bloomThreshold: 0.9,
  bloomWeight: 0.12,
  aberrationAmount: 6,
  grainIntensity: 5,
  sharpenEdgeAmount: 0.22,
  curves: {
    shadowsHue: 195,
    shadowsDensity: 28,
    shadowsSaturation: 25,
    highlightsHue: 35,
    highlightsDensity: 14,
    highlightsSaturation: 18,
    globalSaturation: 12,
  },
};

Effect.ShadersStore.mapOutlineFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform vec2 texelSize;
uniform float depthScale;
uniform float threshold;
uniform float strength;

float depthAt(vec2 uv) {
  return texture2D(depthSampler, uv).r * depthScale;
}

void main() {
  vec4 color = texture2D(textureSampler, vUV);
  float center = depthAt(vUV);
  float laplacian = 4.0 * center
    - depthAt(vUV + vec2(texelSize.x, 0.0))
    - depthAt(vUV - vec2(texelSize.x, 0.0))
    - depthAt(vUV + vec2(0.0, texelSize.y))
    - depthAt(vUV - vec2(0.0, texelSize.y));
  float edge = smoothstep(threshold, threshold * 3.0, abs(laplacian));
  gl_FragColor = vec4(mix(color.rgb, color.rgb * 0.25, edge * strength), color.a);
}
`;

function createOutline(scene: Scene, camera: Camera): void {
  const depthMap = scene.enableDepthRenderer(camera, false, true).getDepthMap();
  const outline = new PostProcess("map-outline", "mapOutline", ["texelSize", "depthScale", "threshold", "strength"], ["depthSampler"], 1, camera);
  outline.onApply = (effect) => {
    effect.setTexture("depthSampler", depthMap);
    effect.setFloat2("texelSize", 1 / outline.width, 1 / outline.height);
    effect.setFloat("depthScale", camera.maxZ);
    effect.setFloat("threshold", GRADE.outlineDepthThreshold);
    effect.setFloat("strength", GRADE.outlineStrength);
  };
}

export function createMapGrade(scene: Scene, camera: Camera): void {
  createOutline(scene, camera);

  const pipeline = new DefaultRenderingPipeline("map-grade", true, scene, [camera]);
  pipeline.samples = 4;
  pipeline.fxaaEnabled = true;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = GRADE.bloomThreshold;
  pipeline.bloomWeight = GRADE.bloomWeight;

  pipeline.imageProcessingEnabled = true;
  const processing = pipeline.imageProcessing;
  processing.toneMappingEnabled = true;
  processing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  processing.contrast = GRADE.contrast;
  processing.exposure = GRADE.exposure;
  processing.vignetteEnabled = true;
  processing.vignetteWeight = GRADE.vignetteWeight;
  processing.colorCurvesEnabled = true;
  processing.colorCurves = Object.assign(new ColorCurves(), GRADE.curves);

  pipeline.chromaticAberrationEnabled = true;
  pipeline.chromaticAberration.aberrationAmount = GRADE.aberrationAmount;
  pipeline.chromaticAberration.radialIntensity = 0.8;

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = GRADE.grainIntensity;
  pipeline.grain.animated = true;

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = GRADE.sharpenEdgeAmount;
}
