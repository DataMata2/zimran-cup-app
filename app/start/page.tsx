import type { Metadata, Viewport } from "next";
import { QuizApp } from "@/components/quiz/Quiz";
import { RestoreRedirect } from "@/components/quiz/RestoreRedirect";

export const metadata: Metadata = {
  title: "Get your number — Penaltyproof",
  description: "Six quick questions about your 2026 freelance income. No sign-up.",
};

// On Android, let the keyboard shrink the layout so the pinned Continue bar stays above it.
export const viewport: Viewport = {
  themeColor: "#f5f5f0",
  colorScheme: "light",
  interactiveWidget: "resizes-content",
};

export default function StartPage() {
  return (
    <>
      <RestoreRedirect />
      <QuizApp />
    </>
  );
}
