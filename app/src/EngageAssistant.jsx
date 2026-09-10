import React, { useState, useRef, useEffect, useMemo } from "react";

/* ============================================================================
   BABSON ENGAGE ASSISTANT — v2 (rebuilt)
   Fixes: relevance ranking (not A–Z), no 3-result cap, multi-source data,
   synonym expansion so "AI clubs" finds tech/analytics orgs.
   Data below is SAMPLE data shaped like the real feed. Swap in Larry's files
   via the loader in the Sources panel, or point RETRIEVAL at the MCP server.
   ========================================================================= */

const TODAY = new Date();
const dateFrom = (off) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + off);
  return d;
};
const fmtDate = (off) =>
  dateFrom(off).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/* ---------------------------- SAMPLE CORPUS ------------------------------ */

const CLUBS = [
  { id: "c1", name: "Graduate Finance Association", cat: ["Finance", "Professional"], tags: ["investment banking", "private equity", "valuation", "capital markets"], mission: "Prepares graduate students for careers in investment banking, private equity, and asset management through treks, stock pitches, and alumni panels.", members: 214, source: "engage", meets: "Tuesdays, 6:00 PM" },
  { id: "c2", name: "Babson Investment Management Association", cat: ["Finance"], tags: ["portfolio", "equity research", "trading", "cutler center"], mission: "Student-run portfolio managing real capital out of the Cutler Center. Weekly stock pitches and equity research training.", members: 168, source: "belong", meets: "Wednesdays, 5:30 PM" },
  { id: "c3", name: "FinTech Club", cat: ["Finance", "Technology"], tags: ["fintech", "payments", "blockchain", "crypto", "ai"], mission: "Explores the intersection of financial services and emerging technology, including AI-driven underwriting, payments infrastructure, and digital assets.", members: 132, source: "engage", meets: "Alternating Thursdays" },
  { id: "c4", name: "Babson AI Society", cat: ["Technology"], tags: ["ai", "artificial intelligence", "machine learning", "llm", "genai", "prompt engineering"], mission: "Hands-on workshops on large language models, agent building, and applied machine learning for business students. Runs the semester AI Build Night.", members: 189, source: "belong", meets: "Mondays, 7:00 PM" },
  { id: "c5", name: "Data Analytics Club", cat: ["Technology", "Professional"], tags: ["data science", "analytics", "python", "sql", "machine learning", "visualization"], mission: "Builds practical data fluency through Python and SQL bootcamps, Tableau labs, and applied machine learning case competitions.", members: 156, source: "belong", meets: "Thursdays, 6:00 PM" },
  { id: "c6", name: "Tech & Innovation Club", cat: ["Technology"], tags: ["product management", "software", "ai", "startups", "innovation"], mission: "Connects students to product management and technology careers. Hosts AI product teardowns and recruiting prep for tech firms.", members: 203, source: "engage", meets: "Tuesdays, 7:00 PM" },
  { id: "c7", name: "Babson Consulting Club", cat: ["Consulting", "Professional"], tags: ["case interview", "strategy", "mbb", "recruiting"], mission: "Case interview preparation, casing circles, and firm-specific recruiting support for consulting careers.", members: 241, source: "engage", meets: "Wednesdays, 6:30 PM" },
  { id: "c8", name: "Entrepreneurship Club", cat: ["Entrepreneurship"], tags: ["startups", "venture", "founders", "pitch", "butler launch pad"], mission: "The founders' community at Babson. Pitch nights, co-founder matching, and office hours with Butler Launch Pad mentors.", members: 312, source: "belong", meets: "Mondays, 6:00 PM" },
  { id: "c9", name: "Venture Capital & Private Equity Club", cat: ["Finance", "Entrepreneurship"], tags: ["vc", "private equity", "venture capital", "deal sourcing", "term sheets"], mission: "Demystifies careers in VC and PE through deal breakdowns, term sheet workshops, and investor speaker series.", members: 147, source: "engage", meets: "Thursdays, 5:00 PM" },
  { id: "c10", name: "Babson Marketing Club", cat: ["Marketing", "Professional"], tags: ["brand", "digital marketing", "social media", "consumer"], mission: "Brand strategy workshops, agency site visits, and a spring consumer marketing case competition.", members: 178, source: "belong", meets: "Tuesdays, 5:30 PM" },
  { id: "c11", name: "Real Estate Club", cat: ["Finance", "Real Estate"], tags: ["real estate", "development", "reit", "property"], mission: "Real estate finance and development careers, with property tours across Greater Boston and an annual REIT modeling workshop.", members: 96, source: "engage", meets: "Alternating Wednesdays" },
  { id: "c12", name: "Healthcare Business Club", cat: ["Healthcare", "Professional"], tags: ["biotech", "pharma", "digital health", "medtech"], mission: "Careers in biotech, pharma, and digital health, with a focus on the Boston/Cambridge life sciences corridor.", members: 118, source: "engage", meets: "Wednesdays, 6:00 PM" },
  { id: "c13", name: "Energy & Environment Club", cat: ["Sustainability"], tags: ["climate", "energy", "esg", "sustainability", "cleantech"], mission: "Climate tech, ESG investing, and sustainable operations. Partners with Net Impact on the annual sustainability summit.", members: 104, source: "belong", meets: "Thursdays, 5:30 PM" },
  { id: "c14", name: "Net Impact", cat: ["Sustainability", "Social Impact"], tags: ["social impact", "esg", "nonprofit", "impact investing"], mission: "Business as a force for social and environmental good. Runs impact consulting projects with local nonprofits.", members: 89, source: "belong", meets: "Mondays, 5:00 PM" },
  { id: "c15", name: "Women in Business", cat: ["Identity", "Professional"], tags: ["women", "leadership", "mentorship", "networking"], mission: "Leadership development, mentorship circles, and an annual conference supporting women across the Babson community.", members: 267, source: "belong", meets: "Tuesdays, 6:30 PM" },
  { id: "c16", name: "Graduate Women in Finance", cat: ["Finance", "Identity"], tags: ["women", "finance", "mentorship", "banking"], mission: "Supports women pursuing finance careers through mentorship pairings, technical prep, and recruiting navigation.", members: 73, source: "engage", meets: "Alternating Mondays" },
  { id: "c17", name: "Latin American Business Association", cat: ["Identity", "Cultural"], tags: ["latin america", "cultural", "spanish", "portuguese", "networking"], mission: "Celebrates Latin American culture and builds professional bridges between Babson and Latin American markets.", members: 154, source: "belong", meets: "Fridays, 5:00 PM" },
  { id: "c18", name: "Africa Business Club", cat: ["Identity", "Cultural"], tags: ["africa", "cultural", "emerging markets", "networking"], mission: "Showcases business opportunity across the African continent through the annual Africa Business Forum.", members: 87, source: "belong", meets: "Alternating Fridays" },
  { id: "c19", name: "Asia Business Club", cat: ["Identity", "Cultural"], tags: ["asia", "cultural", "emerging markets", "lunar new year"], mission: "Connects students to Asian markets and culture, including the Lunar New Year gala and APAC career panels.", members: 198, source: "belong", meets: "Thursdays, 6:00 PM" },
  { id: "c20", name: "Graduate Student Council", cat: ["Governance"], tags: ["student government", "advocacy", "events"], mission: "The elected voice of graduate students. Allocates club funding and runs all-school social programming.", members: 42, source: "engage", meets: "Mondays, 7:00 PM" },
  { id: "c21", name: "Babson Analytics & Operations Club", cat: ["Technology", "Professional"], tags: ["operations", "supply chain", "analytics", "process"], mission: "Operations strategy, supply chain analytics, and process improvement with plant tours and simulation workshops.", members: 68, source: "engage", meets: "Alternating Tuesdays" },
  { id: "c22", name: "Product Management Club", cat: ["Technology", "Professional"], tags: ["product", "ux", "ai", "roadmap", "tech recruiting"], mission: "Breaking into product management, including AI product strategy sessions and PM interview loops.", members: 121, source: "engage", meets: "Wednesdays, 7:00 PM" },
  { id: "c23", name: "Retail & Luxury Goods Club", cat: ["Marketing"], tags: ["retail", "luxury", "consumer", "merchandising"], mission: "Careers in retail, luxury, and consumer goods with NYC brand treks each fall.", members: 64, source: "engage", meets: "Alternating Thursdays" },
  { id: "c24", name: "Family Enterprise Club", cat: ["Entrepreneurship"], tags: ["family business", "succession", "governance"], mission: "For students entering or leading family enterprises. Succession planning workshops and next-gen peer groups.", members: 79, source: "belong", meets: "Fridays, 12:00 PM" },
  { id: "c25", name: "Babson Sports Business Club", cat: ["Professional"], tags: ["sports", "analytics", "media", "sponsorship"], mission: "Sports business careers across leagues, agencies, and analytics, with Boston franchise front-office visits.", members: 133, source: "belong", meets: "Tuesdays, 8:00 PM" },
  { id: "c26", name: "Graduate International Student Association", cat: ["Identity", "Cultural"], tags: ["international", "visa", "opt", "community"], mission: "Community and practical support for international graduate students, including OPT and visa navigation sessions.", members: 226, source: "engage", meets: "Alternating Wednesdays" },
  { id: "c27", name: "Babson Robotics & Automation Club", cat: ["Technology"], tags: ["robotics", "automation", "hardware", "ai", "machine learning"], mission: "Hands-on robotics builds and automation applications for business, including computer vision and ML-driven control.", members: 51, source: "belong", meets: "Saturdays, 1:00 PM" },
  { id: "c28", name: "Real Talk Mental Health Collective", cat: ["Wellness"], tags: ["wellness", "mental health", "peer support"], mission: "Peer-led conversations and wellness programming that reduce stigma around mental health on campus.", members: 92, source: "belong", meets: "Alternating Mondays" },
];

