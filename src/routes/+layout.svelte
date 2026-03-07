<script lang="ts">
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  import ToastContainer from "$lib/components/ToastContainer.svelte";

  let { children } = $props();
</script>

<svelte:head>
  <title>IPTV Player</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<ToastContainer />
{@render children()}
