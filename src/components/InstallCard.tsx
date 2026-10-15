"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Chrome on Android fires this when the site can be installed; calling
// prompt() shows the native install dialog. Not in the TypeScript DOM types.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "mtvfr-install-card-dismissed";
const listeners = new Set<() => void>();

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function hide() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Private browsing: the card just reappears next visit.
  }
  listeners.forEach((listener) => listener());
}

// Shown on the Status page so members can put the app on their own phone.
// Hidden when already running as an installed app, or after "Hide".
export function InstallCard() {
  // Server render and first client render show nothing, so installed users
  // never see the card flash.
  const visible = useSyncExternalStore(
    subscribe,
    () => !readDismissed() && !isInstalled(),
    () => false,
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", hide);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-blue-950">Put Equipment Checks on your phone</h2>
        <button
          type="button"
          onClick={hide}
          className="shrink-0 text-xs font-medium text-blue-800 hover:underline"
        >
          Hide
        </button>
      </div>
      <p className="mt-1 text-blue-950">
        Adds an MTVFR icon to your home screen that opens like an app. You stay signed in for
        90 days at a time, renewed each day you use it.
      </p>

      {installEvent && (
        <button
          type="button"
          onClick={() => {
            installEvent.prompt();
            setInstallEvent(null);
          }}
          className="mt-3 rounded-md bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900"
        >
          Install app
        </button>
      )}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold text-blue-950">iPhone</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-blue-950">
            <li>Open this page in Safari.</li>
            <li>
              Tap the <strong>Share</strong> button (square with an up arrow).
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
            <li>Open the new MTVFR icon and sign in with Google once.</li>
          </ol>
        </div>
        <div>
          <h3 className="font-semibold text-blue-950">Android</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-blue-950">
            <li>Open this page in Chrome.</li>
            <li>
              Tap <strong>Install app</strong> above, or the <strong>⋮</strong> menu, then{" "}
              <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
            </li>
            <li>Open the new MTVFR icon. You&apos;re already signed in.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
