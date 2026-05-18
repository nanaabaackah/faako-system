/**
 * Minimal Paystack Inline integration. Uses the PUBLIC key only (safe to ship
 * client-side). There is no backend, so the charge is initialised and the
 * reference returned here cannot yet be verified server-side — add a
 * /verify endpoint + webhook when a backend exists.
 */

const SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";

export const PAYSTACK_PUBLIC_KEY =
  (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined) ?? "";

interface PaystackHandler {
  openIframe: () => void;
}

interface PaystackPop {
  setup: (options: {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    ref?: string;
    metadata?: Record<string, unknown>;
    callback: (response: { reference: string }) => void;
    onClose: () => void;
  }) => PaystackHandler;
}

declare global {
  interface Window {
    PaystackPop?: PaystackPop;
  }
}

let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment library."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
};

export interface PayArgs {
  email: string;
  /** Amount in major currency units (e.g. GHS), converted to subunits here. */
  amount: number;
  reference: string;
  metadata?: Record<string, unknown>;
}

export const payWithPaystack = async ({
  email,
  amount,
  reference,
  metadata,
}: PayArgs): Promise<{ reference: string }> => {
  if (!PAYSTACK_PUBLIC_KEY) {
    throw new Error(
      "Payment is not configured. Set VITE_PAYSTACK_PUBLIC_KEY to enable checkout."
    );
  }
  await loadScript();
  if (!window.PaystackPop) {
    throw new Error("Payment library unavailable.");
  }

  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop!.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(amount * 100),
      currency: "GHS",
      ref: reference,
      metadata,
      callback: (response) => resolve({ reference: response.reference }),
      onClose: () => reject(new Error("Payment was cancelled.")),
    });
    handler.openIframe();
  });
};
