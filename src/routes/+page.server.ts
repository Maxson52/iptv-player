import { M3U_URL, EPG_URL } from "$env/static/private";
import { M3uParser } from "m3u-parser-generator";
import { parseXmltv } from "@iptv/xmltv";

import type { PageServerLoad } from "./$types";

export interface EpgProgram {
  title: string;
  stopLabel: string;
  startLabel: string;
  progressPct: number;
}

export interface ChannelEpg {
  current: EpgProgram | null;
  next: EpgProgram | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let playlistCache: CacheEntry<object> | null = null;
let epgRawCache: CacheEntry<ReturnType<typeof parseXmltv>> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.timestamp < CACHE_TTL;
}

function toTimeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchAndParseEpgXml() {
  if (isFresh(epgRawCache)) return epgRawCache.data;

  const res = await fetch(EPG_URL);
  if (!res.ok) {
    console.error(`Failed to fetch EPG. Status: ${res.status}`);
    return null;
  }

  const xml = await res.text();
  const parsed = parseXmltv(xml);

  epgRawCache = { data: parsed, timestamp: Date.now() };
  return parsed;
}

function resolveEpg(
  programmes: NonNullable<ReturnType<typeof parseXmltv>>["programmes"],
): Record<string, ChannelEpg> {
  const now = Date.now();

  const epgMap: Record<
    string,
    {
      // @ts-ignore
      current: (typeof programmes)[0] | null;
      // @ts-ignore
      next: (typeof programmes)[0] | null;
    }
  > = {};

  // @ts-ignore
  for (const prog of programmes) {
    const channelId = prog.channel;
    if (!channelId || !prog.start || !prog.stop) continue;

    const start = new Date(prog.start).getTime();
    const stop = new Date(prog.stop).getTime();

    if (stop < now) continue;

    if (!epgMap[channelId]) {
      epgMap[channelId] = { current: null, next: null };
    }

    const ch = epgMap[channelId];

    if (start <= now) {
      ch.current = prog;
    } else if (!ch.next || start < new Date(ch.next.start!).getTime()) {
      ch.next = prog;
    }
  }

  const result: Record<string, ChannelEpg> = {};

  for (const [id, ch] of Object.entries(epgMap)) {
    const toEntry = (
      // @ts-ignore
      prog: (typeof programmes)[0],
      isCurrent: boolean,
    ): EpgProgram => {
      const start = new Date(prog.start!);
      const stop = new Date(prog.stop!);

      const rawTitle = Array.isArray(prog.title)
        ? prog.title[0]?._value
        : prog.title;
      const title = decodeXmlEntities(rawTitle ?? "Unknown");

      let progressPct = 0;
      if (isCurrent) {
        const total = stop.getTime() - start.getTime();
        progressPct =
          total > 0
            ? Math.min(
                100,
                Math.max(0, ((now - start.getTime()) / total) * 100),
              )
            : 0;
      }

      return {
        title,
        stopLabel: toTimeLabel(stop),
        startLabel: toTimeLabel(start),
        progressPct,
      };
    };

    result[id] = {
      current: ch.current ? toEntry(ch.current, true) : null,
      next: ch.next ? toEntry(ch.next, false) : null,
    };
  }

  return result;
}

async function fetchPlaylist() {
  if (isFresh(playlistCache)) return playlistCache.data;

  const res = await fetch(M3U_URL);
  if (!res.ok) {
    console.error(`Failed to fetch M3U. Status: ${res.status}`);
    return null;
  }

  const text = await res.text();
  const parser = new M3uParser();
  const playlist = parser.parse(text);
  const data = JSON.parse(JSON.stringify(playlist));

  playlistCache = { data, timestamp: Date.now() };
  return data;
}

export const load: PageServerLoad = async () => {
  try {
    const [playlist, parsedEpg] = await Promise.all([
      fetchPlaylist(),
      fetchAndParseEpgXml(),
    ]);

    if (!playlist) {
      return { error: "Failed to fetch M3U file.", epg: {} };
    }

    const epg = parsedEpg?.programmes ? resolveEpg(parsedEpg.programmes) : {};

    return { playlist, epg };
  } catch (error) {
    console.error("Error in load handler:", error);
    return {
      error: "An error occurred while processing the request.",
      epg: {},
    };
  }
};
