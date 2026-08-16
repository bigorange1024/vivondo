import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { execFile } from "node:child_process";
import os from "node:os";

/** Prefer a private LAN IPv4 (skip localhost / link-local). */
export function pickLanIpv4(): string | null {
  const nets = os.networkInterfaces();
  const found: string[] = [];
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family !== "IPv4" && (net.family as unknown) !== 4) continue;
      if (net.internal) continue;
      if (net.address.startsWith("169.254.")) continue;
      found.push(net.address);
    }
  }
  // Prefer common home/router ranges
  const preferred = found.find(
    (ip) =>
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip),
  );
  return preferred ?? found[0] ?? null;
}

function openInBrowser(url: string): void {
  if (process.platform === "win32") {
    // First quoted arg after `start` is the window title — keep it empty.
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true });
    return;
  }
  if (process.platform === "darwin") {
    execFile("open", [url]);
    return;
  }
  execFile("xdg-open", [url]);
}

function portOf(
  server: ViteDevServer | PreviewServer,
  fallback: number,
): number {
  const addr = server.httpServer?.address();
  if (addr && typeof addr === "object" && typeof addr.port === "number") {
    return addr.port;
  }
  return fallback;
}

function scheduleOpen(
  server: ViteDevServer | PreviewServer,
  fallbackPort: number,
): void {
  if (process.env.VIVONDO_NO_OPEN === "1") return;

  const run = () => {
    const port = portOf(server, fallbackPort);
    const ip = pickLanIpv4();
    const url = ip
      ? `http://${ip}:${port}/`
      : `http://localhost:${port}/`;
    console.log(`\n  Opening browser at ${url}\n`);
    openInBrowser(url);
  };

  const http = server.httpServer;
  if (!http) {
    // Dev server not bound yet — wait a tick via listening later
    setTimeout(() => {
      if (server.httpServer?.listening) run();
      else server.httpServer?.once("listening", run);
    }, 0);
    return;
  }
  if (http.listening) run();
  else http.once("listening", run);
}

/** Open the default browser on the LAN IP (not localhost) after listen. */
export function openLanBrowserPlugin(): Plugin {
  return {
    name: "vivondo-open-lan-browser",
    apply: "serve",
    configureServer(server) {
      return () => scheduleOpen(server, server.config.server.port ?? 5173);
    },
    configurePreviewServer(server) {
      return () =>
        scheduleOpen(server, server.config.preview.port ?? 4173);
    },
  };
}
