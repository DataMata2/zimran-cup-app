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
    <div className="flex flex-col gap-2">
      <div className="flex h-12 w-full items-center rounded-md border border-line-strong bg-surface text-base text-ink transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]">
        <svg aria-hidden viewBox="0 0 20 20" className="ml-3.5 size-4.5 shrink-0 fill-none stroke-ink-3 stroke-[1.75]">
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
        <p className="px-1 py-3 text-sm text-ink-2" role="status">
          No state matches “{query.trim()}”. Check the spelling, or type the two-letter code.
        </p>
      ) : (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="relative max-h-[13.5rem] overflow-y-auto overscroll-contain rounded-md border border-line bg-surface py-1 sm:max-h-[18rem]"
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
                  "flex h-11 cursor-pointer items-center justify-between gap-3 px-3.5 text-base",
                  i === activeIndex && "bg-sunken",
                  selected ? "font-semibold text-accent-ink" : "text-ink",
                )}
              >
                <span>{o.name}</span>
                <span className="flex items-center gap-2 text-sm text-ink-3">
                  {o.code}
                  {selected && (
                    <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-accent stroke-2">
                      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
