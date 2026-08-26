export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set on the server" });

  // req.body may arrive as an object, a string, or (if parsing was skipped) not
  // at all. Double-encoding a string here is what produces a silent 400 from
  // Anthropic, so normalise to a real object first.
  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: "Body was a string but not valid JSON" });
    }
  }
  if (!payload || typeof payload !== "object") {
    const raw = await new Promise((resolve) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => resolve(b));
    });
    try {
      payload = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "No readable JSON body reached the function" });
    }
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    if (!upstream.ok) console.error("anthropic error", upstream.status, text);
    res.status(upstream.status).setHeader("content-type", "application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