const EVENTS = [
  { id: "e1", title: "Investment Banking Recruiting Kickoff", org: "Graduate Finance Association", cat: ["Finance", "Career"], tags: ["investment banking", "recruiting", "networking"], off: 2, time: "6:00 PM", loc: "Olin Hall 220", food: true, source: "engage", desc: "Timeline, resume standards, and networking expectations for fall IB recruiting. Alumni from three bulge bracket banks attend." },
  { id: "e2", title: "Equity Research Stock Pitch Night", org: "Babson Investment Management Association", cat: ["Finance"], tags: ["equity research", "stock pitch", "valuation"], off: 4, time: "5:30 PM", loc: "Cutler Center", food: true, source: "belong", desc: "Four student teams pitch long positions to a panel of practicing analysts. Open to all skill levels." },
  { id: "e3", title: "Private Equity Deal Breakdown", org: "Venture Capital & Private Equity Club", cat: ["Finance"], tags: ["private equity", "lbo", "deals"], off: 6, time: "5:00 PM", loc: "Weissman Foundry", food: false, source: "engage", desc: "Walk through a recent middle-market LBO with the deal team that executed it." },
  { id: "e4", title: "Financial Modeling Bootcamp (Session 1 of 3)", org: "Graduate Finance Association", cat: ["Finance", "Workshop"], tags: ["modeling", "excel", "valuation", "dcf"], off: 7, time: "9:00 AM", loc: "Malloy 201", food: true, source: "engage", desc: "Three-part Excel intensive covering three-statement models, DCF, and comps. Laptop required." },
  { id: "e5", title: "Women in Finance Mentorship Mixer", org: "Graduate Women in Finance", cat: ["Finance", "Networking"], tags: ["women", "mentorship", "networking"], off: 9, time: "6:30 PM", loc: "Reynolds Campus Center", food: true, source: "engage", desc: "Structured mentor matching with alumnae across banking, asset management, and corporate finance." },
  { id: "e6", title: "FinTech & AI in Credit Underwriting", org: "FinTech Club", cat: ["Finance", "Technology"], tags: ["fintech", "ai", "machine learning", "credit"], off: 11, time: "6:00 PM", loc: "Olin Hall 105", food: false, source: "engage", desc: "How lenders are deploying machine learning models in underwriting, and where regulators are pushing back." },
  { id: "e7", title: "Real Estate Capital Markets Panel", org: "Real Estate Club", cat: ["Finance", "Real Estate"], tags: ["real estate", "capital markets", "reit"], off: 13, time: "5:30 PM", loc: "Olin Hall 310", food: true, source: "engage", desc: "Debt and equity sourcing in a higher-rate environment, with developers and REIT analysts." },
  { id: "e8", title: "Cutler Center Trading Floor Open House", org: "Babson Investment Management Association", cat: ["Finance", "Workshop"], tags: ["bloomberg", "trading", "terminal"], off: 16, time: "12:00 PM", loc: "Cutler Center", food: true, source: "belong", desc: "Drop-in Bloomberg terminal training and certification signup." },
  { id: "e9", title: "Personal Finance for Grad Students", org: "Graduate Student Council", cat: ["Finance", "Wellness"], tags: ["personal finance", "loans", "budgeting"], off: 18, time: "12:30 PM", loc: "Reynolds 108", food: true, source: "engage", desc: "Loan repayment, budgeting on a stipend, and negotiating your first post-MBA offer." },
  { id: "e10", title: "AI Build Night: Ship an Agent in 3 Hours", org: "Babson AI Society", cat: ["Technology", "Workshop"], tags: ["ai", "agents", "llm", "hackathon", "genai"], off: 3, time: "7:00 PM", loc: "Weissman Foundry", food: true, source: "belong", desc: "Bring a laptop and leave with a working AI agent. Mentors from the AI Fellowship on hand. No coding background required." },
  { id: "e11", title: "Machine Learning for Business Case Workshop", org: "Data Analytics Club", cat: ["Technology", "Workshop"], tags: ["machine learning", "python", "analytics", "ai"], off: 5, time: "6:00 PM", loc: "Malloy 105", food: false, source: "belong", desc: "Applied ML on a real retail dataset. Python basics helpful but not required." },
  { id: "12", title: "AI Product Teardown: What Shipped This Quarter", org: "Product Management Club", cat: ["Technology"], tags: ["product", "ai", "teardown"], off: 8, time: "7:00 PM", loc: "Olin Hall 118", food: false, source: "engage", desc: "PMs from three AI-native startups break down recent launches and the decisions behind them." },
  { id: "e13", title: "Prompt Engineering Clinic", org: "Babson AI Society", cat: ["Technology", "Workshop"], tags: ["ai", "prompt engineering", "llm", "genai"], off: 12, time: "5:00 PM", loc: "Horn Library 2nd Floor", food: false, source: "belong", desc: "Bring a workflow you want to automate. Leave with prompts that work." },
  { id: "e14", title: "Consulting Case Interview Bootcamp", org: "Babson Consulting Club", cat: ["Consulting", "Career"], tags: ["case interview", "recruiting", "mbb"], off: 5, time: "9:00 AM", loc: "Olin Hall 220", food: true, source: "engage", desc: "Full-day casing intensive with partner-level interviewers and live feedback." },
  { id: "e15", title: "Founders' Pitch Night", org: "Entrepreneurship Club", cat: ["Entrepreneurship"], tags: ["pitch", "startups", "venture"], off: 10, time: "6:00 PM", loc: "Butler Launch Pad", food: true, source: "belong", desc: "Eight student ventures pitch to a panel of angel investors. Audience vote decides the microgrant." },
  { id: "e16", title: "Climate Tech Career Panel", org: "Energy & Environment Club", cat: ["Sustainability", "Career"], tags: ["climate", "cleantech", "esg"], off: 14, time: "5:30 PM", loc: "Olin Hall 105", food: false, source: "belong", desc: "Operators and investors on where climate tech hiring is actually growing." },
  { id: "e17", title: "Lunar New Year Gala", org: "Asia Business Club", cat: ["Cultural", "Social"], tags: ["cultural", "gala", "celebration"], off: 15, time: "7:00 PM", loc: "Knight Auditorium", food: true, source: "belong", desc: "Performances, catered dinner, and the annual red envelope raffle. Tickets required." },
  { id: "e18", title: "Africa Business Forum", org: "Africa Business Club", cat: ["Cultural", "Professional"], tags: ["africa", "emerging markets", "forum"], off: 20, time: "10:00 AM", loc: "Reynolds Campus Center", food: true, source: "belong", desc: "Full-day forum on investment and entrepreneurship across African markets." },
  { id: "e19", title: "Brand Strategy Workshop with a Boston Agency", org: "Babson Marketing Club", cat: ["Marketing", "Workshop"], tags: ["brand", "strategy", "agency"], off: 9, time: "5:30 PM", loc: "Olin Hall 118", food: false, source: "belong", desc: "Live brand positioning exercise run by a strategy director." },
  { id: "e20", title: "Digital Health Startup Showcase", org: "Healthcare Business Club", cat: ["Healthcare"], tags: ["digital health", "biotech", "startups"], off: 17, time: "6:00 PM", loc: "Weissman Foundry", food: true, source: "engage", desc: "Six Boston-area digital health founders demo and take questions." },
  { id: "e21", title: "OPT & Visa Navigation Session", org: "Graduate International Student Association", cat: ["Career"], tags: ["international", "opt", "visa"], off: 6, time: "12:00 PM", loc: "Reynolds 108", food: true, source: "engage", desc: "ISSS advisors walk through OPT timelines and common filing mistakes." },
  { id: "e22", title: "Wellness Week: Therapy Dogs & Free Coffee", org: "Real Talk Mental Health Collective", cat: ["Wellness", "Social"], tags: ["wellness", "destress", "free food"], off: 1, time: "11:00 AM", loc: "Horn Library Lobby", food: true, source: "belong", desc: "Drop in between classes. Therapy dogs, espresso bar, and stress kits." },
  { id: "e23", title: "Supply Chain Simulation Challenge", org: "Babson Analytics & Operations Club", cat: ["Professional", "Workshop"], tags: ["operations", "supply chain", "simulation"], off: 19, time: "5:00 PM", loc: "Malloy 201", food: false, source: "engage", desc: "Team-based operations simulation with a prize for the lowest total landed cost." },
  { id: "e24", title: "Robotics Open Build", org: "Babson Robotics & Automation Club", cat: ["Technology"], tags: ["robotics", "automation", "hardware", "ai"], off: 4, time: "1:00 PM", loc: "Weissman Foundry", food: false, source: "belong", desc: "Open lab session. Computer vision demo running on the new arm." },
];

