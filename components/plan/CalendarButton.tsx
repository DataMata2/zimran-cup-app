"use client";

import { buttonClasses } from "@/components/kit/Button";
import { calendarFile, ICS_FILENAME, ICS_TYPE } from "@/lib/product/calendar";
import { downloadText } from "@/lib/product/download";
import type { TaxResult } from "@/lib/tax";

/** Saves the deadlines as a calendar file, built on this device. */
export function CalendarButton({ result }: { result: TaxResult }) {
  return (
    <button
      type="button"
      onClick={() => downloadText(calendarFile(result), ICS_FILENAME, ICS_TYPE)}
      className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
      </svg>
      Add all to calendar (.ics)
    </button>
  );
}
