"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import flags from "react-phone-number-input/flags";
import {
  AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import { Metadata } from "libphonenumber-js/core";
import metadata from "libphonenumber-js/max/metadata";

const DEFAULT_COUNTRY: CountryCode = "IN";
/** Shown first in the picker — the markets this CRM mostly serves. */
const PRIORITY: CountryCode[] = ["IN", "AE", "SA", "QA", "KW", "OM", "BH"];

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryName = (country: CountryCode) => regionNames?.of(country) ?? country;

type CountryInfo = { code: CountryCode; name: string; dial: string };

const COUNTRIES: CountryInfo[] = (() => {
  const all = getCountries().map((code) => ({ code, name: countryName(code), dial: `+${getCountryCallingCode(code)}` }));
  const rest = all.filter((item) => !PRIORITY.includes(item.code)).sort((a, b) => a.name.localeCompare(b.name));
  return [...PRIORITY.map((code) => all.find((item) => item.code === code)!), ...rest];
})();

const lengthCache = new Map<CountryCode, { min: number; max: number }>();

/** Minimum / maximum national-number digits for a country's mobile numbers (India: exactly 10), from libphonenumber's metadata. */
export function digitLimits(country: CountryCode): { min: number; max: number } {
  const cached = lengthCache.get(country);
  if (cached) return cached;
  // These methods exist at runtime but are missing from the package's type definitions.
  const meta = new Metadata(metadata) as unknown as { selectNumberingPlan(country: string): void; type(name: string): { possibleLengths(): number[] } | undefined; possibleLengths(): number[] | undefined };
  meta.selectNumberingPlan(country);
  const lengths = meta.type("MOBILE")?.possibleLengths() ?? meta.possibleLengths() ?? [];
  const limits = lengths.length ? { min: Math.min(...lengths), max: Math.max(...lengths) } : { min: 4, max: 15 };
  lengthCache.set(country, limits);
  return limits;
}

const describeLength = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} digits` : `${min}–${max} digits`);

type Parsed = { country: CountryCode; national: string };

/** Splits a stored number (E.164, or a bare local number from older records) into country + national digits. */
function parseValue(value: string): Parsed | null {
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  return null;
}

export type PhoneValidation = { valid: boolean; message?: string };

/** Validates a stored number against its own country's rules. */
export function validatePhone(value: string): PhoneValidation {
  if (!value) return { valid: false, message: "Phone number is required" };
  const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  if (!parsed?.country) return { valid: false, message: "Choose a country and enter a valid phone number" };
  return checkNational(parsed.country, parsed.nationalNumber);
}

function checkNational(country: CountryCode, national: string): PhoneValidation {
  const name = countryName(country);
  const limits = digitLimits(country);
  if (!national) return { valid: false, message: "Phone number is required" };
  if (national.length < limits.min) return { valid: false, message: `${name} numbers need ${describeLength(limits)} (${national.length} entered)` };
  if (national.length > limits.max) return { valid: false, message: `${name} numbers allow at most ${limits.max} digits (${national.length} entered)` };
  if (!isValidPhoneNumber(national, country)) return { valid: false, message: `Enter a valid ${name} phone number` };
  return { valid: true };
}

export default function PhoneField({ value, onChange, required = true, label = "Phone number" }: {
  value: string; onChange: (value: string) => void; required?: boolean; label?: string;
}) {
  const id = useId();
  const initial = useMemo(() => parseValue(value), []); // eslint-disable-line react-hooks/exhaustive-deps -- only seeds the first render
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? DEFAULT_COUNTRY);
  const [national, setNational] = useState(initial?.national ?? "");
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const limits = digitLimits(country);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const emit = (nextCountry: CountryCode, digits: string) => onChange(digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : "");

  const handleInput = (raw: string) => {
    setOpen(false);
    // A pasted international number ("+971 50 123 4567") switches the country automatically.
    if (raw.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(raw.replace(/[^\d+]/g, ""));
      if (parsed?.country) {
        const digits = parsed.nationalNumber.slice(0, digitLimits(parsed.country).max);
        setCountry(parsed.country); setNational(digits); emit(parsed.country, digits); return;
      }
    }
    const digits = raw.replace(/\D/g, "").slice(0, limits.max);
    setNational(digits); emit(country, digits);
  };

  const pickCountry = (next: CountryCode) => {
    const digits = national.slice(0, digitLimits(next).max);
    setCountry(next); setNational(digits); emit(next, digits);
    setOpen(false); setQuery("");
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^\+/, "");
    if (!term) return COUNTRIES;
    return COUNTRIES.filter((item) => item.name.toLowerCase().includes(term) || item.code.toLowerCase() === term || item.dial.slice(1).startsWith(term));
  }, [query]);

  const Flag = flags[country];
  const display = national ? new AsYouType(country).input(national) : "";
  const result = checkNational(country, national);
  const showStatus = touched || national.length > 0;
  const state: "idle" | "error" | "valid" = !showStatus ? "idle" : national.length === 0 ? (touched && required ? "error" : "idle") : result.valid ? "valid" : national.length >= limits.min || touched ? "error" : "idle";
  const border = state === "error" ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/15" : state === "valid" ? "border-emerald-400 focus-within:border-emerald-500 focus-within:ring-emerald-500/15" : "border-gray-200 hover:border-gray-300 focus-within:border-[#0E4D3A] focus-within:ring-[#0E4D3A]/15";

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-gray-700">{label}{required && <span className="text-rose-500"> *</span>}</label>

      <div className={`flex min-h-11 items-center rounded-lg border bg-white shadow-xs transition-colors focus-within:ring-2 ${border}`}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country: ${countryName(country)} +${getCountryCallingCode(country)}`}
          onClick={() => setOpen((previous) => !previous)}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-l-lg border-r border-gray-200 bg-gray-50 pl-3 pr-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100"
        >
          <span className="h-4 w-6 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)] [&>svg]:h-full [&>svg]:w-full">{Flag && <Flag title={countryName(country)} />}</span>
          <span>+{getCountryCallingCode(country)}</span>
          <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={display}
          onChange={(event) => handleInput(event.target.value)}
          onFocus={() => setOpen(false)}
          onBlur={() => setTouched(true)}
          aria-invalid={state === "error"}
          placeholder="Enter phone number"
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium tracking-wide text-gray-900 outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
        />

        <span className={`mr-3 shrink-0 text-[11px] font-bold tabular-nums ${state === "valid" ? "text-emerald-600" : state === "error" ? "text-rose-500" : "text-gray-400"}`}>
          {state === "valid"
            ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Valid"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            : `${national.length}/${limits.max}`}
        </span>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-full min-w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-slate-900/10 sm:w-80">
          <div className="flex items-center border-b border-gray-100 px-3">
            <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search country or code" aria-label="Search country" className="h-11 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          </div>
          <ul role="listbox" aria-label="Country" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-400">No country found</li>}
            {filtered.map((item, index) => {
              const ItemFlag = flags[item.code];
              const selected = item.code === country;
              const endOfPriority = !query && index === PRIORITY.length - 1;
              return (
                <li key={item.code} role="option" aria-selected={selected} className={endOfPriority ? "mb-1.5 border-b border-gray-100 pb-1.5" : ""}>
                  <button type="button" onClick={() => pickCountry(item.code)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? "bg-blue-50 font-bold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50"}`}>
                    <span className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)] [&>svg]:h-full [&>svg]:w-full">{ItemFlag && <ItemFlag title={item.name} />}</span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className={`shrink-0 text-xs tabular-nums ${selected ? "text-[#0E4D3A]" : "text-gray-400"}`}>{item.dial}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {state === "error" ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></svg>
          {national.length === 0 ? "Phone number is required" : result.message}
        </p>
      ) : state === "valid" ? (
        <p className="text-xs font-medium text-emerald-600">Valid {countryName(country)} number</p>
      ) : (
        <p className="text-xs text-gray-500">{countryName(country)} numbers have {describeLength(limits)}</p>
      )}
    </div>
  );
}
