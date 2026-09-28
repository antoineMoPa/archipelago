import type { Architecture, Bridge, IslandKindStyle, KindStyle } from "./architecture";

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`index.html is missing #${id}`);
  }
  return element;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, props: { className?: string; text?: string } = {}, children: Node[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text) node.textContent = props.text;
  node.append(...children);
  return node;
}

function routeSwatch(style: KindStyle): HTMLElement {
  const node = element("span", { className: "swatch route" });
  node.style.background = style.color;
  return node;
}

function blipSwatch(style: IslandKindStyle): HTMLElement {
  const node = element("span", { className: "swatch blip", text: style.glyph });
  node.style.background = style.color;
  return node;
}

export function renderTitle(architecture: Architecture): void {
  requireElement("title").replaceChildren(element("h1", { text: architecture.title }), element("p", { text: architecture.subtitle }));
}

export function renderLegend(architecture: Architecture): void {
  const row = (marker: HTMLElement, label: string) => element("div", { className: "legend-row" }, [marker, element("span", { text: label })]);
  requireElement("legend").replaceChildren(
    element("h2", { text: "Islands" }),
    ...Object.values(architecture.islandKinds).map((style) => row(blipSwatch(style), style.label)),
    element("h2", { text: "Routes" }),
    ...Object.values(architecture.bridgeKinds).map((style) => row(routeSwatch(style), style.label)),
  );
}

export function showError(error: unknown): void {
  const panel = requireElement("error");
  panel.textContent = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
  panel.hidden = false;
}

export function renderDetails(params: {
  architecture: Architecture;
  islandId: string | null;
  onSelect: (islandId: string | null) => void;
}): void {
  const { architecture, islandId, onSelect } = params;
  const panel = requireElement("details");
  if (islandId === null) {
    panel.hidden = true;
    return;
  }
  const island = architecture.islands.find((candidate) => candidate.id === islandId)!;
  const labelOf = (id: string) => architecture.islands.find((candidate) => candidate.id === id)!.label;

  const linkList = (bridges: Bridge[], otherEnd: (bridge: Bridge) => string) => {
    if (bridges.length === 0) {
      return element("p", { className: "path", text: "none" });
    }
    return element(
      "ul",
      {},
      bridges.map((bridge) => {
        const target = otherEnd(bridge);
        const button = element("button", { text: labelOf(target) });
        button.addEventListener("click", () => onSelect(target));
        return element("li", {}, [routeSwatch(architecture.bridgeKinds[bridge.kind]!), button, element("span", { className: "via", text: bridge.title })]);
      }),
    );
  };

  const close = element("button", { className: "close", text: "×" });
  close.addEventListener("click", () => onSelect(null));
  const kindStyle = architecture.islandKinds[island.kind]!;
  panel.replaceChildren(
    close,
    element("h2", { text: island.label }),
    element("div", { className: "path", text: island.path }),
    element("div", { className: "legend-row" }, [blipSwatch(kindStyle), element("span", { text: `${kindStyle.label} · size ${island.size}` })]),
    element("p", { text: island.description }),
    element("h3", { text: "Depends on" }),
    linkList(architecture.bridges.filter((bridge) => bridge.from === island.id), (bridge) => bridge.to),
    element("h3", { text: "Used by" }),
    linkList(architecture.bridges.filter((bridge) => bridge.to === island.id), (bridge) => bridge.from),
  );
  panel.hidden = false;
}
