import type { TransformNode } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse, Line, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { MAP_THEME } from "./theme";

export type CalloutContent = {
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
};

export type Callout = {
  show: (anchor: TransformNode, content: CalloutContent) => void;
  hide: () => void;
};

const CARD = {
  width: 320,
  padding: 14,
  liftAboveAnchor: 56,
  background: "rgba(8, 10, 13, 0.92)",
  text: "#f2f2f2",
  muted: "#a7adb3",
};

function createText(params: { name: string; fontSize: number; color: string; fontFamily: string; fontWeight: string; fontStyle?: string }): TextBlock {
  const text = new TextBlock(params.name);
  text.fontSize = params.fontSize;
  text.color = params.color;
  text.fontFamily = params.fontFamily;
  text.fontWeight = params.fontWeight;
  text.fontStyle = params.fontStyle ?? "normal";
  text.textWrapping = true;
  text.resizeToFit = true;
  text.width = `${CARD.width - CARD.padding * 2}px`;
  text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  return text;
}

export function createCallout(gui: AdvancedDynamicTexture): Callout {
  const leader = new Line("callout-leader");
  leader.lineWidth = 2;
  leader.isPointerBlocker = false;
  const dot = new Ellipse("callout-dot");
  dot.width = "12px";
  dot.height = "12px";
  dot.thickness = 2;
  dot.color = CARD.text;
  dot.isPointerBlocker = false;

  const card = new Rectangle("callout-card");
  card.width = `${CARD.width}px`;
  card.adaptHeightToChildren = true;
  card.cornerRadius = 0;
  card.thickness = 0;
  card.background = CARD.background;
  card.isPointerBlocker = false;
  card.shadowBlur = 18;
  card.shadowColor = "rgba(0, 0, 0, 0.5)";

  const stack = new StackPanel("callout-stack");
  stack.paddingBottom = `${CARD.padding}px`;
  stack.spacing = 4;
  const accentBar = new Rectangle("callout-accent");
  accentBar.height = "4px";
  accentBar.thickness = 0;
  const title = createText({ name: "callout-title", fontSize: 22, color: CARD.text, fontFamily: MAP_THEME.labelFont, fontWeight: "700", fontStyle: "italic" });
  title.paddingTop = `${CARD.padding - 4}px`;
  const subtitle = createText({ name: "callout-subtitle", fontSize: 13, color: CARD.muted, fontFamily: MAP_THEME.labelFont, fontWeight: "600" });
  const description = createText({ name: "callout-description", fontSize: 13, color: CARD.text, fontFamily: "Barlow", fontWeight: "400" });
  stack.addControl(accentBar);
  stack.addControl(title);
  stack.addControl(subtitle);
  stack.addControl(description);
  card.addControl(stack);

  leader.zIndex = -1;
  dot.zIndex = -1;
  card.zIndex = 10;
  gui.addControl(leader);
  gui.addControl(dot);
  gui.addControl(card);
  leader.connectedControl = card;

  let anchored: TransformNode | null = null;
  const setVisible = (visible: boolean) => [leader, dot, card].forEach((control) => (control.isVisible = visible));
  setVisible(false);

  card.onAfterDrawObservable.add(() => {
    const lift = -(card.heightInPixels / 2 + CARD.liftAboveAnchor);
    if (card.linkOffsetYInPixels !== lift) {
      card.linkOffsetYInPixels = lift;
    }
  });

  return {
    show: (anchor, content) => {
      title.text = content.title.toUpperCase();
      subtitle.text = content.subtitle.toUpperCase();
      description.text = content.description;
      accentBar.background = content.accentColor;
      leader.color = content.accentColor;
      dot.background = content.accentColor;
      if (anchored !== anchor) {
        anchored = anchor;
        card.linkWithMesh(anchor);
        leader.linkWithMesh(anchor);
        dot.linkWithMesh(anchor);
      }
      setVisible(true);
    },
    hide: () => {
      setVisible(false);
    },
  };
}
