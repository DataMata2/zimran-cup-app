import type { QuizFilingStatus, QuizStep } from "@/lib/product/quiz";

export interface StepCopy {
  question: string;
  /** One line under the question: why we ask, or what counts. */
  lead: string;
}

export const STEP_COPY: Record<QuizStep, StepCopy> = {
  1: {
    question: "How will you file your 2026 return?",
    lead: "It sets your tax brackets and standard deduction.",
  },
  2: {
    question: "Which state do you live in?",
    lead: "Your state’s income tax goes into the share you set aside.",
  },
  3: {
    question: "How much have clients paid you this year?",
    lead: "Before taxes, after nothing — just what clients paid you.",
  },
  4: {
    question: "Do you also have a W-2 job?",
    lead: "Tax withheld from a paycheck counts toward what you owe the IRS.",
  },
  5: {
    question: "What was your total tax for 2025?",
    lead: "Last year’s return often sets a lower minimum to stay penalty-free.",
  },
  6: {
    question: "Have you paid any 2026 estimated tax yet?",
    lead: "The total of your Form 1040-ES payments for tax year 2026. Not paycheck withholding.",
  },
};

export const FILING_OPTIONS: readonly { value: QuizFilingStatus; label: string; detail: string }[] = [
  { value: "single", label: "Single", detail: "Unmarried on Dec 31, 2026" },
  { value: "mfj", label: "Married filing jointly", detail: "One return with your spouse" },
  { value: "mfs", label: "Married filing separately", detail: "You and your spouse each file your own" },
  { value: "hoh", label: "Head of household", detail: "Unmarried, and you pay most costs of a home for a dependent" },
];
