/**
 * Babson Engage MCP Server — HTTP edition
 *
 * Transport: StreamableHTTPServerTransport (stateless, one per request)
 * This is the correct shape for Azure App Service + Copilot Studio.
 *
 * Environment variables:
 *   PORT                  Azure sets this automatically (default 3000 locally)
 *   BABSON_MCP_API_KEY    Optional. If set, every /mcp request must supply
 *                         the header  x-api-key: <value>. Leave unset to allow
 *                         unauthenticated access (fine on a private VNET or while
 *                         testing — add a key before going to production).
 */

import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { registerTools } from "./ranking.js";
import { store } from "./store.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ── optional API-key guard ─────────────────────────────────────────────── */
const API_KEY = process.env.BABSON_MCP_API_KEY;
const guard = (req, res, next) => {
  if (!API_KEY) return next();                           // no key configured — open
  const supplied = req.headers["x-api-key"] ?? req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (supplied === API_KEY) return next();
  res.status(401).json({ error: "Unauthorized" });
};

/* ── health check (Azure App Service uses this) ─────────────────────────── */
app.get("/health", (_, res) =>
  res.json({ status: "ok", server: "babson-engage-mcp", version: "2.0.0" })
);

/* ── MCP endpoint ───────────────────────────────────────────────────────── */
/*
 * Copilot Studio calls POST /mcp for every turn. We create a fresh McpServer +
 * transport per request (stateless). This avoids all session-management
 * complexity and is correct for Copilot Studio's usage pattern.
 */
app.post("/mcp", guard, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,   // stateless — no session cookies
  });

  const server = new McpServer({ name: "babson-engage", version: "2.0.0" });
  registerTools(server, store, z);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  } finally {
    // Clean up after the response is flushed
    res.on("finish", () => server.close().catch(() => {}));
  }
});

/* ── start ──────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`babson-engage MCP server listening on port ${PORT}`)
);
