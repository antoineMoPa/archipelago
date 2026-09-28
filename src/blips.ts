import { AdvancedDynamicTexture, Ellipse, TextBlock } from "@babylonjs/gui";
import type { Architecture } from "./architecture";
import type { IslandView } from "./island";
import { MAP_THEME } from "./theme";

const BLIP = {
  diameter: 26,
  selectedScale: 1.35,
  pulseDiameter: 44,
  pulseSeconds: 1.4,
  labelGap: 26,
  labelBaseSize: 13,
  labelSizePerDecade: 2,
};

export type Blips = {
  setSelected: (islandId: string | null) => void;
  setLabelVisible: (islandId: string, visible: boolean) => void;
  animate: (seconds: number) => void;
};

function createGlyph(name: string, glyph: string): TextBlock {
  const text = new TextBlock(name, glyph);
  text.color = MAP_THEME.labelText;
  text.fontFamily = MAP_THEME.labelFont;
  text.fontWeight = "700";
  text.fontSize = 15;
  text.outlineWidth = 3;
  text.outlineColor = MAP_THEME.labelOutline;
  return text;
}

function createAreaLabel(name: string, label: string, size: number): TextBlock {
  const text = new TextBlock(name, label.toUpperCase());
  text.color = MAP_THEME.labelText;
  text.fontFamily = MAP_THEME.labelFont;
  text.fontWeight = "700";
  text.fontStyle = "italic";
  text.fontSize = BLIP.labelBaseSize + Math.log10(size + 1) * BLIP.labelSizePerDecade;
  text.outlineWidth = 4;
  text.outlineColor = MAP_THEME.labelOutline;
  text.resizeToFit = true;
  text.isPointerBlocker = false;
  return text;
}

export function createBlips(params: { gui: AdvancedDynamicTexture; architecture: Architecture; islandViews: Map<string, IslandView> }): Blips {
  const { gui, architecture, islandViews } = params;

  const pulse = new Ellipse("selection-pulse");
  pulse.width = `${BLIP.pulseDiameter}px`;
  pulse.height = `${BLIP.pulseDiameter}px`;
  pulse.thickness = 3;
  pulse.color = MAP_THEME.labelText;
  pulse.isPointerBlocker = false;
  pulse.isVisible = false;
  gui.addControl(pulse);

  const blips = new Map<string, Ellipse>();
  const labels = new Map<string, TextBlock>();
  for (const view of islandViews.values()) {
    const { island } = view;
    const kindStyle = architecture.islandKinds[island.kind]!;

    const label = createAreaLabel(`${island.id}-area-label`, island.label, island.size);
    gui.addControl(label);
    label.linkWithMesh(view.labelAnchor);
    label.linkOffsetY = BLIP.labelGap;
    labels.set(island.id, label);

    const blip = new Ellipse(`${island.id}-blip`);
    blip.width = `${BLIP.diameter}px`;
    blip.height = `${BLIP.diameter}px`;
    blip.thickness = 2;
    blip.color = MAP_THEME.labelText;
    blip.background = kindStyle.color;
    blip.shadowBlur = 8;
    blip.shadowColor = "rgba(0, 0, 0, 0.6)";
    blip.isPointerBlocker = false;
    blip.addControl(createGlyph(`${island.id}-blip-glyph`, kindStyle.glyph));
    gui.addControl(blip);
    blip.linkWithMesh(view.labelAnchor);
    blips.set(island.id, blip);
  }

  let selectedId: string | null = null;
  return {
    setSelected: (islandId) => {
      blips.forEach((blip, id) => {
        const scale = id === islandId ? BLIP.selectedScale : 1;
        blip.scaleX = scale;
        blip.scaleY = scale;
      });
      selectedId = islandId;
      pulse.isVisible = islandId !== null;
      if (islandId !== null) {
        pulse.linkWithMesh(islandViews.get(islandId)!.labelAnchor);
      }
    },
    setLabelVisible: (islandId, visible) => {
      labels.get(islandId)!.isVisible = visible;
    },
    animate: (seconds) => {
      if (selectedId === null) return;
      const phase = (seconds % BLIP.pulseSeconds) / BLIP.pulseSeconds;
      pulse.scaleX = 0.8 + phase * 0.8;
      pulse.scaleY = pulse.scaleX;
      pulse.alpha = 1 - phase;
    },
  };
}
