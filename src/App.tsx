import { useEffect, useMemo, useRef, useState } from "react";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { catalog, registry } from "./catalog";
import { assembleSpec, EXAMPLE_PROMPTS, type Spec, type Verdict } from "./templates";

type Phase = "idle" | "loading" | "error";

type PlanResponse = {
  prompt: string;
  verdict: Verdict;
  usage: { input_tokens: number; output_tokens: number } | null;
  model: string;
};

const DEBOUNCE_MS = 800;

// Instant base spec: the canvas is never blank while Jev plans.
const INSTANT_VERDICT: Verdict = {
  action: "render",
  template: "landing",
  density: "spacious",
  sections: ["include_code", "include_testimonials"],
  confidence: 1,
  reasons: ["instant base render — Jev plan arriving"],
  probabilities: {},
};

export default function App() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[1]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState("");
  const [showJson, setShowJson] = useState(false);
  const reqId = useRef(0);

  const instantSpec: Spec = useMemo(() => assembleSpec(INSTANT_VERDICT, EXAMPLE_PROMPTS[1]), []);

  const spec: Spec | null = useMemo(() => {
    if (!plan) return null;
    return assembleSpec(plan.verdict, plan.prompt);
  }, [plan]);

  // Whole page is the canvas: Jev-planned spec, else the instant base.
  const displaySpec: Spec = spec ?? instantSpec;

  const issues = useMemo(() => {
    try {
      return catalog.validate(displaySpec);
    } catch {
      return null;
    }
  }, [displaySpec]);

  // Debounced auto-plan: typing pauses, then Jev plans. Stale responses are dropped.
  useEffect(() => {
    if (!prompt.trim()) return;
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setPhase("loading");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ctrl.signal,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `planner failed (${res.status})`);
        if (reqId.current !== id) return;
        setPlan(body as PlanResponse);
        setError("");
        setPhase("idle");
      } catch (e) {
        if (ctrl.signal.aborted || reqId.current !== id) return;
        setError(e instanceof Error ? e.message : "planner failed");
        setPhase("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [prompt]);

  return (
    <div className="shell">
      <main className="canvas">
        {phase === "error" && (
          <div className="alert error">
            <strong>Planner error.</strong> {error}{" "}
            {error.includes("TYPESAFE_API_KEY") && (
              <span>
                Set it in <code>.env</code> (see <code>.env.example</code>) and restart{" "}
                <code>npm run server</code>.
              </span>
            )}
          </div>
        )}
        {issues && !issues.success && (
          <div className="alert warn">
            <strong>Spec validation:</strong> {JSON.stringify(issues).slice(0, 200)}
          </div>
        )}
        <JSONUIProvider registry={registry} initialState={{}}>
          <Renderer spec={displaySpec} registry={registry} />
        </JSONUIProvider>
        {showJson && plan && spec && <pre className="json">{JSON.stringify(spec, null, 2)}</pre>}
      </main>

      <div className="dock">
        <div className="chips">
          {EXAMPLE_PROMPTS.map((p) => (
            <button key={p} className={`chip${p === prompt ? " active" : ""}`} onClick={() => setPrompt(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="prompt-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a page — UI regenerates as you type…"
            aria-label="Describe the page to generate"
          />
          <span className={`status ${phase}`}>{phase === "loading" ? "···" : phase === "error" ? "!" : "✓"}</span>
        </div>
        <div className="dock-meta">
          {plan ? (
            <>
              <span className={`pill ${plan.verdict.action}`}>
                {plan.verdict.action} · {plan.verdict.template}
              </span>
              <span className="muted">conf {plan.verdict.confidence.toFixed(2)}</span>
            </>
          ) : (
            <span className="muted">instant base…</span>
          )}
          {phase === "loading" && <span className="planning-dot">Jev is planning…</span>}
          {phase === "error" && <span className="err">{error}</span>}
          <button className="chip mini" onClick={() => setShowJson((v) => !v)}>
            {showJson ? "hide JSON" : "JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}
