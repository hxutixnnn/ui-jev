import { Playground } from "@/components/playground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ui-jev playground",
  description:
    "Playground for ui-jev: Jev plans the UI, json-render renders it — constrained to components you define.",
};

export default function Home() {
  return <Playground />;
}