const NEWS = [
  { id: "n1", title: "Club funding applications open for the fall cycle", off: -2, tags: ["funding", "clubs", "student government"], summary: "Graduate Student Council opened the fall allocation cycle. Budget requests are due in three weeks.", source: "belong" },
  { id: "n2", title: "AI Fellowship announces spring project cohort", off: -5, tags: ["ai", "fellowship", "technology"], summary: "The AI Fellowship named its next cohort of student-built agent projects, including tools for campus engagement and course planning.", source: "belong" },
  { id: "n3", title: "Cutler Center adds new Bloomberg terminals", off: -9, tags: ["finance", "cutler center", "bloomberg"], summary: "Six additional terminals are live, and certification sessions now run twice weekly.", source: "belong" },
  { id: "n4", title: "Club fair moves to the Reynolds quad", off: -1, tags: ["clubs", "events", "fair"], summary: "This term's involvement fair relocates outdoors, with more than sixty organizations tabling.", source: "belong" },
];

/* ------------------------- SYNONYM / TOPIC MAP --------------------------- */
/* This is the fix for "ask for AI clubs, get alphabetical junk": a club named
   "Data Analytics Club" contains no literal "AI", so keyword-only match fails
   and the old server fell back to name order. */

const TOPICS = {
  ai: ["ai", "artificial intelligence", "machine learning", "ml", "genai", "llm", "agents", "prompt engineering", "data science", "analytics", "robotics", "automation", "computer vision", "technology", "tech"],
  finance: ["finance", "financial", "investment", "investing", "banking", "investment banking", "ib", "private equity", "pe", "venture capital", "vc", "fintech", "capital markets", "trading", "valuation", "modeling", "equity research", "stock pitch", "cutler center", "bloomberg", "portfolio", "lbo", "dcf", "real estate", "reit"],
  consulting: ["consulting", "case interview", "casing", "strategy", "mbb", "advisory"],
  entrepreneurship: ["entrepreneurship", "startups", "founders", "pitch", "venture", "launch pad", "family business", "innovation"],
  marketing: ["marketing", "brand", "branding", "digital marketing", "social media", "consumer", "retail", "luxury", "advertising"],
  sustainability: ["sustainability", "climate", "esg", "energy", "environment", "cleantech", "impact", "social impact"],
  healthcare: ["healthcare", "health", "biotech", "pharma", "digital health", "medtech", "life sciences"],
  cultural: ["cultural", "culture", "identity", "international", "diversity", "latin america", "africa", "asia", "gala", "heritage"],
  career: ["career", "recruiting", "internship", "job", "resume", "networking", "interview", "opt", "visa"],
  wellness: ["wellness", "mental health", "wellbeing", "destress", "fitness", "health"],
  food: ["free food", "food", "catered", "dinner", "lunch", "breakfast", "pizza", "snacks", "coffee"],
  operations: ["operations", "supply chain", "logistics", "process", "simulation"],
  sports: ["sports", "athletics", "league", "sponsorship"],
};

