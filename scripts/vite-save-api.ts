import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";

const MAX_SLOTS = 9;

function slotPath(root: string, slot: number): string {
  return path.join(root, "save", `slot-${slot}.json`);
}

function parseSlot(raw: string | undefined): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SLOTS) return null;
  return n;
}

async function ensureSaveDir(root: string): Promise<void> {
  await fs.mkdir(path.join(root, "save"), { recursive: true });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function attachSaveApi(middlewares: Connect.Server, root: string): void {
  middlewares.use((req, res, next) => {
    void handleSaveApi(req, res, next, root);
  });
}

async function handleSaveApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  root: string,
): Promise<void> {
  const url = req.url ?? "";
  if (!url.startsWith("/api/saves")) {
    next();
    return;
  }

  try {
    await ensureSaveDir(root);
    const method = (req.method ?? "GET").toUpperCase();

    if (url === "/api/saves" || url.startsWith("/api/saves?")) {
      if (method !== "GET") {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
      }
      const slots: { slot: number; exists: boolean; meta: unknown }[] = [];
      for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        const file = slotPath(root, slot);
        try {
          const raw = await fs.readFile(file, "utf8");
          const parsed = JSON.parse(raw) as { meta?: unknown };
          slots.push({ slot, exists: true, meta: parsed.meta ?? null });
        } catch {
          slots.push({ slot, exists: false, meta: null });
        }
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ slots }));
      return;
    }

    const match = /^\/api\/saves\/(\d+)\/?$/.exec(url.split("?")[0] ?? "");
    const slot = parseSlot(match?.[1]);
    if (slot == null) {
      res.statusCode = 400;
      res.end("Invalid slot");
      return;
    }
    const file = slotPath(root, slot);

    if (method === "GET") {
      try {
        const raw = await fs.readFile(file, "utf8");
        res.setHeader("Content-Type", "application/json");
        res.end(raw);
      } catch {
        res.statusCode = 404;
        res.end("Not found");
      }
      return;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      JSON.parse(body);
      await fs.writeFile(file, body, "utf8");
      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === "DELETE") {
      try {
        await fs.unlink(file);
      } catch {
        /* already missing */
      }
      res.statusCode = 204;
      res.end();
      return;
    }

    res.statusCode = 405;
    res.end("Method Not Allowed");
  } catch (err) {
    res.statusCode = 500;
    res.end(err instanceof Error ? err.message : "Save API error");
  }
}

function hook(server: ViteDevServer | PreviewServer, root: string): void {
  attachSaveApi(server.middlewares, root);
}

/** Writes/reads `save/slot-N.json` on disk during vite / preview. */
export function saveApiPlugin(root = process.cwd()): Plugin {
  return {
    name: "vivondo-save-api",
    configureServer(server) {
      hook(server, root);
    },
    configurePreviewServer(server) {
      hook(server, root);
    },
  };
}
