"use client";

import { useEffect, useRef, useState } from "react";

export interface PickerItem { id: number; primary: string; secondary?: string }

interface SearchPickerProps {
  label: string;
  placeholder: string;
  selected: PickerItem | null;
  onSelect: (item: PickerItem | null) => void;
  search: (query: string) => Promise<PickerItem[]>;
  hint?: string;
}

export default function SearchPicker({ label, placeholder, selected, onSelect, search, hint }: SearchPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try { setResults(await search(query)); } catch { setResults([]); }
      finally { setIsSearching(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, isOpen, search]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={container} className="relative flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      {selected ? (
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="min-w-0 flex flex-col">
            <span className="text-sm font-semibold text-gray-900 truncate">{selected.primary}</span>
            {selected.secondary && <span className="text-xs text-gray-500 truncate">{selected.secondary}</span>}
          </span>
          <button type="button" onClick={() => { onSelect(null); setQuery(""); }} className="shrink-0 text-xs font-semibold text-[#0E4D3A] hover:text-blue-700">Clear</button>
        </div>
      ) : (
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="crm-input"
        />
      )}
      {hint && <span className="text-[11px] font-normal text-gray-400">{hint}</span>}

      {isOpen && !selected && (
        <ul className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {isSearching ? (
            <li className="px-3 py-2.5 text-xs text-gray-500">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-gray-500">No matches found</li>
          ) : (
            results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(item); setIsOpen(false); setQuery(""); }}
                  className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors"
                >
                  <span className="block text-sm text-gray-900">{item.primary}</span>
                  {item.secondary && <span className="block text-xs text-gray-500">{item.secondary}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
