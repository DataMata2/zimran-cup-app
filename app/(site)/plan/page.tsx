import type { Metadata } from "next";
import { PlanApp } from "@/components/plan/PlanApp";

export const metadata: Metadata = {
  title: "Your plan — Penaltyproof",
  description: "What to pay by the next IRS deadline, what to set aside from every payment, and your four 2026 deadlines.",
};

// Everything on this page comes from the guest's saved answers in this browser, so it renders client-side.
export default function PlanPage() {
  return <PlanApp />;
}
