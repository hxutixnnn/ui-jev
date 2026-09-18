import { useMemo, useState } from "react";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { catalog, registry, COMPONENT_NAMES } from "./catalog";
import { assembleSpec, EXAMPLE_PROMPTS, type Spec, type Verdict } from "./templates";

type Phase = "idle" | "loading" | "done" | "error";

type PlanResponse = {
  prompt: string;
  verdict: Verdict;
  usage: { input_tokens: number; output_tokens: number } | null;
  model: string;
};

const INSTALL = "npm install @json-render/core @json-render/react";

export default function App() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[1]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState("");
  const [showJson, setShowJson] = useState(false);

  const spec: Spec | null = useMemo(() => {
    if (!plan) return null;
    return assembleSpec(plan.verdict, plan.prompt);
  }, [plan]);

  const issues = useMemo(() => {
    if (!spec) return null;
    try {
      return catalog.validate(spec);
    } catch {
      return null;
    }
  }, [spec]);

  async function generate() {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `planner failed (${res.status})`);
      setPlan(body as PlanResponse);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "planner failed");
      setPhase("error");
    }
  }

  const systemPrompt = useMemo(() => {
    try {
      return catalog.prompt().slice(0, 900);
    } catch {
      return "";
    }
  }, []);

  return (
    <div className="site">
      <header className="topnav">
        <span className="brand">ui-jev</span>
        <nav>
          <a href="#playground">Playground</a>
          <a href="#how">How it works</a>
          <a href="#catalog">Catalog</a>
          <a href="#start">Docs</a>
        </nav>
        <a className="stars" href="https://github.com/hxutixnnn/ui-jev">
          ★ ui-jev
        </a>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">The Generative UI framework · Jev-planned</div>
          <h1>
            AI <span className="arrow">→</span> json-render <span className="arrow">→</span> UI
          </h1>
          <p className="lede">
            Generate dynamic, personalized UIs from prompts without sacrificing reliability. Jev picks the
            template and sections — code assembles the spec from a fixed catalog.
          </p>
          <div className="cmd">{INSTALL}</div>
          <div className="cta-row">
            <a className="btn primary" href="#playground">
              Try the playground
            </a>
            <a className="btn outline" href="https://github.com/vercel-labs/json-render">
              json-render on GitHub
            </a>
          </div>
        </section>

        <section id="playground" className="panel">
          <h2>Live playground — Jev plans, code renders</h2>
          <p className="muted">
            Live-only: needs <code>TYPESAFE_API_KEY</code> on the planner server. No mock fallback.
          </p>
          <div className="chips">
            {EXAMPLE_PROMPTS.map((p) => (
              <button key={p} className="chip" onClick={() => setPrompt(p)}>
                {p}
              </button>
            ))}
          </div>
          <div className="prompt-row">
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a page…" />
            <button className="btn primary" onClick={generate} disabled={phase === "loading" || !prompt.trim()}>
              {phase === "loading" ? "Planning…" : "Generate"}
            </button>
          </div>

          {phase === "error" && (
            <div className="alert error">
              <strong>Planner error.</strong> {error}{" "}
              {error.includes("TYPESAFE_API_KEY") && (
                <span>
                  Copy <code>.env.example</code> to <code>.env</code>, set the key from{" "}
                  <code>console.typesafe.ai/settings/keys</code>, restart <code>npm run server</code>.
                </span>
              )}
            </div>
          )}

          {phase === "done" && plan && spec && (
            <div className="result">
              <div className="verdict">
                <span className={`pill ${plan.verdict.action}`}>
                  {plan.verdict.action} · {plan.verdict.template}
                </span>
                <span className="muted">conf {plan.verdict.confidence.toFixed(2)}</span>
                <span className="muted">{plan.model}</span>
                {plan.usage && (
                  <span className="muted">
                    {plan.usage.input_tokens} in / {plan.usage.output_tokens} out
                  </span>
                )}
                <button className="chip" onClick={() => setShowJson((v) => !v)}>
                  {showJson ? "hide JSON" : "show JSON"}
                </button>
              </div>
              <div className="muted small">{plan.verdict.reasons.join(" · ")}</div>
              {issues && !issues.success && (
                <div className="alert warn">
                  <strong>Spec validation:</strong> {JSON.stringify(issues).slice(0, 200)}
                </div>
              )}
              <div className="render-box">
                <JSONUIProvider registry={registry} initialState={{}}>
                  <Renderer spec={spec} registry={registry} />
                </JSONUIProvider>
              </div>
              {showJson && <pre className="json">{JSON.stringify(spec, null, 2)}</pre>}
            </div>
          )}
        </section>

        <section id="how" className="steps">
          <div className="step">
            <div className="num">01</div>
            <h3>Define your catalog</h3>
            <p>Set the guardrails: which components Jev may plan with. {COMPONENT_NAMES.length} components.</p>
          </div>
          <div className="step">
            <div className="num">02</div>
            <h3>Jev plans</h3>
            <p>One live call picks template, density, and sections — with calibrated probabilities.</p>
          </div>
          <div className="step">
            <div className="num">03</div>
            <h3>Render instantly</h3>
            <p>Code assembles the json-render spec and streams it into your components.</p>
          </div>
        </section>

        <section id="catalog" className="panel">
          <h2>Catalog — the guardrails</h2>
          <div className="chips">
            {COMPONENT_NAMES.map((n) => (
              <span key={n} className="chip static">
                {n}
              </span>
            ))}
          </div>
          <h3>System prompt (generated from the catalog)</h3>
          <pre className="json">{systemPrompt}…</pre>
        </section>

        <section className="panel">
          <h2>Code owns the spec</h2>
          <pre className="json">{`// server/jev.js — Jev advises
const { state, questions } = buildJevRequest(prompt);
const { answers } = await client.systemOne({ state, questions });

// server/policy.js — code decides
const verdict = decide(answers); // render | review | refuse

// src/templates.ts — code assembles, never the model
const spec = assembleSpec(verdict, prompt);
<Renderer spec={spec} registry={registry} />`}</pre>
        </section>

        <section className="features">
          {[
            ["Generative UI", "Personalized interfaces from prompts"],
            ["Guardrails", "Jev can only plan inside your catalog"],
            ["Calibrated", "Probabilities + confidence gate review"],
            ["Fail-closed", "Spam, PII, and unsafe prompts are refused"],
            ["Live Jev", "One speculative fan-out call per prompt"],
            ["Portable spec", "Same JSON renders on web and mobile"],
          ].map(([t, d]) => (
            <div key={t} className="feature">
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </section>

        <section id="start" className="panel">
          <h2>Get started</h2>
          <div className="cmd">{INSTALL}</div>
          <pre className="json">{`cp .env.example .env   # TYPESAFE_API_KEY=...
npm install
npm run server &       # planner on :8080
npm run dev            # landing on :5173`}</pre>
        </section>
      </main>

      <footer>ui-jev · Jev advises, code decides · built on json-render + TypeSafe Jev</footer>
    </div>
  );
}
