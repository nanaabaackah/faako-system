const labels = { idle: "Send enquiry", working: "Sending…", success: "Sent", error: "Try again" };
/** Presentation only. The caller still owns validation, tokens and request locking. */
export function setAsyncButtonState(button, state) {
  if (!Object.hasOwn(labels, state)) throw new Error("Unknown async button state");
  button.dataset.asyncState = state;
  button.setAttribute("aria-busy", String(state === "working"));
  button.querySelector("[data-async-label]").textContent = labels[state];
}
