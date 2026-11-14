"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { cx } from "@/components/kit/cx";
import { STATE_OPTIONS, stateName, type StateOption } from "@/lib/product/states";
import type { StateCode } from "@/lib/tax";

/** States whose name starts with the query first, then names containing it; a 2-letter code matches too. */
export function filterStates(query: string): readonly StateOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return STATE_OPTIONS;
  const starts: StateOption[] = [];
  const contains: StateOption[] = [];
  for (const o of STATE_OPTIONS) {
    const name = o.name.toLowerCase();
    if (o.code.toLowerCase() === q || name.startsWith(q)) starts.push(o);
    else if (name.includes(q)) contains.push(o);
  }
  // An exact code match ("NY") goes to the top.
  starts.sort((a, b) => Number(b.code.toLowerCase() === q) - Number(a.code.toLowerCase() === q));
  return [...starts, ...contains];
}

function exactMatch(query: string): StateCode | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const hit = STATE_OPTIONS.find((o) => o.name.toLowerCase() === q || o.code.toLowerCase() === q);
  return hit ? hit.code : null;
}

export interface StatePickerProps {
  value: StateCode | null;
  onChange: (code: StateCode | null) => void;
  /** Called after a pick by Enter or by tap, so the quiz can move on. */
  onPicked: (code: StateCode) => void;
  labelledBy: string;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Type-ahead state picker: a text box over an always-visible list (an inline combobox, so nothing pops
 * over the Continue bar). Arrow keys move, Enter picks the highlighted state and continues.
 */
export function StatePicker({ value, onChange, onPicked, labelledBy, inputRef }: StatePickerProps) {
  const listId = useId();
  const [query, setQuery] = useState(() => (value ? stateName(value) : ""));
  const matches = useMemo(() => filterStates(query), [query]);
  const selectedIndex = value ? matches.findIndex((o) => o.code === value) : -1;
  const [active, setActive] = useState(() => Math.max(0, selectedIndex));
  const activeIndex = matches.length === 0 ? -1 : Math.min(active, matches.length - 1);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the highlighted option in view inside the list box (not the page).
  useEffect(() => {
    const list = listRef.current;
    const el = activeIndex >= 0 ? list?.children[activeIndex] : null;
    if (!list || !(el instanceof HTMLElement)) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [activeIndex]);

  function onType(next: string) {
    setQuery(next);
    onChange(exactMatch(next));
    const m = filterStates(next);
    const exact = exactMatch(next);
    setActive(Math.max(0, exact ? m.findIndex((o) => o.code === exact) : 0));
  }

  function pick(o: StateOption) {
    setQuery(o.name);
    onChange(o.code);
    onPicked(o.code);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + delta + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = activeIndex >= 0 ? matches[activeIndex] : undefined;
      if (o) pick(o);
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      onType("");
    }
  }

  const activeId = activeIndex >= 0 ? `${listId}-${matches[activeIndex]?.code}` : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-14 w-full items-center rounded-md border-3 border-ink bg-surface text-lg font-medium text-ink transition-[border-color,box-shadow] duration-150 focus-within:shadow-[0_0_0_4px_var(--color-sky),0_0_0_6px_var(--color-ink)]">
        <svg aria-hidden viewBox="0 0 20 20" className="ml-3.5 size-5 shrink-0 fill-none stroke-ink stroke-[2.25]">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-labelledby={labelledBy}
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="Start typing, e.g. Texas"
          value={query}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-full w-full min-w-0 bg-transparent px-3 outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
      </div>

      {matches.length === 0 ? (
        <p className="rounded-md border-2 border-ink bg-sky-soft px-4 py-3 text-sm text-ink" role="status">
          No state matches “{query.trim()}”. Check the spelling, or type the two-letter code.
        </p>
      ) : (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="relative max-h-[13.75rem] overflow-y-auto overscroll-contain rounded-md border-3 border-ink bg-surface p-1 shadow-[0_4px_0_var(--color-ink)] sm:max-h-[18.25rem]"
        >
          {matches.map((o, i) => {
            const selected = o.code === value;
            return (
              <li
                key={o.code}
                id={`${listId}-${o.code}`}
                role="option"
                aria-selected={selected}
                // Keep focus in the text box so the keyboard stays open on phones.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseMove={() => i !== activeIndex && setActive(i)}
                className={cx(
                  "flex h-11 cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 text-base text-ink",
                  selected ? "bg-sun font-bold" : i === activeIndex && "bg-sky-soft",
                  selected && i === activeIndex && "outline-2 -outline-offset-2 outline-ink",
                )}
              >
                <span>{o.name}</span>
                <span className={cx("flex items-center gap-2 font-mono text-xs font-bold", selected ? "text-ink" : "text-ink-3")}>
                  {o.code}
                  {selected && (
                    <span className="grid size-5 place-items-center rounded-full bg-ink">
                      <svg aria-hidden viewBox="0 0 14 14" className="size-3 fill-none stroke-white stroke-[2.6]">
                        <path d="m2.5 7.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