const STOP = new Set("a an the and or of for to in on at is are was were be been am i me my we our you your what which who show list find any all about give tell there this that some get please do does can could would like want need with without any more most best top new next upcoming happening going".split(" "));

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s&+]/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (s) => norm(s).split(" ").filter((t) => t && t.length > 1 && !STOP.has(t));

function expandQuery(raw, extraKeywords = []) {
  const phrase = norm(raw);
  const base = [...new Set([...tokenize(raw), ...extraKeywords.flatMap(tokenize)])];
  const terms = new Map();
  base.forEach((t) => terms.set(t, 1));

  // bigrams from the raw query catch "investment banking", "machine learning"
  const words = norm(raw).split(" ");
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    if (Object.values(TOPICS).some((list) => list.includes(bg))) terms.set(bg, 1.4);
  }

  const matchedTopics = new Set();
  for (const [topic, list] of Object.entries(TOPICS)) {
    if (list.some((term) => phrase.includes(term))) matchedTopics.add(topic);
  }
  for (const topic of matchedTopics) {
    for (const term of TOPICS[topic]) {
      if (!terms.has(term)) terms.set(term, 0.55);
    }
  }
  return {
    phrase,
    topics: [...matchedTopics],
    terms: [...terms.entries()].map(([t, w]) => ({ t, w })).sort((a, b) => b.w - a.w),
  };
}

