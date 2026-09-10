import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerTools } from "./ranking.js";
import { store } from "./store.js";

const server = new McpServer({ name: "babson-engage", version: "2.0.0" });

// This replaces the old search-events / list-groups / list-news handlers.
registerTools(server, store, z);

await server.connect(new StdioServerTransport());
