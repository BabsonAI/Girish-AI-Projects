// Minimal Anthropic proxy. Keeps ANTHROPIC_API_KEY server-side.
// The browser calls /api/v1/messages; this forwards to the real API.
import "dotenv/config";
import http from "node:http";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Put it in app/.env");
  process.exit(1);
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url.startsWith("/api/v1/messages")) {
      res.writeHead(404).end("not found");
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": KEY,
            "anthropic-version": "2023-06-01",
          },
          body,
        });
        const text = await upstream.text();
        if (!upstream.ok) console.error("upstream error", upstream.status, text);
        res.writeHead(upstream.status, { "content-type": "application/json" }).end(text);
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({ error: String(e) })
        );
      }
    });
  })
  .listen(8787, () => console.log("proxy on http://localhost:8787"));
