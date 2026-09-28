# Repo Archipelago

Draws a codebase as a map: each repo or module is an island city, and each dependency between them is a bridge. Built with Babylon.js and TypeScript, generated entirely from a small JSON file.

- Island size, building count and skyline grow with the number of source files.
- Bridges carry animated traffic in the direction of the dependency (`from` depends on `to`).
- Linked islands are pulled together; unlinked ones drift to the outskirts.
- Hover an island or bridge for its description, click an island to focus it and list its links, `Esc` to clear.

The bundled example maps [GNU Wget](https://www.gnu.org/software/wget/)'s modules, with bridges taken from the `#include` graph of its `src/` folder.

## Run

```sh
npm install
npm run dev        # dev server
npm run build      # typecheck + static bundle in dist/
```

`dist/` is a static site: host it anywhere. On GitHub, set **Settings → Pages → Source** to **GitHub Actions** and `.github/workflows/pages.yml` publishes every push to `main`.

## Map your own codebase

1. Click **Copy AI prompt** and give it to an AI coding assistant running in your repository (or paste your code into a chat). It replies with the JSON.
2. Click **Paste JSON**, paste the reply (or open a `.json` file) and **Load**. The JSON is validated and any error names the offending field.

Pasted JSON is kept in your browser's local storage only; **Example** switches back to the bundled map. You can also serve a file and open `?data=<url>`.

## Format

```jsonc
{
  "title": "My project archipelago",
  "subtitle": "One line on what islands and bridges mean",
  "seed": 7,                          // layout and city generation are deterministic per seed
  "islandKinds": {
    "service": { "label": "Backend service", "color": "#5db6e5", "glyph": "S" }
  },
  "bridgeKinds": {
    "call": { "label": "HTTP call", "color": "#f0c850" }
  },
  "islands": [
    { "id": "api", "label": "API", "kind": "service", "size": 120,
      "path": "services/api", "description": "Public REST API." }
  ],
  "bridges": [
    { "from": "web", "to": "api", "kind": "call",
      "title": "REST calls", "description": "The web app reads and writes through the API." }
  ]
}
```

- `size`: number of tracked source files; drawn on a log scale.
- `glyph`: the letter shown in the island's map marker.
- Kinds are open: declare any key in `islandKinds` / `bridgeKinds` and reference it.
- 1 to 64 islands. Unknown kinds or ids, duplicate ids and self-links fail loudly at load.

## Code

| File | Role |
| --- | --- |
| `src/architecture.ts` | JSON contract and parser |
| `src/layout.ts` | Stress layout on bridge-graph distances, then shore separation |
| `src/theme.ts` | Map palette and label font |
| `src/island.ts` | Shoreline, beach, land, city pad, street grid, thin-instanced buildings, plaza marker |
| `src/bridge.ts` | Road deck with a route stripe, pillars, animated traffic, hover/dim states |
| `src/water.ts` | Sea shader: depth from shore distance, contour lines, drifting ripples |
| `src/postfx.ts` | Depth outline pass and colour grade (ACES, curves, vignette, bloom, grain, aberration) |
| `src/blips.ts` | Map markers and area labels, selection pulse |
| `src/callout.ts` | Hover callout anchored in the 3D scene |
| `src/world.ts` | Engine, camera, lights, shadows, picking, hover, selection |
| `src/overlay.ts` | Title, legend, details panel |
| `src/dataControls.ts` | Paste / open JSON, copy the AI prompt, back to the example |
| `src/prompt.ts` | The AI analysis prompt |

## License

MIT, see [LICENSE](LICENSE). The GNU Wget example describes a GPL-3.0 project but contains none of its code.
