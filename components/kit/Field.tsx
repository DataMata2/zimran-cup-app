"use client";

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import {
  caretAfterSignificant,
  moneyTextFromValue,
  parseMoneyText,
  readMoneyInput,
  significantBefore,
} from "./moneyText";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: ReactNode;
  /** Helper text under the label's input. */
  hint?: ReactNode;
  /** Error message; when set the input is marked invalid and the hint is replaced. */
  error?: ReactNode;
  /** Visually hide the label (it stays for screen readers), e.g. inside a sentence-like row. */
  hideLabel?: boolean;
  /** The control: TextInput or MoneyInput, which pick up id / aria wiring from the field. */
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired with ids and aria-describedby. */
export function Field({ label, hint, error, hideLabel = false, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  const describedBy = hasError ? errorId : hint ? hintId : undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: hasError }}>
      <div className={cx("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className={cx("text-sm font-bold text-ink", hideLabel && "sr-only")}>
          {label}
        </label>
        {children}
        {hasError ? (
          <p id={errorId} role="alert" className="text-sm font-medium text-red">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-sm text-ink-2">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldWiring(id?: string, describedBy?: string, invalid?: boolean) {
  const ctx = useContext(FieldContext);
  return {
    id: id ?? ctx?.id,
    "aria-describedby": describedBy ?? ctx?.describedBy,
    "aria-invalid": (invalid ?? ctx?.invalid) ? true : undefined,
  };
}

const inputBox =
  "flex h-13 w-full items-center rounded-md border-3 bg-surface text-base text-ink transition-[border-color,box-shadow] duration-150 " +
  "focus-within:border-ink focus-within:shadow-[0_0_0_4px_var(--color-sky)]";

const inputReset =
  "h-full w-full min-w-0 bg-transparent outline-none placeholder:text-ink-3 focus-visible:outline-none";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
}

/** Plain text input styled to match MoneyInput. Gets its id from the surrounding Field. */
export function TextInput({ className, id, invalid, "aria-describedby": describedBy, ...rest }: TextInputProps) {
  const wiring = useFieldWiring(id, describedBy, invalid);
  return (
    <div className={cx(inputBox, wiring["aria-invalid"] ? "border-red" : "border-ink", className)}>
      <input {...rest} {...wiring} className={cx(inputReset, "px-3.5")} />
    </div>
  );
}

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "size" | "inputMode"> {
  /** Dollars, null when empty, NaN when the text typed isn't an amount (e.g. "1e5"). */
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Accept cents (default true). Whole dollars only when false. */
  allowCents?: boolean;
  invalid?: boolean;
}

/**
 * Dollar amount input: "$" prefix, thousands separators as you type, numeric keypad on phones.
 * Controlled by a number (or null); the formatted text is internal.
 */
export function MoneyInput({
  value,
  onValueChange,
  allowCents = true,
  invalid,
  className,
  id,
  "aria-describedby": describedBy,
  placeholder = "0",
  ...rest
}: MoneyInputProps) {
  const wiring = useFieldWiring(id, describedBy, invalid);
  const [text, setText] = useState(() => moneyTextFromValue(value, allowCents));
  const [lastValue, setLastValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // A new value from outside (reset, prefill) replaces the text unless it already means that value.
  // Object.is: NaN (text that isn't an amount) equals itself, so it doesn't re-render forever.
  if (!Object.is(value, lastValue)) {
    setLastValue(value);
    if (!Number.isNaN(value) && parseMoneyText(text) !== value) setText(moneyTextFromValue(value, allowCents));
  }

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && pendingCaret.current !== null && document.activeElement === el) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const { text: next, value: parsed } = readMoneyInput(raw, allowCents);
    pendingCaret.current = Number.isNaN(parsed) ? caret : caretAfterSignificant(next, significantBefore(raw, caret));
    setText(next);
    setLastValue(parsed);
    onValueChange(parsed);
  }

  return (
    <div className={cx(inputBox, wiring["aria-invalid"] ? "border-red" : "border-ink", className)}>
      <span aria-hidden className="pl-3.5 pr-1 font-display font-extrabold text-ink-2">
        $
      </span>
      <input
        {...rest}
        {...wiring}
        ref={inputRef}
        type="text"
        inputMode={allowCents ? "decimal" : "numeric"}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={onChange}
        className={cx(inputReset, "pr-3.5 font-display text-lg font-extrabold")}
      />
    </div>
  );
}
