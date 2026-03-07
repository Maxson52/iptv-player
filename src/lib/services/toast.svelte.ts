export type Toast = {
  id: number;
  message: string;
  details: string;
  type: "error" | "warning" | "info" | "success";
};

let nextId = 0;

class ToastState {
  toasts = $state<Toast[]>([]);

  private show(
    messageOrError: unknown,
    type: Toast["type"] = "error",
    duration?: number,
  ) {
    let message: string;
    let details = "";

    if (messageOrError instanceof Error) {
      message = messageOrError.message;
      details = messageOrError.stack ?? "";
    } else if (typeof messageOrError === "string") {
      message = messageOrError;
    } else {
      message = "An unexpected error occurred.";
      details = JSON.stringify(messageOrError, null, 2);
    }

    const id = nextId++;

    this.toasts.push({
      id,
      message,
      details,
      type,
    });

    if (duration) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  error(messageOrError: unknown, duration?: number) {
    this.show(messageOrError, "error", duration);
  }

  warning(messageOrError: unknown, duration?: number) {
    this.show(messageOrError, "warning", duration);
  }

  info(messageOrError: unknown, duration?: number) {
    this.show(messageOrError, "info", duration);
  }

  success(messageOrError: unknown, duration?: number) {
    this.show(messageOrError, "success", duration);
  }

  dismiss(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clear() {
    this.toasts = [];
  }
}

export const toast = new ToastState();