/* ------------------------------ RANKING ---------------------------------- */

function scoreDoc(doc, q, kind) {
  const title = norm(doc.title || doc.name);
  const facets = norm([...(doc.cat || []), ...(doc.tags || [])].join(" "));
  const body = norm(`${doc.mission || doc.desc || doc.summary || ""} ${doc.org || ""}`);

  let score = 0;
  let direct = false; // matched a term the student actually typed, not an expansion
  const why = [];

  if (q.phrase.length > 2 && title.includes(q.phrase)) {
    score += 14;
    direct = true;
    why.push("exact title match");
  }

  for (const { t, w } of q.terms) {
    if (title.includes(t)) {
      score += 5.5 * w;
      why.push(`name·${t}`);
      if (w >= 1) direct = true;
    } else if (facets.includes(t)) {
      score += 3.4 * w;
      why.push(`tag·${t}`);
      if (w >= 1) direct = true;
    } else if (body.includes(t)) {
      score += 1.5 * w;
      why.push(`text·${t}`);
    }
  }

  if (score === 0) return null;

  if (kind === "event") {
    // sooner events edge ahead of equally relevant later ones
    score += Math.max(0, 3 - Math.abs(doc.off) / 8);
    if (q.topics.includes("food") && doc.food) {
      score += 6;
      why.push("free food");
    }
  } else if (kind === "club") {
    // gentle popularity prior, capped so it can never outrank topical fit
    score += Math.min(1.5, (doc.members || 0) / 200);
  }

  return { score: Math.round(score * 100) / 100, direct, why: [...new Set(why)].slice(0, 4) };
}

