import { parseArchitecture, type Architecture } from "./architecture";
import { setupDataControls } from "./dataControls";
import { renderDetails, renderLegend, renderTitle, showError } from "./overlay";
import { MAP_THEME } from "./theme";
import { createWorld, type World } from "./world";

const EXAMPLE_URL = "examples/wget.json";
const PASTED_JSON_KEY = "repo-archipelago:pasted-json";

async function fetchArchitecture(url: string): Promise<Architecture> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} answered ${response.status} ${response.statusText}`);
  }
  return parseArchitecture(await response.json());
}

function readPastedJson(): string | null {
  try {
    return window.localStorage.getItem(PASTED_JSON_KEY);
  } catch {
    return null;
  }
}

function writePastedJson(json: string | null): void {
  try {
    if (json === null) {
      window.localStorage.removeItem(PASTED_JSON_KEY);
    } else {
      window.localStorage.setItem(PASTED_JSON_KEY, json);
    }
  } catch {
    return;
  }
}

let world: World | null = null;
let select: (islandId: string | null) => void = () => {};

function show(architecture: Architecture): void {
  world?.dispose();
  const canvas = document.createElement("canvas");
  canvas.id = "scene";
  document.getElementById("scene")!.replaceWith(canvas);

  document.title = architecture.title;
  renderTitle(architecture);
  renderLegend(architecture);
  const current = createWorld(canvas, architecture);
  select = (islandId) => {
    current.select(islandId);
    renderDetails({ architecture, islandId, onSelect: select });
  };
  current.onIslandPicked(select);
  select(null);
  world = current;
}

async function start() {
  await Promise.all([document.fonts.load(`italic 700 16px "${MAP_THEME.labelFont}"`), document.fonts.load(`700 16px "${MAP_THEME.labelFont}"`)]);
  const showExample = async () => {
    writePastedJson(null);
    show(await fetchArchitecture(EXAMPLE_URL));
  };
  const controls = setupDataControls({
    onLoadPasted: (architecture, json) => {
      writePastedJson(json);
      show(architecture);
    },
    onShowExample: () => showExample().catch(showError),
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") select(null);
  });

  const dataUrl = new URLSearchParams(window.location.search).get("data");
  if (dataUrl !== null) {
    show(await fetchArchitecture(dataUrl));
    return;
  }
  const pastedJson = readPastedJson();
  if (pastedJson === null) {
    await showExample();
    return;
  }
  try {
    show(parseArchitecture(JSON.parse(pastedJson)));
  } catch (error) {
    await showExample();
    controls.reopenWithError(pastedJson, `Your saved JSON no longer loads: ${error instanceof Error ? error.message : String(error)}`);
  }
}

start().catch(showError);
