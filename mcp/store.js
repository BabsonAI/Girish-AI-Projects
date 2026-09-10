// Swap these readers for your real feeds (belong.babson.edu, engage.babson.edu,
// uploaded files). Each record must carry a `source` of "belong" | "engage" | "upload".
//
// events: { title, startsAt (ISO), location, organization, description,
//           categories[], tags[], freeFood (bool), source }
// groups: { name, categories[], tags[], mission, memberCount, meets, source }
// news:   { title, publishedAt (ISO), summary, tags[], source }

import { readFile } from "node:fs/promises";

const load = async (f) => JSON.parse(await readFile(new URL(`./data/${f}`, import.meta.url), "utf8"));

export const store = {
  events: () => load("events.json"),
  groups: () => load("groups.json"),
  news:   () => load("news.json"),
};
