/**
 * ranking.js — drop-in replacement for the search/sort logic in babson-engage-mcp
 * Node 22, ESM. No dependencies.
 *
 * WHAT THIS FIXES
 *  1. Alphabetical ordering  -> relevance scoring with date proximity tiebreak
 *  2. Silent 3-result cap    -> default 25, caller-controlled, reports totalMatches
 *  3. "AI clubs" misses      -> topic expansion, so Data Analytics Club scores on "AI"
 *  4. Grad-only data         -> source field for belong / engage / uploaded files
 */

/* ----------------------------- topic expansion ---------------------------- */

export const TOPICS = {
  ai: ["ai", "artificial intelligence", "machine learning", "ml", "genai", "llm", "agents",
       "prompt engineering", "data science", "analytics", "robotics", "automation",
       "computer vision", "technology", "tech"],
  finance: ["finance", "financial", "investment", "investing", "banking", "investment banking",
            "ib", "private equity", "pe", "venture capital", "vc", "fintech", "capital markets",
            "trading", "valuation", "modeling", "equity research", "stock pitch",
            "cutler center", "bloomberg", "portfolio", "lbo", "dcf", "real estate", "reit"],
  consulting: ["consulting", "case interview", "casing", "strategy", "mbb", "advisory"],
  entrepreneurship: ["entrepreneurship", "startups", "founders", "pitch", "venture",
                     "launch pad", "family business", "innovation"],
  marketing: ["marketing", "brand", "branding", "digital marketing", "social media",
              "consumer", "retail", "luxury", "advertising"],
  sustainability: ["sustainability", "climate", "esg", "energy", "environment", "cleantech",
                   "impact", "social impact"],
  healthcare: ["healthcare", "health", "biotech", "pharma", "digital health", "medtech",
               "life sciences"],
  cultural: ["cultural", "culture", "identity", "international", "diversity", "latin america",
             "africa", "asia", "gala", "heritage"],
  career: ["career", "recruiting", "internship", "job", "resume", "networking", "interview",
           "opt", "visa"],
  wellness: ["wellness", "mental health", "wellbeing", "destress", "fitness"],
  food: ["free food", "food", "catered", "dinner", "lunch", "breakfast", "pizza", "snacks", "coffee"],
  operations: ["operations", "supply chain", "logistics", "process", "simulation"],
};

const STOP = new Set(
  ("a an the and or of for to in on at is are was were be am i me my we our you your what which " +
   "who show list find any all about give tell there this that some get please do does can could " +
   "would like want need with without more most best top new next upcoming happening going")
    .split(" ")
);

const norm = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9\s&+]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (s) =>
  norm(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t));

export function expandQuery(raw, extraKeywords = []) {
  const phrase = norm(raw);
  const terms = new Map();

  for (const t of new Set([...tokenize(raw), ...extraKeywords.flatMap(tokenize)])) {
    terms.set(t, 1);
  }

  // bigrams: "investment banking" must not be scored as two weak unigrams
  const words = phrase.split(" ");
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    if (Object.values(TOPICS).some((l) => l.includes(bg))) terms.set(bg, 1.4);
  }

  const topics = new Set();
  for (const [topic, list] of Object.entries(TOPICS)) {
    if (list.some((term) => phrase.includes(term))) topics.add(topic);
  }
  for (const topic of topics) {
    for (const term of TOPICS[topic]) if (!terms.has(term)) terms.set(term, 0.55);
  }

  return {
    phrase,
    topics: [...topics],
    terms: [...terms.entries()].map(([t, w]) => ({ t, w })),
  };
}

/* -------------------------------- scoring --------------------------------- */

