# Babson Engage Assistant — implementation guide

Two independent pieces. You can run either one without the other.

```
babson/
├── app/                     React demo UI (engage-assistant-v2.jsx, runnable locally)
│   ├── src/EngageAssistant.jsx   <- your file, one line changed (see "Patch" below)
│   ├── src/main.jsx
│   ├── proxy.js             keeps your API key off the browser
│   ├── vite.config.js
│   ├── index.html
│   └── .env.example
└── mcp/                     the real fix for the MCP server
    ├── ranking.js           <- your file, unchanged
    ├── server.js            registers ranking.js tools
    ├── store.js             point this at your real feeds
    └── data/*.json          empty placeholders
```

## A. Run the React app locally

```bash
cd app
cp .env.example .env        # paste your Anthropic API key into .env
npm install
npm run dev                 # http://localhost:5173
```

**Patch already applied:** inside a Claude artifact the app can call
`https://api.anthropic.com/v1/messages` with no key. Outside one, that request is
rejected (no key, CORS). So `callClaude` now points at `API_URL`, which defaults to
`/api/v1/messages` — Vite proxies that to `proxy.js`, which adds
`x-api-key` and `anthropic-version` server-side. Never ship the key to the browser.

To deploy: `npm run build` gives you `dist/`. Host `dist/` anywhere, and host
`proxy.js` (or an equivalent serverless function) at the same origin under `/api`.

The corpus in `EngageAssistant.jsx` (CLUBS / EVENTS / NEWS) is sample data. Replace
those three arrays with real records, or delete `retrieve()` and have `callClaude`
hit the MCP server instead.

## B. Wire ranking.js into the MCP server

```bash
cd mcp
npm install
node server.js              # speaks MCP over stdio
```

Then in your existing `babson-engage-mcp` repo:

1. Drop `ranking.js` in next to your server entry file.
2. Delete the old `search-events`, `list-groups`, `list-news` handlers.
3. Add `registerTools(server, store, z)` where those handlers used to be —
   `store` needs `events()`, `groups()`, `news()` returning arrays (see `store.js`).
4. Make sure every record has a `source` field of `belong` | `engage` | `upload`,
   and events use `startsAt` as an ISO date string.

Field names `ranking.js` reads: `title`/`name`, `description`/`mission`/`summary`,
`categories`/`cat`, `tags`, `organization`/`org`, `startsAt`, `freeFood`,
`memberCount`, `meets`, `source`, `publishedAt`.

### Register with a client

Claude Desktop — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "babson-engage": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.js"]
    }
  }
}
```

Copilot Studio re-alphabetizes plain lists on its own, which is why the tool
descriptions and the rendered header both say the order is relevance-ranked.
Keep that wording if you rewrite them.

## What changed vs. the old behavior

| Old | New |
| --- | --- |
| Alphabetical | Relevance score, date proximity as tiebreak |
| Silent 3-result cap | Default 25, caller-controlled, `totalMatches` reported |
| "AI clubs" missed analytics/robotics orgs | Topic expansion in `TOPICS` |
| Grad data only | `source` field spans belong / engage / uploads |
