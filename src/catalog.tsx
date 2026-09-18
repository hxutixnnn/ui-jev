import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { defineRegistry, type Components } from "@json-render/react";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: {
    Page: {
      props: z.object({ title: z.string().optional() }),
      description: "Page root container",
    },
    Nav: {
      props: z.object({ brand: z.string() }),
      description: "Top navigation bar with brand name",
    },
    Hero: {
      props: z.object({
        eyebrow: z.string().optional(),
        title: z.string(),
        subtitle: z.string().optional(),
        primaryLabel: z.string().optional(),
        secondaryLabel: z.string().optional(),
      }),
      description: "Large landing hero with title, subtitle, and CTA buttons",
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["primary", "outline", "secondary"]).optional(),
      }),
      description: "Clickable button",
    },
    Grid: {
      props: z.object({
        columns: z.number().optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
      }),
      description: "Grid layout container",
    },
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      description: "Container card for content sections",
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().optional(),
      }),
      description: "Key metric / stat display with large value",
    },
    Table: {
      props: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        caption: z.string().optional(),
      }),
      description: "Data table with header columns and string rows",
    },
    CodeBlock: {
      props: z.object({
        title: z.string().optional(),
        code: z.string(),
      }),
      description: "Code sample block",
    },
    Alert: {
      props: z.object({
        title: z.string(),
        message: z.string().optional(),
        tone: z.enum(["info", "warn", "error"]).optional(),
      }),
      description: "Alert banner",
    },
    Badge: {
      props: z.object({ text: z.string() }),
      description: "Small status badge",
    },
    Footer: {
      props: z.object({ text: z.string() }),
      description: "Page footer",
    },
  },
  actions: {},
});

export type Catalog = typeof catalog;

const components: Components<Catalog> = {
  Page: ({ children }) => <div className="jr-page">{children}</div>,
  Nav: ({ props }) => (
    <div className="jr-nav">
      <span className="jr-brand">{props.brand}</span>
      <span className="jr-nav-links">Playground · Examples · Docs</span>
    </div>
  ),
  Hero: ({ props }) => (
    <div className="jr-hero">
      {props.eyebrow ? <div className="jr-eyebrow">{props.eyebrow}</div> : null}
      <h1>{props.title}</h1>
      {props.subtitle ? <p className="jr-subtitle">{props.subtitle}</p> : null}
      <div className="jr-cta-row">
        {props.primaryLabel ? <button className="jr-btn primary">{props.primaryLabel}</button> : null}
        {props.secondaryLabel ? <button className="jr-btn outline">{props.secondaryLabel}</button> : null}
      </div>
    </div>
  ),
  Button: ({ props, emit }) => (
    <button className={`jr-btn ${props.variant ?? "primary"}`} onClick={() => emit("press")}>
      {props.label}
    </button>
  ),
  Grid: ({ props, children }) => (
    <div className="jr-grid" style={{ gridTemplateColumns: `repeat(${props.columns ?? 3}, 1fr)` }}>
      {children}
    </div>
  ),
  Card: ({ props, children }) => (
    <div className="jr-card">
      {props.title ? <h3>{props.title}</h3> : null}
      {props.description ? <p className="jr-muted">{props.description}</p> : null}
      {children}
    </div>
  ),
  Metric: ({ props }) => (
    <div className="jr-metric">
      <span className="jr-metric-label">{props.label}</span>
      <span className="jr-metric-value">{props.value}</span>
      {props.change ? <span className="jr-metric-change">{props.change}</span> : null}
    </div>
  ),
  Table: ({ props }) => (
    <div className="jr-table-wrap">
      {props.caption ? <div className="jr-caption">{props.caption}</div> : null}
      <table className="jr-table">
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
  CodeBlock: ({ props }) => (
    <div className="jr-code">
      {props.title ? <div className="jr-code-title">{props.title}</div> : null}
      <pre>{props.code}</pre>
    </div>
  ),
  Alert: ({ props }) => (
    <div className={`jr-alert ${props.tone ?? "info"}`}>
      <strong>{props.title}</strong>
      {props.message ? <span> — {props.message}</span> : null}
    </div>
  ),
  Badge: ({ props }) => <span className="jr-badge">{props.text}</span>,
  Footer: ({ props }) => <div className="jr-footer">{props.text}</div>,
};

export const { registry } = defineRegistry(catalog, { components });

export const COMPONENT_NAMES: string[] = catalog.componentNames;