export function scoreDoc(doc, q, kind) {
  const title = norm(doc.title || doc.name);
  const facets = norm([...(doc.categories || doc.cat || []), ...(doc.tags || [])].join(" "));
  const body = norm(`${doc.description || doc.mission || doc.summary || ""} ${doc.organization || doc.org || ""}`);

  let score = 0;
  let direct = false;   // matched a term the student typed, not one we expanded in
  const why = [];

  if (q.phrase.length > 2 && title.includes(q.phrase)) {
    score += 14;
    direct = true;
    why.push("exact title match");
  }

  for (const { t, w } of q.terms) {
    if (title.includes(t))       { score += 5.5 * w; why.push(`name:${t}`); if (w >= 1) direct = true; }
    else if (facets.includes(t)) { score += 3.4 * w; why.push(`tag:${t}`);  if (w >= 1) direct = true; }
    else if (body.includes(t))   { score += 1.5 * w; why.push(`text:${t}`); }
  }

  if (score === 0) return null;

  if (kind === "event") {
    const days = daysUntil(doc.startsAt);
    score += Math.max(0, 3 - Math.abs(days) / 8);     // sooner wins ties
    if (q.topics.includes("food") && doc.freeFood) { score += 6; why.push("free food"); }
  } else if (kind === "group") {
    score += Math.min(1.5, (doc.memberCount || 0) / 200);  // capped popularity prior
  }

  return { score: Math.round(score * 100) / 100, direct, matchedOn: [...new Set(why)].slice(0, 5) };
}

const daysUntil = (iso) => {
  if (!iso) return 999;
  return Math.round((new Date(iso) - new Date()) / 86400000);
};

/* ------------------------------- the search ------------------------------- */

const DEFAULT_LIMIT = 25;   // was 3. This was the bug.
const MAX_LIMIT = 100;

