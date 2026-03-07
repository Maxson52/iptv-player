<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { VList } from "virtua/svelte";
  import { toast } from "$lib/services/toast.svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import type { PageProps } from "./$types";
  import type { ChannelEpg } from "./+page.server";

  let { data }: PageProps = $props();

  let video: HTMLVideoElement;
  let player: any = null;

  let selectedStream = $state<string | null>(null);
  let selectedName = $state<string | null>(null);

  let search = $state("");
  let filteredChannels = $state<any[]>([]);

  let epg = $state<Record<string, ChannelEpg>>({});
  let epgLoading = $state(true);

  function getChannelEpg(channel: any): ChannelEpg | null {
    const tvgId = channel.attributes?.["tvg-id"];
    if (!tvgId) return null;
    return epg[tvgId] ?? null;
  }

  async function loadEpg() {
    epgLoading = true;
    try {
      const res = await fetch("/api/epg");
      if (res.ok) {
        epg = await res.json();
      }
    } catch (err) {
      console.error("Failed to load EPG:", err);
    } finally {
      epgLoading = false;
    }
  }

  function destroyPlayer() {
    if (player) {
      player.destroy();
      player = null;
    }
  }

  async function loadStream() {
    if (!selectedStream || !video) return;

    destroyPlayer();

    const mpegts = (await import("mpegts.js")) as any;

    if (mpegts.getFeatureList().mseLivePlayback) {
      player = mpegts.createPlayer({
        type: "mse",
        isLive: true,
        url: selectedStream,
      });

      player.attachMediaElement(video);

      player.on(mpegts.Events.ERROR, (_type: any, detail: any) => {
        console.error("Stream error:", detail);
        toast.error(
          "There was an error playing the stream. Please try another channel.",
        );
      });

      video.onerror = () => {
        const err = video.error;

        console.error("Video element error:", err);

        if (err) {
          switch (err.code) {
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              toast.error("Stream format not supported or URL invalid");
              break;

            case MediaError.MEDIA_ERR_NETWORK:
              toast.error("Network error while loading stream");
              break;

            case MediaError.MEDIA_ERR_DECODE:
              toast.error("Stream decoding failed");
              break;

            default:
              toast.error("Unknown playback error");
          }
        }
      };

      player.load();
      player.play();
    } else {
      video.src = selectedStream;
      video.play();
    }
  }

  function selectChannel(channel: any) {
    selectedStream = channel.location;
    selectedName = channel.name;

    page.url.searchParams.set("channel", channel.location);
    goto(page.url.toString(), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });

    loadStream();
  }

  $effect(() => {
    if (!search) {
      filteredChannels = data.playlist.medias;
      return;
    }
    const q = search.toLowerCase();
    filteredChannels = data.playlist.medias.filter((c: any) =>
      c.name.toLowerCase().includes(q),
    );
  });

  onMount(() => {
    filteredChannels = data.playlist.medias;

    const channelFromUrl = new URLSearchParams(window.location.search).get(
      "channel",
    );
    const initial =
      (channelFromUrl &&
        data.playlist.medias.find((c: any) => c.location === channelFromUrl)) ||
      filteredChannels[0];

    if (initial) selectChannel(initial);

    loadEpg();
  });

  onDestroy(() => destroyPlayer());
</script>

<div
  class="flex flex-col h-screen max-w-3xl mx-auto bg-neutral-950 text-white shadow-lg"
>
  <!-- PLAYER -->
  <div class="sticky top-0 z-20 bg-black shadow-lg">
    <div class="w-full aspect-video relative bg-black">
      <video
        bind:this={video}
        class="w-full h-full"
        autoplay
        playsinline
        controls
      ></video>
    </div>

    {#if selectedName}
      <div
        class="px-4 py-2 text-sm font-medium bg-neutral-900 border-b border-neutral-800"
      >
        {selectedName}
      </div>
    {/if}

    <!-- SEARCH -->
    <div class="p-3 bg-neutral-900 border-b border-neutral-800">
      <input
        type="text"
        bind:value={search}
        placeholder="Search channels..."
        class="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm outline-none focus:border-blue-500"
      />
    </div>
  </div>

  <!-- CHANNEL LIST -->
  {#if data.error}
    <div class="p-4 text-red-400">
      There was a problem loading the channels: {data.error}
    </div>
  {:else}
    <VList
      data={filteredChannels}
      style="flex:1; overflow:auto;"
      getKey={(item: any) => item.location}
    >
      {#snippet children(item: any)}
        {@const epgData = getChannelEpg(item)}
        <button
          onclick={() => selectChannel(item)}
          class="w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-800 transition
          {selectedStream === item.location
            ? 'bg-blue-600/20'
            : 'hover:bg-neutral-800'}"
        >
          <div
            class="w-11 h-11 shrink-0 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-neutral-700"
          >
            {#if item.attributes["tvg-logo"]}
              <img
                class="w-full h-full object-contain p-1"
                src={item.attributes["tvg-logo"]}
                alt={item.name}
              />
            {:else}
              <span class="text-xs text-neutral-400">TV</span>
            {/if}
          </div>

          <!-- Info -->
          <div class="flex-1 text-left min-w-0">
            <div class="font-medium text-sm truncate">{item.name}</div>

            {#if epgData?.current}
              <div class="mt-1">
                <div class="text-xs text-neutral-300 truncate">
                  {epgData.current.title}
                  <span class="text-neutral-500"
                    >· until {epgData.current.stopLabel}</span
                  >
                </div>
                {#if epgData.next}
                  <div class="text-xs text-neutral-500 truncate">
                    Next: {epgData.next.title}
                  </div>
                {/if}
              </div>
            {:else if epgData?.next}
              <div class="text-xs text-neutral-500 truncate mt-0.5">
                Up next: {epgData.next.title}
              </div>
            {:else if epgLoading}
              <div class="text-xs text-neutral-600 truncate mt-0.5">
                Loading guide...
              </div>
            {/if}
          </div>
        </button>
      {/snippet}
    </VList>
  {/if}
</div>
