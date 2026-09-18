import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { buildJevRequest } from "./jev.js";
import { decide } from "./policy.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, live: Boolean(process.env.TYPESAFE_API_KEY) });
});

// Live-only planner: no mock fallback. Missing key -> 503 fail-closed.
app.post("/api/plan", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").slice(0, 2000).trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (!process.env.TYPESAFE_API_KEY) {
    return res.status(503).json({ error: "TYPESAFE_API_KEY is not set — live Jev is required" });
  }
  try {
    const client = new TypeSafeClient();
    const { state, questions } = buildJevRequest(prompt);
    const response = await client.systemOne({ state, questions });
    const verdict = decide(response.answers);
    res.json({
      prompt,
      verdict,
      usage: response.usage ?? null,
      model: response.model ?? "jev-latest",
    });
  } catch (err) {
    const status = err?.status ?? 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: err instanceof Error ? err.message : "planner failed",
    });
  }
});

// Serve the Vite build when present (production single-process mode).
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8080);
if (process.env.VITEST !== "true") {
  app.listen(port, () => console.log(`ui-jev planner on :${port} (live-only)`));
}

export default app;
