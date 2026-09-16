/**
 * store.js — live data from Azure Blob Storage
 *
 * Fetches EngageEvents.xml, BelongEvents.xml, EngageGroups.xml, BelongGroups.xml
 * from the CampusGroups container, parses them, and returns records in the shape
 * that ranking.js expects.
 *
 * Environment variables (set in Azure App Service → Configuration):
 *   BLOB_BASE_URL   https://agenticaisftp.blob.core.windows.net/integrationstest
 *   BLOB_SAS        sp=r&st=...&sig=...   (without leading ?)
 *
 * Falls back to local data/*.json if blob fetch fails.
 */

import "dotenv/config";
import { XMLParser }  from "fast-xml-parser";
import { readFile }   from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dir = path.dirname(fileURLToPath(import.meta.url));

/* ── config ─────────────────────────────────────────────────────────────── */
const BLOB_BASE = (process.env.BLOB_BASE_URL || "").replace(/\/$/, "");
const BLOB_SAS  = process.env.BLOB_SAS || "";
const FOLDER    = "CampusGroups";
const TTL_MS    = 5 * 60 * 1000;   // cache for 5 minutes

const blobUrl = (file) =>
  `${BLOB_BASE}/${FOLDER}/${file}${BLOB_SAS ? `?${BLOB_SAS}` : ""}`;

/* ── XML parser ──────────────────────────────────────────────────────────── */
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true, trimValues: true });

/* ── in-memory cache ─────────────────────────────────────────────────────── */
const _cache = {};
async function fetchXml(filename) {
  const now = Date.now();
  if (_cache[filename] && now - _cache[filename].ts < TTL_MS) return _cache[filename].data;
  if (!BLOB_BASE) throw new Error("BLOB_BASE_URL not set");
  const res = await fetch(blobUrl(filename));
  if (!res.ok) throw new Error(`Blob ${filename}: HTTP ${res.status}`);
  const parsed = parser.parse(await res.text());
  _cache[filename] = { data: parsed, ts: now };
  return parsed;
}

/* ── local fallback ──────────────────────────────────────────────────────── */
const loadLocal = async (name) =>
  JSON.parse(await readFile(path.join(__dir, "data", name), "utf8"));

/* ── field helpers ───────────────────────────────────────────────────────── */
const str  = (v) => (v == null ? "" : String(v)).trim();
const arr  = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const FREE_FOOD_RE = /\b(food|lunch|breakfast|dinner|pizza|snack|catered|refreshment|appetizer)\b/i;

function toIso(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(`${str(dateStr)} ${str(timeStr) || "12:00am"}`);
    return isNaN(d) ? null : d.toISOString();
  } catch { return null; }
}

function topicTags(topicsStr) {
  const MAP = {
    finance: ["finance", "investing", "banking", "capital markets"],
    career:  ["career", "recruiting", "networking", "internship", "job"],
    entrepreneurs: ["entrepreneurship", "startups", "founders", "venture"],
    technology: ["technology", "tech", "ai", "machine learning", "data"],
    consulting: ["consulting", "case interview", "strategy"],
    marketing:  ["marketing", "brand", "consumer"],
    sustainability: ["sustainability", "esg", "climate"],
    healthcare: ["healthcare", "biotech", "digital health"],
    international: ["international", "diversity", "cultural"],
    wellness:   ["wellness", "mental health"],
    "professional development": ["career", "professional development"],
    social: ["social", "networking", "community"],
  };
  const tags = new Set();
  for (const t of str(topicsStr).split(",")) {
    const key = t.trim().toLowerCase();
    const mapped = MAP[key];
    if (mapped) mapped.forEach((m) => tags.add(m));
    else if (key && key !== "all-are-welcome") tags.add(key);
  }
  return [...tags];
}

/* ── event parser ────────────────────────────────────────────────────────── */
function parseEvents(xmlObj, source) {
  const items = arr(xmlObj?.rss?.channel?.item);
  const now = Date.now();
  return items.flatMap((item) => {
    const endsAt = toIso(item.eventEndDate, item.eventEndTime);
    // drop events that ended in the past (but keep if end date unknown)
    if (endsAt && new Date(endsAt).getTime() < now) return [];

    const title = str(item.title);
    const desc  = str(item.description || item.fullDescription);
    const text  = `${title} ${desc}`.toLowerCase();

    return [{
      title,
      startsAt:     toIso(item.eventDate, item.eventTime),
      endsAt,
      location:     str(item.eventLocation || item.eventRoomName) || "TBD",
      organization: str(item.group),
      description:  desc.slice(0, 400),
      categories:   str(item.eventTopics).split(",").map((t) => t.trim()).filter(Boolean),
      tags:         topicTags(item.eventTopics),
      freeFood:     FREE_FOOD_RE.test(text),
      source,
      eventLink:    str(item.eventLink),
    }];
  });
}

/* ── group parser ────────────────────────────────────────────────────────── */
function parseGroups(xmlObj, source) {
  // EngageGroups / BelongGroups — RSS feed with <item> per group
  const items = arr(xmlObj?.rss?.channel?.item ?? xmlObj?.groups?.group);
  return items.flatMap((item) => {
    // skip deleted or hidden groups
    if (str(item.deleted) === "1" || str(item.hidden) === "1") return [];
    const name = str(item.groupName || item.name || item.title);
    if (!name) return [];

    const catStr  = str(item.category || item.groupType || "");
    const cats    = catStr.split(",").map((t) => t.trim()).filter(Boolean);
    const mission = str(item.mission || item.whatWeDo || item.description).slice(0, 400);

    // build tags from category labels + explicit groupTags field
    const tagSet = new Set(topicTags(catStr));
    str(item.groupTags).split(",").forEach((t) => {
      const v = t.trim().toLowerCase();
      if (v) tagSet.add(v);
    });
    // also tokenise category words ("Career and Industry" → "career", "industry")
    cats.forEach((c) =>
      c.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).forEach((w) => {
        if (w.length > 3 && !["with","from","and","the","for"].includes(w)) tagSet.add(w);
      })
    );

    return [{
      name,
      categories:  cats,
      tags:        [...tagSet],
      mission,
      memberCount: Number(item.memberCount || item.members || 0) || 0,
      meets:       str(item.meetingTime || item.meets || ""),
      source,
      groupLink:   str(item.groupLink || item.link || ""),
    }];
  });
}

/* ── public store API ────────────────────────────────────────────────────── */
async function liveEvents() {
  const [eng, bel] = await Promise.all([
    fetchXml("EngageEvents.xml"),
    fetchXml("BelongEvents.xml").catch(() => null),
  ]);
  return [
    ...parseEvents(eng, "engage"),
    ...(bel ? parseEvents(bel, "belong") : []),
  ];
}

async function liveGroups() {
  const [eng, bel] = await Promise.all([
    fetchXml("EngageGroups.xml").catch(() => null),
    fetchXml("BelongGroups.xml").catch(() => null),
  ]);
  return [
    ...(eng ? parseGroups(eng, "engage") : []),
    ...(bel ? parseGroups(bel, "belong") : []),
  ];
}

const withFallback = (liveFn, localFile) => async () => {
  try {
    const data = await liveFn();
    if (data.length) return data;
    console.warn(`Live fetch returned 0 items, falling back to ${localFile}`);
  } catch (e) {
    console.error(`Live fetch failed (${e.message}), falling back to ${localFile}`);
  }
  return loadLocal(localFile);
};

export const store = {
  events: withFallback(liveEvents, "events.json"),
  groups: withFallback(liveGroups, "groups.json"),
  news:   () => loadLocal("news.json"),   // no live news feed yet
};
