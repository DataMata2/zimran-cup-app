// Public API of the Penaltyproof tax engine (US federal + state estimated tax, tax year 2026).

export { estimate, setAsideForPayment } from "./estimate";
export { annualized } from "./annualized";
export { toICS, type IcsOptions } from "./ics";
export { TaxInputError } from "./errors";
export type {
  AnnualizedInstallment,
  AnnualizedResult,
  DatedAmount,
  FilingStatus,
  Flag,
  FlagCode,
  Installment,
  InstallmentStatus,
  NormalizedInput,
  SafeHarborRule,
  StateCode,
  StateMethod,
  TaxInput,
  TaxResult,
} from "./types";
