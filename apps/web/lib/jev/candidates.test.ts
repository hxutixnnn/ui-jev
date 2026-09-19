// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildCandidates,
  buildCandidatesFromSpec,
} from "./candidates";

const BANNED = [
  "Maya Chen",
  "48,250",
  "Portland",
  "Weekly revenue",
  "Fulfilled",
  "Synthetic",
  "Sign in",
  "Contact us",
  "Account settings",
  "Sales overview",
  "Create account",
];

describe("prompt-derived candidates", () => {
  it("derives content only from the request", () => {
    const prompts = [
      "Design a user profile card for Ada Lovelace, design lead",
      "Team performance: $12,400 revenue up 18%, deals 72% closed",
      "Create a login form",
      "Order receipt: 2x Margherita $12, total $20",
      "A quiet page with nothing special",
    ];
    for (const prompt of prompts) {
      const { candidates, initialState } = buildCandidates(prompt);
      expect(candidates.length).toBeGreaterThan(0);
      const json = JSON.stringify({ candidates, initialState });
      for (const banned of BANNED) {
        expect(
          json.includes(banned) && !prompt.includes(banned),
          `"${banned}" leaked for "${prompt}"`,
        ).toBe(false);
      }
    }
  });

  it("offers spec content back as recipes for follow-ups", () => {
    const recipes = buildCandidatesFromSpec({
      elements: {
        node_0: { type: "Stack", props: {}, children: [] },
        node_1: {
          type: "Metric",
          props: { label: "Revenue", value: "12,400", prefix: "$" },
          children: [],
        },
        node_2: {
          type: "BarGraph",
          props: { title: null, data: [{ label: "W1", value: 1 }] },
          children: [],
        },
      },
    });
    const ids = recipes.map((c) => c.id);
    expect(ids).toContain("spec-metric-0");
    expect(ids).toContain("spec-chart-1");
    expect(ids).not.toContain("spec-rating-2");
    const chart = recipes.find((c) => c.id === "spec-chart-1")!;
    expect(chart.resource).toBe("data:chart");
    // Layout shells are not duplicated from the spec.
    expect(ids.some((id) => id.startsWith("spec-stack"))).toBe(false);
  });

  it("offers history data back as recipes for follow-ups", () => {
    const { candidates } = buildCandidates(
      "Add the chart back",
      "Sales: $48,250 revenue, 384 orders, weekly 9200, 11400",
    );
    const chart = candidates.find((c) => c.id === "data_chart");
    expect(chart?.element.type).toBe("BarGraph");
    const metrics = candidates.filter((c) => c.element.type === "Metric");
    expect(metrics.length).toBeGreaterThan(0);
    // Identity still comes from the current request.
    const headings = candidates.filter((c) => c.element.type === "Heading");
    expect(
      headings.map((c) => (c.element.props as { text: string }).text),
    ).toContain("Add the chart back");
  });
});
