"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { NombaBank } from "@/types";

type BankSearchSelectProps = {
  banks: NombaBank[];
  value: string;
  onChange: (bankCode: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function normalizeBankQuery(query: string) {
  return query.trim().toLowerCase();
}

function bankMatchesQuery(bank: NombaBank, query: string) {
  if (!query) return true;
  const haystack = `${bank.name} ${bank.code}`.toLowerCase();
  if (haystack.includes(query)) return true;
  if (query.includes("opay") && haystack.includes("opay")) return true;
  if (query.includes("gtb") && haystack.includes("gtbank")) return true;
  return false;
}

export function BankSearchSelect({
  banks,
  value,
  onChange,
  disabled,
  placeholder = "Type bank name (e.g. Opay, GTBank)",
}: BankSearchSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = banks.find((bank) => bank.code === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected && query !== selected.name) {
      setQuery(selected.name);
    }
  }, [selected, query]);

  const filtered = useMemo(() => {
    const q = normalizeBankQuery(query);
    const matches = banks.filter((bank) => bankMatchesQuery(bank, q));
    if (!q) {
      const popularCodes = ["305", "058", "044", "011", "033"];
      const popular = popularCodes
        .map((code) => banks.find((b) => b.code === code))
        .filter((b): b is NombaBank => Boolean(b));
      const rest = banks.filter((b) => !popularCodes.includes(b.code));
      return [...popular, ...rest].slice(0, 10);
    }
    return matches.slice(0, 12);
  }, [banks, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function pickBank(bank: NombaBank) {
    onChange(bank.code);
    setQuery(bank.name);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={listId}
        className="input-field w-full"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange("");
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-listbox`}
      />
      {open && !disabled && filtered.length > 0 ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-white/50 bg-white/95 py-1 shadow-lg backdrop-blur-md"
        >
          {filtered.map((bank) => (
            <li key={bank.code}>
              <button
                type="button"
                role="option"
                aria-selected={bank.code === value}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-primary-subtle/60 ${
                  bank.code === value ? "bg-primary-subtle/40 font-medium" : ""
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickBank(bank)}
              >
                {bank.name}
                <span className="ml-2 text-xs text-text-muted">{bank.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