export function search(docs, query, kind, opts = {}) {
  const {
    keywords = [],
    withinDays = null,
    freeFoodOnly = false,
    sources = null,          // e.g. ["belong","engage"]; null = all
    limit = DEFAULT_LIMIT,
    offset = 0,
  } = opts;

  const q = expandQuery(freeFoodOnly ? `${query} free food` : query, keywords);
  const cap = Math.min(Math.max(1, limit), MAX_LIMIT);

  let pool = docs;
  if (sources?.length) pool = pool.filter((d) => sources.includes(d.source));
  if (kind === "event") {
    pool = pool.filter((d) => daysUntil(d.startsAt) >= 0);
    if (withinDays != null) pool = pool.filter((d) => daysUntil(d.startsAt) <= withinDays);
    if (freeFoodOnly) pool = pool.filter((d) => d.freeFood);
  }

  const scored = pool
    .map((d) => {
      const s = scoreDoc(d, q, kind);
      return s ? { ...d, ...s } : null;
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        Number(b.direct) - Number(a.direct) ||
        b.score - a.score ||
        daysUntil(a.startsAt) - daysUntil(b.startsAt) ||
        (a.title || a.name).localeCompare(b.title || b.name)
    );

  const page = scored.slice(offset, offset + cap);
  const directMatches = scored.filter((d) => d.direct).length;

  return {
    totalMatches: scored.length,
    directMatches,
    relatedMatches: scored.length - directMatches,
    returned: page.length,
    offset,
    hasMore: offset + page.length < scored.length,
    expandedTopics: q.topics,
    results: page,
  };
}

/* --------------------------- MCP tool handlers ---------------------------- */
/*
 * Register these in place of the current search-events / list-groups handlers.
 * The critical part is the text payload: it states totalMatches explicitly and
 * tells the model not to re-sort. Copilot Studio will otherwise re-alphabetize
 * a plain list on its own.
 */

export function registerTools(server, store, z) {
  server.registerTool(
    "search-events",
    {
      title: "Search campus events",
      description:
        "Search Babson events across belong.babson.edu (college-wide), engage.babson.edu " +
        "(graduate), and uploaded feeds. Results are returned ranked by relevance — " +
        "present them in the order given and do not sort alphabetically.",
      inputSchema: {
        query: z.string().describe("What the student asked, verbatim"),
        keywords: z.array(z.string()).optional().describe("Extra topical terms to broaden recall"),
        withinDays: z.number().optional().describe("7 = this week, 3 = weekend, 1 = today"),
        freeFoodOnly: z.boolean().optional(),
        sources: z.array(z.enum(["belong", "engage", "upload"])).optional(),
        limit: z.number().optional().describe("Default 25. Do not pass small values like 3."),
        offset: z.number().optional(),
      },
    },
    async ({ query, ...opts }) => {
      const r = search(await store.events(), query, "event", opts);
      return { content: [{ type: "text", text: renderEvents(r) }] };
    }
  );

  server.registerTool(
    "list-groups",
    {
      title: "Find student clubs and organizations",
      description:
        "Find Babson clubs by topic or interest. Handles loose topics: 'AI clubs' also " +
        "surfaces data, analytics, robotics, and tech orgs. Ranked by relevance — keep the order.",
      inputSchema: {
        query: z.string(),
        keywords: z.array(z.string()).optional(),
        sources: z.array(z.enum(["belong", "engage", "upload"])).optional(),
        limit: z.number().optional().describe("Default 25."),
        offset: z.number().optional(),
      },
    },
    async ({ query, ...opts }) => {
      const r = search(await store.groups(), query, "group", opts);
      return { content: [{ type: "text", text: renderGroups(r) }] };
    }
  );

  server.registerTool(
    "list-news",
    {
      title: "Campus news and announcements",
      description: "News items from belong.babson.edu and uploaded feeds, newest first.",
      inputSchema: {
        query: z.string(),
        limit: z.number().optional(),
      },
    },
    async ({ query, limit }) => {
      const r = search(await store.news(), query, "news", { limit: limit ?? 15 });
      return { content: [{ type: "text", text: renderNews(r) }] };
    }
  );
}

/* ------------------------------- rendering -------------------------------- */

const header = (r, noun) =>
  `${r.directMatches} ${noun}${r.directMatches === 1 ? "" : "s"} matched directly` +
  (r.relatedMatches ? `, plus ${r.relatedMatches} related via topic expansion` : "") +
  `. Showing ${r.returned}` +
  `${r.hasMore ? ` — ${r.totalMatches - r.offset - r.returned} more available, call again with offset=${r.offset + r.returned}` : ""}.` +
  (r.expandedTopics.length ? ` Expanded topics: ${r.expandedTopics.join(", ")}.` : "") +
  `\nORDER IS BY RELEVANCE. Present in this exact order. Do not re-sort alphabetically.` +
  `\nItems marked [related] matched a broader topic, not the student's words. When you state a` +
  ` count, count only the direct matches and mention related ones separately.\n`;

const renderEvents = (r) =>
  !r.totalMatches
    ? "No events matched. Suggest a broader topic rather than guessing."
    : header(r, "event") +
      r.results
        .map((e, i) =>
          `${i + 1}. ${e.title}${e.direct ? "" : " [related]"}\n` +
          `   ${new Date(e.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` +
          ` · ${e.location || "TBD"}\n` +
          `   Host: ${e.organization || "—"}${e.freeFood ? " · FREE FOOD" : ""} · ${e.source}\n` +
          `   ${e.description || ""}`
        )
        .join("\n\n");

const renderGroups = (r) =>
  !r.totalMatches
    ? "No clubs matched. Suggest two adjacent topics that do exist."
    : header(r, "club") +
      r.results
        .map((g, i) =>
          `${i + 1}. ${g.name}${g.direct ? "" : " [related]"} (${(g.categories || []).join(", ")})\n` +
          `   ${g.memberCount || "?"} members · meets ${g.meets || "—"} · ${g.source}\n` +
          `   ${g.mission || ""}`
        )
        .join("\n\n");

const renderNews = (r) =>
  !r.totalMatches
    ? "No news matched."
    : header(r, "item") +
      r.results.map((n, i) => `${i + 1}. ${n.title} (${n.publishedAt?.slice(0, 10)})\n   ${n.summary}`).join("\n\n");
