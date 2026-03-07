import { env } from "$env/dynamic/private";
const { M3U_URL } = env;
import { M3uParser } from "m3u-parser-generator";

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

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let playlistCache: CacheEntry<object> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.timestamp < CACHE_TTL;
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
    const playlist = await fetchPlaylist();

    if (!playlist) {
      return { error: "Failed to fetch M3U file." };
    }

    return { playlist };
  } catch (error) {
    console.error("Error in load handler:", error);
    return { error: "An error occurred while processing the request." };
  }
};