function retrieve(query, opts = {}) {
  const { intent = "mixed", withinDays = null, food = false, keywords = [], limit = 25, sources = { belong: true, engage: true, larry: true } } = opts;
  const q = expandQuery(food ? `${query} free food` : query, keywords);

  const pack = (arr, kind) =>
    arr
      .filter((d) => sources[d.source] !== false)
      .filter((d) => (kind === "event" && withinDays != null ? d.off >= 0 && d.off <= withinDays : true))
      .filter((d) => (kind === "event" && food ? d.food : true))
      .map((d) => {
        const s = scoreDoc(d, q, kind);
        return s ? { ...d, ...s, kind } : null;
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          Number(b.direct) - Number(a.direct) ||
          b.score - a.score ||
          (a.off ?? 0) - (b.off ?? 0) ||
          (a.title || a.name).localeCompare(b.title || b.name)
      );

  let pool = [];
  if (intent === "events") pool = pack(EVENTS, "event");
  else if (intent === "clubs") pool = pack(CLUBS, "club");
  else if (intent === "news") pool = pack(NEWS, "news");
  else
    pool = [...pack(EVENTS, "event"), ...pack(CLUBS, "club"), ...pack(NEWS, "news")].sort(
      (a, b) => Number(b.direct) - Number(a.direct) || b.score - a.score
    );

  const directCount = pool.filter((d) => d.direct).length;
  return {
    q,
    total: pool.length,
    directCount,
    relatedCount: pool.length - directCount,
    results: pool.slice(0, limit),
  };
}

/* ------------------------------ API LAYER -------------------------------- */

const API_URL = import.meta.env.VITE_API_URL || "/api/v1/messages";

async function callClaude(messages, system, maxTokens = 1000) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    // Surface Anthropic's own explanation instead of a bare status code.
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || err?.error || err?.message || "";
    } catch {
      /* body was not JSON */
    }
    throw new Error(`Request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

const PARSE_SYSTEM = `You turn a student's question about Babson campus life into a retrieval plan.
Return ONLY a JSON object, no prose, no markdown fences:
{"intent":"events"|"clubs"|"news"|"mixed","keywords":["..."],"withinDays":<int or null>,"food":<bool>,"limit":<int>}
Rules:
- intent "clubs" for organizations/groups to join; "events" for things happening; "news" for announcements; "mixed" if genuinely both.
- keywords: 2-8 topical terms, expanded from the question. For "AI clubs" include artificial intelligence, machine learning, data, technology.
- withinDays: 7 for "this week", 3 for "this weekend", 1 for "today", 30 for "this month", else null.
- limit: how many results the student plausibly wants. Default 25. Never below 10 unless they name a number.`;

const ANSWER_SYSTEM = `You are the Babson Engage Assistant, helping students find campus events, clubs, and news.

CONTEXT RULES
- Answer only from the RESULTS block. Never invent an event, club, date, room, or organization.
- The RESULTS are already ordered by relevance. Present them in exactly that order. Never re-sort alphabetically.
- If total matches exceed the number shown, say so plainly and offer to show the rest.
- Each result is tagged DIRECT (matched what the student actually asked for) or RELATED (matched a broader topic). When counting, count only DIRECT items, then mention the RELATED ones separately as adjacent options — e.g. "4 AI clubs, plus 3 related tech orgs". Never merge the two into a single number.
- If RESULTS is empty, say nothing matched, and suggest two nearby topics that do exist.

STYLE
- Lead with a direct one-line answer. Then a compact list.
- Each event line: name, day and time, location, hosting org. Flag free food when present.
- Each club line: name, what it actually does in a few words, when it meets.
- Note the source platform (belong = college-wide, engage = grad school) only when it helps the student know where to go.
- Warm, concise, no filler, no bullet padding. Under 220 words unless asked for more.`;

/* ------------------------------- UI -------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
.ea * { box-sizing: border-box; }
.ea {
  --ink:#0E1F18; --ink2:#3A5147; --paper:#EDF0EA; --card:#FFFFFF;
  --green:#00694E; --green2:#0E8A63; --amber:#C98410; --rule:#C6CEC4;
  font-family:'Public Sans',system-ui,-apple-system,sans-serif;
  color:var(--ink); background:var(--paper); min-height:100vh;
}
.ea-display { font-family:'Fraunces','Georgia',serif; font-weight:600; letter-spacing:-0.02em; }
.ea-mono { font-family:'JetBrains Mono',ui-monospace,monospace; }
.ea-bar { display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  padding:14px 20px; background:var(--ink); color:#EDF0EA; }
.ea-mark { font-family:'Fraunces',serif; font-size:21px; font-weight:700; letter-spacing:-0.03em; }
.ea-mark em { font-style:italic; font-weight:400; color:#7FD3AE; }
.ea-pill { font-size:10.5px; letter-spacing:0.09em; text-transform:uppercase;
  padding:4px 9px; border-radius:100px; border:1px solid rgba(255,255,255,.28); }
.ea-pill.on { background:var(--green2); border-color:var(--green2); color:#02150F; font-weight:600; }
.ea-grid { display:grid; grid-template-columns:minmax(0,1fr) 384px; gap:0; align-items:stretch; }
@media (max-width:900px){ .ea-grid{ grid-template-columns:1fr; } }
.ea-chat { display:flex; flex-direction:column; min-height:560px; max-height:78vh; }
.ea-scroll { flex:1; overflow-y:auto; padding:22px 24px 8px; }
.ea-msg { margin-bottom:18px; max-width:640px; }
.ea-msg.u { margin-left:auto; }
.ea-bub { padding:12px 15px; border-radius:14px; font-size:14.5px; line-height:1.62; white-space:pre-wrap; }
.ea-msg.u .ea-bub { background:var(--ink); color:#EDF0EA; border-bottom-right-radius:4px; }
.ea-msg.a .ea-bub { background:var(--card); border:1px solid var(--rule); border-bottom-left-radius:4px; }
.ea-role { font-size:10px; letter-spacing:0.11em; text-transform:uppercase; color:var(--ink2); margin-bottom:5px; }
.ea-msg.u .ea-role { text-align:right; }
.ea-compose { border-top:1px solid var(--rule); padding:14px 24px 18px; background:var(--paper); }
.ea-inputrow { display:flex; gap:9px; }
.ea-input { flex:1; padding:12px 14px; border:1.5px solid var(--rule); border-radius:11px;
  font-family:inherit; font-size:14.5px; background:var(--card); color:var(--ink); }
.ea-input:focus { outline:none; border-color:var(--green2); box-shadow:0 0 0 3px rgba(14,138,99,.16); }
.ea-send { padding:12px 20px; border:none; border-radius:11px; background:var(--green); color:#fff;
  font-family:inherit; font-weight:600; font-size:14px; cursor:pointer; }
.ea-send:hover:not(:disabled){ background:var(--green2); }
.ea-send:disabled { opacity:.45; cursor:not-allowed; }
.ea-chips { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:11px; }
.ea-chip { padding:6px 11px; border:1px solid var(--rule); background:var(--card); border-radius:100px;
  font-family:inherit; font-size:12.5px; color:var(--ink2); cursor:pointer; }
.ea-chip:hover { border-color:var(--green2); color:var(--green); }
.ea-side { border-left:1px solid var(--rule); background:#E4E9E1; display:flex; flex-direction:column; max-height:78vh; }
@media (max-width:900px){ .ea-side{ border-left:none; border-top:1px solid var(--rule); max-height:none; } }
.ea-sidehead { padding:16px 18px 12px; border-bottom:1px solid var(--rule); }
.ea-sidetitle { font-size:11px; letter-spacing:0.11em; text-transform:uppercase; color:var(--ink2); }
.ea-count { font-family:'Fraunces',serif; font-size:31px; font-weight:600; line-height:1.05; margin-top:3px; }
.ea-count small { font-family:'Public Sans',sans-serif; font-size:12.5px; font-weight:400; color:var(--ink2); letter-spacing:0; }
.ea-toggle { display:flex; gap:0; margin-top:12px; border:1px solid var(--rule); border-radius:9px; overflow:hidden; background:var(--card); }
.ea-tbtn { flex:1; padding:7px 6px; border:none; background:transparent; font-family:inherit;
  font-size:11.5px; font-weight:600; color:var(--ink2); cursor:pointer; }
.ea-tbtn.on { background:var(--ink); color:#EDF0EA; }
.ea-tbtn.on.legacy { background:#8A2E22; color:#fff; }
.ea-sidebody { flex:1; overflow-y:auto; padding:12px 14px 20px; }
.ea-row { display:flex; gap:11px; padding:11px 0; border-bottom:1px solid var(--rule); }
.ea-rank { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:var(--ink2); width:20px; padding-top:2px; }
.ea-rowmain { flex:1; min-width:0; }
.ea-rowtitle { font-size:13px; font-weight:600; line-height:1.35; }
.ea-rowmeta { font-size:11.5px; color:var(--ink2); margin-top:3px; }
.ea-meter { height:4px; background:#D3DAD1; border-radius:3px; margin-top:7px; overflow:hidden; }
.ea-meterfill { height:100%; background:var(--green2); border-radius:3px; }
.ea-why { font-family:'JetBrains Mono',monospace; font-size:9.5px; color:var(--ink2); margin-top:5px; letter-spacing:-0.01em; }
.ea-tag { display:inline-block; font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase;
  padding:2px 6px; border-radius:4px; margin-right:4px; font-weight:600; }
.ea-tag.belong { background:#D6E4DC; color:#0B4C39; }
.ea-tag.engage { background:#DDDCEC; color:#33306B; }
.ea-tag.food { background:#F2E3C4; color:#7A5006; }
.ea-tag.related { background:#E2E2DD; color:#5A5A52; }
.ea-cut { margin-top:14px; padding:11px 13px; border:1px dashed #8A2E22; border-radius:9px;
  background:#F6E6E3; font-size:11.5px; color:#6A241A; line-height:1.5; }
.ea-empty { padding:30px 6px; text-align:center; font-size:12.5px; color:var(--ink2); line-height:1.6; }
.ea-src { display:flex; gap:6px; flex-wrap:wrap; padding:11px 18px; border-top:1px solid var(--rule); background:#DCE3D9; }
.ea-srcbtn { padding:5px 10px; border-radius:100px; border:1px solid var(--rule); background:var(--card);
  font-family:inherit; font-size:11px; font-weight:600; color:var(--ink2); cursor:pointer; }
.ea-srcbtn.on { background:var(--green); border-color:var(--green); color:#fff; }
.ea-dots span { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--ink2); margin-right:4px; animation:eab 1.3s infinite; }
.ea-dots span:nth-child(2){ animation-delay:.18s } .ea-dots span:nth-child(3){ animation-delay:.36s }
@keyframes eab { 0%,60%,100%{opacity:.22; transform:translateY(0)} 30%{opacity:1; transform:translateY(-3px)} }
@media (prefers-reduced-motion:reduce){ .ea-dots span{ animation:none; opacity:.5 } }
.ea-note { font-size:11px; color:var(--ink2); padding:9px 24px 0; line-height:1.5; }
`;

export default function EngageAssistant() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Ask me about campus events, clubs, or news.\n\nI rank by how well things actually match what you asked, and I show you every match — not the first three in alphabetical order." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState(null);
  const [legacy, setLegacy] = useState(false);
  const [sources, setSources] = useState({ belong: true, engage: true, larry: true });
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const shown = useMemo(() => {
    if (!trace) return [];
    if (!legacy) return trace.results;
    return [...trace.results]
      .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
      .slice(0, 3);
  }, [trace, legacy]);

  const maxScore = shown.length ? Math.max(...shown.map((r) => r.score)) : 1;

  async function ask(text) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy(true);

    try {
      let plan = { intent: "mixed", keywords: [], withinDays: null, food: false, limit: 25 };
      try {
        const raw = await callClaude([{ role: "user", content: question }], PARSE_SYSTEM, 400);
        plan = { ...plan, ...JSON.parse(raw.replace(/```json|```/g, "").trim()) };
      } catch {
        /* heuristic fallback keeps the agent usable if parsing hiccups */
        const l = question.toLowerCase();
        plan.intent = /club|org|group|society|association|join/.test(l) ? "clubs" : /news|announce/.test(l) ? "news" : "events";
        plan.food = /food|eat|free lunch|dinner|snack/.test(l);
        plan.withinDays = /today/.test(l) ? 1 : /weekend/.test(l) ? 3 : /this week/.test(l) ? 7 : /month/.test(l) ? 30 : null;
      }
      plan.limit = Math.max(10, Math.min(plan.limit || 25, 40));

      const r = retrieve(question, { ...plan, sources });
      setTrace(r);

      const block = r.results.length
        ? r.results
            .map((d, i) => {
              if (d.kind === "event")
                return `${i + 1}. EVENT | ${d.title} | ${d.direct ? "DIRECT" : "RELATED"} | host: ${d.org} | ${fmtDate(d.off)} ${d.time} | ${d.loc} | ${d.food ? "free food | " : ""}source: ${d.source} | ${d.desc}`;
              if (d.kind === "club")
                return `${i + 1}. CLUB | ${d.name} | ${d.direct ? "DIRECT" : "RELATED"} | ${d.cat.join(", ")} | ${d.members} members | meets ${d.meets} | source: ${d.source} | ${d.mission}`;
              return `${i + 1}. NEWS | ${d.title} | ${fmtDate(d.off)} | source: ${d.source} | ${d.summary}`;
            })
            .join("\n")
        : "(none)";

      const answer = await callClaude(
        [
          ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user",
            content: `Today is ${TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.\n\nSTUDENT QUESTION: ${question}\n\nTotal matches found: ${r.total} — ${r.directCount} direct, ${r.relatedCount} related. Showing top ${r.results.length}.\n\nRESULTS (already ranked — keep this order):\n${block}`,
          },
        ],
        ANSWER_SYSTEM
      );

      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `That request didn't go through: ${e.message}. Try asking again.` }]);
    } finally {
      setBusy(false);
    }
  }

  const chips = ["List finance events", "AI clubs", "Free food this week", "Clubs for international students", "What's happening this weekend"];

  return (
    <div className="ea">
      <style>{CSS}</style>

      <div className="ea-bar">
        <div className="ea-mark">Engage <em>Assistant</em></div>
        <span className="ea-pill on">v2 rebuild</span>
        <span className="ea-pill">relevance ranked</span>
        <span className="ea-pill">no result cap</span>
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.62 }} className="ea-mono">
          belong + engage + Larry's files
        </span>
      </div>

      <div className="ea-grid">
        <div className="ea-chat">
          <div className="ea-scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ea-msg ${m.role === "user" ? "u" : "a"}`}>
                <div className="ea-role">{m.role === "user" ? "You" : "Assistant"}</div>
                <div className="ea-bub">{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="ea-msg a">
                <div className="ea-role">Assistant</div>
                <div className="ea-bub">
                  <span className="ea-dots"><span /><span /><span /></span>
                </div>
              </div>
            )}
          </div>

          <div className="ea-compose">
            <div className="ea-chips">
              {chips.map((c) => (
                <button key={c} className="ea-chip" onClick={() => ask(c)} disabled={busy}>{c}</button>
              ))}
            </div>
            <div className="ea-inputrow">
              <input
                className="ea-input"
                value={input}
                placeholder="Ask about events, clubs, or campus news"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(input)}
                disabled={busy}
              />
              <button className="ea-send" onClick={() => ask(input)} disabled={busy || !input.trim()}>Ask</button>
            </div>
            <div className="ea-note">
              Sample data stands in for the live feed. Point the retrieval layer at Larry's files or the MCP server to go live.
            </div>
          </div>
        </div>

        <div className="ea-side">
          <div className="ea-sidehead">
            <div className="ea-sidetitle">What the agent retrieved</div>
            <div className="ea-count">
              {trace ? trace.directCount : 0}{" "}
              <small>
                direct match{trace?.directCount === 1 ? "" : "es"}
                {trace && trace.relatedCount ? ` · ${trace.relatedCount} related` : ""}
                {trace && trace.total > shown.length ? ` · showing ${shown.length}` : ""}
              </small>
            </div>
            <div className="ea-toggle">
              <button className={`ea-tbtn ${!legacy ? "on" : ""}`} onClick={() => setLegacy(false)}>v2 · by relevance</button>
              <button className={`ea-tbtn legacy ${legacy ? "on" : ""}`} onClick={() => setLegacy(true)}>v1 · A–Z, top 3</button>
            </div>
          </div>

          <div className="ea-sidebody">
            {!trace && <div className="ea-empty">Ask something and the ranked results appear here, with the score and the reason each one placed where it did.</div>}

            {trace && shown.length === 0 && <div className="ea-empty">Nothing matched that query.</div>}

            {shown.map((d, i) => (
              <div className="ea-row" key={d.id}>
                <div className="ea-rank">{String(i + 1).padStart(2, "0")}</div>
                <div className="ea-rowmain">
                  <div className="ea-rowtitle">{d.title || d.name}</div>
                  <div className="ea-rowmeta">
                    {d.kind === "event" && `${fmtDate(d.off)} · ${d.time} · ${d.loc}`}
                    {d.kind === "club" && `${d.cat.join(" · ")} · ${d.members} members`}
                    {d.kind === "news" && `News · ${fmtDate(d.off)}`}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className={`ea-tag ${d.source}`}>{d.source}</span>
                    {d.food && <span className="ea-tag food">free food</span>}
                    {!legacy && !d.direct && <span className="ea-tag related">related</span>}
                  </div>
                  {!legacy && (
                    <>
                      <div className="ea-meter">
                        <div className="ea-meterfill" style={{ width: `${Math.max(6, (d.score / maxScore) * 100)}%` }} />
                      </div>
                      <div className="ea-why">{d.score.toFixed(1)} · {d.why.join("  ")}</div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {legacy && trace && trace.total > 3 && (
              <div className="ea-cut">
                v1 sorted these A–Z and stopped at 3, hiding {trace.total - 3} match{trace.total - 3 === 1 ? "" : "es"}. The student never learned they existed. Flip back to v2 to see the full ranked set.
              </div>
            )}
          </div>

          <div className="ea-src">
            {[["belong", "belong.babson.edu"], ["engage", "engage.babson.edu"], ["larry", "Larry's files"]].map(([k, label]) => (
              <button
                key={k}
                className={`ea-srcbtn ${sources[k] ? "on" : ""}`}
                onClick={() => setSources((s) => ({ ...s, [k]: !s[k] }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
