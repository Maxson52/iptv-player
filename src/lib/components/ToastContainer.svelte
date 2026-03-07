<script lang="ts">
  import { toast, type Toast } from "$lib/services/toast.svelte";
  import { fly, fade } from "svelte/transition";

  const alertClass: Record<Toast["type"], string> = {
    error: "alert-error",
    warning: "alert-warning",
    info: "alert-info",
    success: "alert-success",
  };
</script>

<div
  class="toast toast-bottom toast-center mb-[env(safe-area-inset-bottom)] z-1000 gap-2 p-4"
>
  {#each toast.toasts as t (t.id)}
    <div
      class="alert alert-soft {alertClass[
        t.type
      ]} shadow-lg max-w-80 w-full flex-row items-center"
      in:fly={{ x: 300, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <p class="text-xs wrap-break-word whitespace-pre-wrap">{t.message}</p>

      <button
        class="btn btn-ghost btn-xs btn-circle shrink-0 ml-auto"
        onclick={() => toast.dismiss(t.id)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  {/each}
</div>
