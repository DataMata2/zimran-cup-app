// Error thrown for invalid input. Results never contain errors; invalid input throws.

export class TaxInputError extends Error {
  /** The input field at fault, e.g. "estimatedPaymentsMade[2].date". */
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "TaxInputError";
    this.field = field;
  }
}
