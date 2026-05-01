"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

/**
 * PwaInstallPrompt
 *
 * Shows an "Install App" banner at the bottom of the screen when the browser
 * fires the `beforeinstallprompt` event — i.e., when BusPulse meets all PWA
 * criteria and Chrome/Edge is ready to let the user add it to their home screen.
 *
 * The banner is hidden:
 *  - Once the user dismisses it (for the session)
 *  - Once the user installs the app (appinstalled fires)
 *  - In standalone mode (app is already installed)
 */
export function PwaInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — nothing to do.
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault(); // Stop Chrome's mini-infobar from appearing.
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Hide banner if user installs via another path (e.g., address bar button).
    window.addEventListener("appinstalled", () => setPrompt(null));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!prompt || dismissed) return null;

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setPrompt(null);
    }
  }

  return (
    <div
      role="banner"
      aria-label="Install BusPulse app"
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-indigo-500/30 bg-slate-900/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-md"
    >
      {/* Icon */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="shrink-0 rounded-lg"
      />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          Install BusPulse
        </p>
        <p className="truncate text-xs text-slate-400">
          Add to home screen for instant access
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        <button
          onClick={handleInstall}
          className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
        >
          Install
        </button>
      </div>
    </div>
  );
}
