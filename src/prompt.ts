import { MAX_ISLANDS } from "./architecture";

export const ANALYSIS_PROMPT = `Analyse this codebase and describe its architecture as JSON for Repo Archipelago, a 3D map where each island is a repo or top-level module and each bridge is a dependency between two of them.

Reply with only the JSON, in this shape:

{
  "title": "<Project> archipelago",
  "subtitle": "<one line on what the islands and bridges represent>",
  "seed": 7,
  "islandKinds": {
    "<kind>": { "label": "<legend label>", "color": "#rrggbb", "glyph": "<one letter>" }
  },
  "bridgeKinds": {
    "<kind>": { "label": "<legend label>", "color": "#rrggbb" }
  },
  "islands": [
    { "id": "<unique id>", "label": "<short name>", "kind": "<islandKinds key>", "size": <number of source files>,
      "path": "<folder or files>", "description": "<one or two sentences on its responsibility>" }
  ],
  "bridges": [
    { "from": "<island id>", "to": "<island id>", "kind": "<bridgeKinds key>",
      "title": "<short name of the link>", "description": "<one sentence on what flows across it>" }
  ]
}

Rules:
- 5 to ${MAX_ISLANDS} islands. Group small folders; include important external services or libraries as islands when they matter.
- "from" depends on "to" (calls it, imports it, reads its data).
- Base bridges on real evidence: imports, HTTP clients, env vars naming other services, docker-compose links, package manifests.
- "size" is the count of tracked source files (for example \`git ls-files <path> | wc -l\` restricted to source extensions).
- Every "kind" used must be declared in islandKinds or bridgeKinds; ids must be unique; no bridge from an island to itself.
- Use 4 to 8 island kinds and 2 to 5 bridge kinds with clearly distinct, saturated colors.`;
