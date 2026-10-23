"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/auth";
import {
  createEmployee, deleteEmployee, getEmployee,
  listAllEmployees, logEvent, updateEmployee, EMPLOYEE_ROLES, EMPLOYEE_BRANCHES,
  type Employee, type EmployeeRole, type EmployeeBranch, type EmployeeUpdate,
} from "@/lib/api/employees";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { dmSans } from "@/lib/auth-fonts";
import FilterSelect, { type FilterOption } from "@/components/FilterSelect";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: ApiError | { kind: "auth"; message: string } }
  | { status: "ready"; employees: Employee[]; syncedAt: Date };

type Viewer = { id: number; role: string };
type FormValues = { name: string; email: string; phone: string; role: EmployeeRole; branch: EmployeeBranch | ""; is_active: boolean; password: string };

const AVATAR_TONES = ["bg-[#E7F5EE] text-[#0E4D3A]", "bg-[#E0F2FE] text-[#0B6AA8]", "bg-[#DCFCE7] text-[#167A44]", "bg-[#FEF3C7] text-[#9A6200]", "bg-[#FCE7F3] text-[#A8326E]"];
const ROLE_STYLES: Record<string, string> = {
  all: "bg-[#F0F0F3] text-[#3A3E4A]",
  admin: "bg-[#1A1C21] text-white",
  manager: "bg-[#F1EDFF] text-[#5B3FD6]",
  sales_executive: "bg-[#EEF4FF] text-[#1D5BBF]",
};
const DEFAULT_ROLE_STYLE = "bg-[#F0F0F3] text-[#3A3E4A]";

const PAGE_SIZE = 10;

/** Cryptographically random password: 12 chars, always has upper, lower and a digit. Skips look-alike characters (0/O, 1/l/I). */
function generatePassword(length = 12): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789"];
  const all = sets.join("") + "@#$%&*";
  const random = (max: number) => { const buffer = new Uint32Array(1); crypto.getRandomValues(buffer); return buffer[0] % max; };
  const chars = sets.map((set) => set[random(set.length)]);
  while (chars.length < length) chars.push(all[random(all.length)]);
  for (let index = chars.length - 1; index > 0; index--) { const swap = random(index + 1); [chars[index], chars[swap]] = [chars[swap], chars[index]]; }
  return chars.join("");
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Reduces anything typed or pasted (+91…, 91…, 0…, spaces, dashes) to the bare 10-digit number. */
function toIndianLocal(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  // Strip a country/trunk prefix only when it is unambiguous, so numbers that merely start with 91 or 0 keep typing normally.
  if (raw.startsWith("+91") || (digits.length >= 12 && digits.startsWith("91"))) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** "+919876543210" → "+91 98765 43210"; anything else is shown untouched. */
const formatPhone = (phone: string | null) => {
  const match = phone?.match(/^\+91(\d{5})(\d{5})$/);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
};

const roleLabel = (role: string) => role.replaceAll("_", " ");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
/** Table format from the design: "09 Oct 2026, 11:15 am". */
const formatJoined = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
  : "—";

const ACCENT_BUTTON = "bg-[#0E4D3A] text-white transition-colors hover:bg-[#0B3E2F]";
const primaryButton = `inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-semibold disabled:opacity-60 ${ACCENT_BUTTON}`;
const secondaryButton = "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#E1E1E6] bg-white px-4 text-sm font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50";

/** Lets a row's buttons act without also opening the row. */
const stop = (event: React.MouseEvent) => event.stopPropagation();

/** CSV cell: quoted, with spreadsheet formulas neutralised. */
const csvCell = (value: string) => `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;

function downloadCsv(rows: Employee[]) {
  const header = ["Name", "Email", "Phone", "Role", "Branch", "Status", "Joined"];
  const body = rows.map((employee) => [
    employee.name, employee.email, formatPhone(employee.phone) ?? "", roleLabel(employee.role),
    employee.branch ?? "", employee.is_active ? "Active" : "Inactive", formatJoined(employee.created_at),
  ]);
  const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates a SpreadsheetML XML file that Excel opens natively — no library needed.
 * Each cell is typed as String so leading-zero values like phone numbers are preserved.
 */
function downloadXls(rows: Employee[]) {
  const header = ["Name", "Email", "Phone", "Role", "Branch", "Status", "Joined"];
  const body = rows.map((employee) => [
    employee.name, employee.email, formatPhone(employee.phone) ?? "", roleLabel(employee.role),
    employee.branch ?? "", employee.is_active ? "Active" : "Inactive", formatJoined(employee.created_at),
  ]);
  const escape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const xlsCell = (v: string) => `<Cell><Data ss:Type="String">${escape(v)}</Data></Cell>`;
  const xlsRow = (cells: string[]) => `<Row>${cells.map(xlsCell).join("")}</Row>`;
  const xml = [
    `<?xml version="1.0"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`,
    `<Worksheet ss:Name="Employees"><Table>`,
    xlsRow(header),
    ...body.map(xlsRow),
    `</Table></Worksheet></Workbook>`,
  ].join("");
  const url = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `employees-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function Icon({ children, className = "w-4 h-4" }: { children: React.ReactNode; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const icons = {
  users: <><circle cx="9" cy="8" r="3.25" /><path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" /><path d="M16 4.6a3.25 3.25 0 0 1 0 6.3" /><path d="M18 14.3a4 4 0 0 1 3 3.7v1" /></>,
  active: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
  mail: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="m2 7 10 6.5L22 7" /></>,
  search: <><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-3M4 5v3.5h3.5" /><path d="M4 13a8 8 0 0 0 14.9 3M20 19v-3.5h-3.5" /></>,
  download: <><path d="M12 15V3M7 10l5 5 5-5M4 21h16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  wifiOff: <><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10 5.1" /><path d="M5 12.9a10 10 0 0 1 3.2-2M19 12.9a10 10 0 0 0-3.4-2.1" /><path d="M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></>,
  lock: <><rect width="16" height="11" x="4" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  chevronLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  chevronRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
};

function Avatar({ employee, size = "md" }: { employee: Employee; size?: "sm" | "md" | "lg" }) {
  const dimension = { sm: "h-8 w-8 text-[13px]", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-xl" }[size];
  return (
    <span aria-hidden="true" className={`${dimension} flex shrink-0 items-center justify-center rounded-full font-bold ${AVATAR_TONES[employee.id % AVATAR_TONES.length]} ${employee.is_active ? "" : "opacity-60 grayscale"}`}>
      {initials(employee.name)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-[6px] px-2.5 py-[3px] text-xs font-semibold capitalize ${ROLE_STYLES[role] ?? DEFAULT_ROLE_STYLE}`}>{roleLabel(role)}</span>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${active ? "bg-[#EAF8EF] text-[#17703F]" : "bg-[#F0F0F3] text-[#5F6473]"}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#2DB565]" : "bg-[#9AA0AC]"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** Full-width state inside the list: errors, empty results. */
function Notice({ tone, icon, title, body, children }: { tone: "rose" | "amber" | "green"; icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  const toneClass = { rose: "bg-rose-50 text-rose-500", amber: "bg-amber-50 text-amber-600", green: "bg-[#E7F5EE] text-[#0E4D3A]" }[tone];
  return (
    <div role="status" className="flex flex-col items-center px-6 py-14 text-center">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClass}`}><Icon className="w-6 h-6">{icon}</Icon></span>
      <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">{title}</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6B7080]">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Whole-page card, used only for the restricted view. */
function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Loading employees" className="animate-pulse divide-y divide-[#EFEFF2]">
      {Array.from({ length: PAGE_SIZE }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          <span className="h-8 w-8 shrink-0 rounded-full bg-[#ECECF0]" />
          <span className="h-3.5 w-32 rounded bg-[#ECECF0]" />
          <span className="hidden h-3.5 w-40 rounded bg-[#F3F3F5] md:block" />
          <span className="hidden h-3.5 w-20 rounded bg-[#F3F3F5] lg:block" />
          <span className="ml-auto h-5 w-20 rounded-full bg-[#F3F3F5]" />
        </div>
      ))}
    </div>
  );
}

function EmployeeFormDialog({ employee, viewer, onClose, onSaved }: {
  employee?: Employee; viewer: Viewer; onClose: () => void; onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const isEdit = !!employee;
  const isSelf = employee?.id === viewer.id;
  // Managers cannot assign the admin role when creating or editing employees.
  const roles = useMemo(() => {
    const options: EmployeeRole[] = viewer.role === "manager"
      ? EMPLOYEE_ROLES.filter((r) => r !== "admin")
      : [...EMPLOYEE_ROLES];
    return employee && !options.includes(employee.role as EmployeeRole) ? [employee.role as EmployeeRole, ...options] : options;
  }, [employee, viewer.role]);
  const [values, setValues] = useState<FormValues>({
    name: employee?.name ?? "", email: employee?.email ?? "", phone: toIndianLocal(employee?.phone),
    role: (employee?.role as EmployeeRole) ?? "sales_executive",
    branch: (employee?.branch as EmployeeBranch) ?? "",
    is_active: employee?.is_active ?? true, password: "",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in again before saving."); return; }
    // Only an edited or newly entered number must be a valid Indian mobile; untouched legacy values don't block other edits.
    if (values.phone && values.phone !== toIndianLocal(employee?.phone) && !INDIAN_MOBILE.test(values.phone)) {
      setPhoneTouched(true); setError("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9."); return;
    }
    if (values.password && !(values.password.length >= 8 && /[A-Za-z]/.test(values.password) && /\d/.test(values.password))) {
      setError("Password must be at least 8 characters and include a letter and a digit."); return;
    }
    setIsSaving(true); setError("");
    try {
      if (employee) {
        const patch: EmployeeUpdate = {};
        if (values.name.trim() !== employee.name) patch.name = values.name.trim();
        if (values.email.trim().toLowerCase() !== employee.email) patch.email = values.email.trim();
        if (values.phone !== toIndianLocal(employee.phone)) patch.phone = values.phone ? `+91${values.phone}` : null;
        if (values.role !== employee.role) patch.role = values.role;
        const branchVal = values.branch || null;
        if (branchVal !== (employee.branch ?? null)) patch.branch = branchVal;
        if (values.is_active !== employee.is_active) patch.is_active = values.is_active;
        if (values.password) patch.password = values.password;
        if (Object.keys(patch).length > 0) await updateEmployee(accessToken, employee.id, patch);
        onSaved(Object.keys(patch).length > 0 ? `${values.name.trim()} was updated.` : "No changes to save.");
      } else {
        await createEmployee(accessToken, {
          name: values.name.trim(), email: values.email.trim(), role: values.role,
          password: values.password,
          ...(values.phone ? { phone: `+91${values.phone}` } : {}),
          ...(values.branch ? { branch: values.branch } : {}),
        });
        onSaved(`${values.name.trim()} was added to the team.`);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setError(caught instanceof ApiError ? caught.message : "Employee could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-white overflow-y-auto sm:grid sm:place-items-center sm:p-4 sm:bg-[rgba(17,18,20,0.45)] sm:backdrop-blur-[5px]">
      <section className="flex h-dvh w-full flex-col bg-gray-50 sm:h-auto sm:min-h-0 sm:max-h-[90vh] sm:max-w-2xl sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
        <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 bg-white shrink-0">
          <div>
            <h2 id="employee-form-title" className="text-lg font-extrabold text-[#0a192f] tracking-tight">{isEdit ? "Edit employee" : "Add employee"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{isEdit ? "Update details, role or access." : "Create a login for a new team member."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><Icon className="w-5 h-5">{icons.close}</Icon></button>
        </header>

        <form onSubmit={submit} className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="crm-field-label sm:col-span-2">Full name<input required maxLength={120} value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Anu Raj" className="crm-input" /></label>
            <label className="crm-field-label">Email<input required type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="anu@ogera.com" className="crm-input" /></label>
            <div className="crm-field-label">
              <label htmlFor="employee-phone">Phone</label>
              <div className={`flex items-center rounded-lg border bg-white shadow-xs transition-colors focus-within:ring-2 ${phoneTouched && values.phone && !INDIAN_MOBILE.test(values.phone) ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/15" : "border-gray-200 hover:border-gray-300 focus-within:border-[#0E4D3A] focus-within:ring-[#0E4D3A]/15"}`}>
                <span className="flex min-h-11 select-none items-center gap-1.5 rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-700">
                  <span aria-hidden="true">🇮🇳</span> +91
                </span>
                <input
                  id="employee-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={values.phone}
                  onChange={(e) => set("phone", toIndianLocal(e.target.value))}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="98765 43210"
                  aria-invalid={phoneTouched && !!values.phone && !INDIAN_MOBILE.test(values.phone)}
                  className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
                />
              </div>
              {phoneTouched && values.phone && !INDIAN_MOBILE.test(values.phone) && (
                <span className="text-[11px] font-medium text-rose-600">Enter a valid Indian mobile number (starts with 6–9).</span>
              )}
            </div>
            <label className="crm-field-label">Role
              <select value={values.role} disabled={isSelf} onChange={(e) => set("role", e.target.value as EmployeeRole)} className="crm-select capitalize">
                {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
              {isSelf && <span className="text-[11px] font-normal text-gray-400">You can&apos;t change your own role.</span>}
            </label>
            <label className="crm-field-label">Branch
              <select value={values.branch} onChange={(e) => set("branch", e.target.value as EmployeeBranch | "")} className="crm-select capitalize">
                <option value="">— Select branch —</option>
                {EMPLOYEE_BRANCHES.map((b) => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
              </select>
            </label>
            <div className="crm-field-label">
              <label htmlFor="employee-password">{isEdit ? "New password" : "Password"}</label>
              <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-xs transition-colors hover:border-gray-300 focus-within:border-[#0E4D3A] focus-within:ring-2 focus-within:ring-[#0E4D3A]/15">
                <input
                  id="employee-password"
                  required={!isEdit}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={values.password}
                  onChange={(e) => { set("password", e.target.value); setCopied(false); }}
                  placeholder={isEdit ? "Leave blank to keep current" : "8+ chars, letter and digit"}
                  className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
                />
                {values.password && (
                  <button type="button" onClick={() => { void navigator.clipboard?.writeText(values.password).then(() => setCopied(true)).catch(() => {}); }} aria-label="Copy password" title={copied ? "Copied" : "Copy password"} className={`p-2 rounded-lg transition-colors ${copied ? "text-emerald-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}>
                    <Icon>{copied ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <><rect width="12" height="12" x="9" y="9" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>}</Icon>
                  </button>
                )}
                <button type="button" onClick={() => setShowPassword((previous) => !previous)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                  <Icon>{showPassword
                    ? <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6a14.6 14.6 0 0 1-3.2 3.6M6.5 7.6A14.4 14.4 0 0 0 2.5 12c1 1.5 4.5 6 9.5 6a9.6 9.6 0 0 0 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
                    : <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></>}</Icon>
                </button>
                <button type="button" onClick={() => { set("password", generatePassword()); setShowPassword(true); setCopied(false); }} aria-label="Generate a strong password" title="Generate a strong password" className="m-1 inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                  <Icon className="w-3.5 h-3.5"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></Icon>
                  Generate
                </button>
              </div>
            </div>

            {isEdit && (
              <label className="sm:col-span-2 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                <span><span className="block font-semibold text-gray-800">Account active</span><span className="block text-xs text-gray-500">{isSelf ? "You can't deactivate your own account." : "Inactive employees can't sign in."}</span></span>
                <input type="checkbox" checked={values.is_active} disabled={isSelf} onChange={(e) => set("is_active", e.target.checked)} className="w-5 h-5 accent-[#0E4D3A]" />
              </label>
            )}

            {error && <p role="alert" className="sm:col-span-2 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</p>}
          </div>

          <footer className="grid grid-cols-2 gap-3 px-4 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end sm:px-6">
            <button type="button" disabled={isSaving} onClick={onClose} className={secondaryButton}>Cancel</button>
            <button type="submit" disabled={isSaving} className={primaryButton}>{isSaving ? "Saving…" : isEdit ? "Save changes" : "Add employee"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  // "" means no filter chosen; the dropdowns then show only their label.
  const [roleFilter, setRoleFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editor, setEditor] = useState<{ employee?: Employee } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const viewer = useMemo<Viewer | null>(() => {
    if (!storedUser) return null;
    try {
      const parsed = JSON.parse(storedUser) as { id?: number; role?: string };
      return typeof parsed.id === "number" && parsed.role ? { id: parsed.id, role: parsed.role } : null;
    } catch { return null; }
  }, [storedUser]);

  const load = useCallback(async (reason: string) => {
    logEvent(`load triggered: ${reason}`, { path: window.location.pathname, online: navigator.onLine });
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setState({ status: "error", error: { kind: "auth", message: "Sign in to view your team." } }); return; }
    setState({ status: "loading" });
    try {
      const { employees } = await listAllEmployees(accessToken);
      setState({ status: "ready", employees, syncedAt: new Date() });
    } catch (error) {
      setState({ status: "error", error: error instanceof ApiError ? error : new ApiError("unknown", "Something went wrong. Please try again.") });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load("page opened"); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Recover automatically when the connection returns after an offline/network failure.
  const failedOffline = state.status === "error" && (state.error.kind === "offline" || state.error.kind === "network");
  useEffect(() => {
    if (!isOnline || !failedOffline) return;
    const timer = window.setTimeout(() => { void load("connection restored"); }, 0);
    return () => window.clearTimeout(timer);
  }, [isOnline, failedOffline, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Close the export dropdown when the user clicks anywhere outside it.
  useEffect(() => {
    if (!exportOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [exportOpen]);

  // Refresh the opened employee from GET /employees/{id} so the dialog is never stale.
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId === undefined) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    let cancelled = false;
    getEmployee(accessToken, selectedId)
      .then((fresh) => { if (!cancelled) setSelected(fresh); })
      .catch(() => { /* keep the list data; the list view surfaces errors */ });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Admin-role accounts are never shown to any viewer (hidden server-side; filtered here for defense-in-depth).
  // Managers additionally cannot see manager-role employees.
  const employees = useMemo(() => {
    const all = state.status === "ready" ? state.employees : [];
    const noAdmins = all.filter((e) => e.role !== "admin");
    return viewer?.role === "manager"
      ? noAdmins.filter((e) => e.role !== "manager")
      : noAdmins;
  }, [state, viewer]);
  // Managers cannot filter by admin or manager role either.
  const roleOptions = useMemo<FilterOption[]>(() => {
    const roles = viewer?.role === "manager"
      ? EMPLOYEE_ROLES.filter((r) => r !== "admin" && r !== "manager")
      : EMPLOYEE_ROLES;
    return [{ value: "", label: "All Roles" }, ...roles.map((role) => ({ value: role, label: roleLabel(role) }))];
  }, [viewer]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) =>
      (!roleFilter || employee.role === roleFilter) &&
      (!branchFilter || employee.branch === branchFilter) &&
      (!term || [employee.name, employee.email, employee.phone ?? "", roleLabel(employee.role), employee.branch ?? ""].some((field) => field.toLowerCase().includes(term))));
  }, [employees, search, roleFilter, branchFilter]);

  const isReady = state.status === "ready";
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function handleSaved(message: string) {
    setEditor(null); setSelected(null); setToast(message); void load("employee saved");
  }

  function clearFilters() {
    setSearch(""); setRoleFilter(""); setBranchFilter(""); setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setDeleteError("Sign in again before deleting."); return; }
    setIsDeleting(true); setDeleteError("");
    try {
      await deleteEmployee(accessToken, deleteTarget.id);
      setToast(`${deleteTarget.name} was removed.`);
      setDeleteTarget(null); setSelected(null); void load("employee deleted");
    } catch (error) {
      if (error instanceof ApiError && error.kind === "invalid_credentials") { router.push("/"); return; }
      setDeleteError(error instanceof ApiError ? error.message : "Employee could not be deleted. Please try again.");
    } finally { setIsDeleting(false); }
  }

  return (
    <div className={`${dmSans.className} flex min-h-full flex-col bg-[#F4FBF7]`}>
      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-[#E7E7EA] bg-white pl-16 pr-3 sm:gap-4 sm:px-7 lg:pl-7">
        <h1 className="truncate text-[22px] font-bold tracking-[-0.01em] text-[#1A1C21] sm:text-[26px]">Employees</h1>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              disabled={!isReady || filtered.length === 0}
              aria-haspopup="true"
              aria-expanded={exportOpen}
              className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#DEE1E5] bg-white px-3.5 text-sm font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50"
            >
              <Icon className="h-4 w-4 shrink-0">{icons.download}</Icon>
              Export
              <Icon className="h-3.5 w-3.5 opacity-60">{icons.chevronDown}</Icon>
            </button>
            {exportOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[160px] rounded-xl border border-[#E7E7EA] bg-white py-1.5 shadow-lg">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { downloadCsv(filtered); setExportOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-[#3A3E4A] hover:bg-[#F3F3F5]"
                >
                  <Icon className="h-4 w-4 shrink-0">{icons.download}</Icon>
                  CSV
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { downloadXls(filtered); setExportOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-[#3A3E4A] hover:bg-[#F3F3F5]"
                >
                  <Icon className="h-4 w-4 shrink-0">{icons.download}</Icon>
                  Excel (.xls)
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setEditor({})} className={`inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-2.5 text-sm font-semibold sm:px-4 ${ACCENT_BUTTON}`} title="Add Employee" aria-label="Add Employee">
            <Icon className="h-4 w-4 shrink-0">{icons.plus}</Icon>
            <span className="hidden sm:inline">Add Employee</span>
          </button>
        </div>
      </header>

      <div className="min-w-0 space-y-4 p-4 sm:px-7 sm:py-6">
        {toast && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><Icon>{icons.active}</Icon> {toast}</p>}

        {!isOnline && isReady && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <Icon>{icons.wifiOff}</Icon> You&apos;re offline — showing the last synced data.
          </p>
        )}

        <section aria-label="Employee list" className="flex flex-col overflow-hidden rounded-[14px] border border-[#E7E7EA] bg-white">
          {/* Toolbar: search, the three filters and refresh */}
          <div className="flex flex-col gap-3 border-b border-[#EFEFF2] p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex w-full items-center lg:w-auto">
              <label className="sr-only" htmlFor="employee-search">Search employees</label>
              <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]">{icons.search}</Icon>
              <input
                id="employee-search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search by name or email…"
                className={`h-[38px] w-full rounded-[8px] border border-[#E1E1E6] bg-white pl-9 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8] lg:w-[260px] ${search ? "pr-9" : "pr-3"}`}
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8A8F9C] hover:text-[#1A1C21]">
                  <Icon className="h-3.5 w-3.5">{icons.close}</Icon>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect fit clearable className="w-auto" label="Role" value={roleFilter} onChange={(value) => { setRoleFilter(value); setPage(1); }} options={roleOptions} />
              <FilterSelect fit clearable className="w-auto" label="Branch" value={branchFilter} onChange={(value) => { setBranchFilter(value); setPage(1); }} options={[
                { value: "", label: "All Branches" },
                ...EMPLOYEE_BRANCHES.map((b) => ({ value: b, label: b.charAt(0).toUpperCase() + b.slice(1) })),
              ]} />
            </div>
          </div>

          {/* Body */}
          {state.status === "loading" ? (
            <SkeletonRows />
          ) : state.status === "error" ? (
            state.error.kind === "auth" || state.error.kind === "invalid_credentials" ? (
              <Notice tone="amber" icon={icons.lock} title="Session expired" body={state.error.message}>
                <button type="button" onClick={() => router.push("/")} className={primaryButton}>Sign in again</button>
              </Notice>
            ) : state.error.kind === "forbidden" ? (
              <Notice tone="amber" icon={icons.lock} title="Access denied" body="Your account isn't allowed to view employees. Ask an admin to update your role." />
            ) : state.error.kind === "offline" || state.error.kind === "network" ? (
              <Notice tone="amber" icon={icons.wifiOff} title={state.error.kind === "offline" ? "You're offline" : "Can't reach the server"} body={`${state.error.message} We'll reload automatically when you're back online.`}>
                <button type="button" onClick={() => void load("Try again button")} className={primaryButton}>Try again</button>
              </Notice>
            ) : (
              <Notice
                tone="rose"
                icon={icons.alert}
                title="Couldn't load employees"
                body={`${state.error.message}${state.error instanceof ApiError && state.error.status ? `  ·  HTTP ${state.error.status}` : ""}`}
              >
                <button type="button" onClick={() => void load("Try again button")} className={primaryButton}>Try again</button>
              </Notice>
            )
          ) : filtered.length === 0 ? (
            <Notice tone="green" icon={icons.users} title={employees.length === 0 ? "No employees yet" : "No matches found"} body={employees.length === 0 ? "Add your first team member to get started." : "Try a different search term or adjust your filters."}>
              {employees.length === 0
                ? <button type="button" onClick={() => setEditor({})} className={primaryButton}><Icon className="h-4 w-4">{icons.plus}</Icon> Add employee</button>
                : <button type="button" onClick={clearFilters} className={secondaryButton}>Clear filters</button>}
            </Notice>
          ) : (
            <>
              {/* Wide screens: the employee table. Smaller screens use the cards below. */}
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="bg-[#F7F7F9] text-left text-[13px] font-medium text-[#4B5060]">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Full name</th>
                      <th scope="col" className="px-3 py-3 font-medium">Email</th>
                      <th scope="col" className="px-3 py-3 font-medium">Role</th>
                      <th scope="col" className="px-3 py-3 font-medium">Branch</th>
                      <th scope="col" className="px-3 py-3 font-medium">Status</th>
                      <th scope="col" className="px-3 py-3 font-medium">Phone number</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((employee) => {
                      const isSelf = employee.id === viewer?.id;
                      const canEdit = true;
                      const canDelete = !isSelf;
                      return (
                        <tr key={employee.id} onClick={() => setSelected(employee)} className="cursor-pointer border-t border-[#EFEFF2] transition-colors hover:bg-[#FAFAFB]">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar employee={employee} size="sm" />
                              <span className="whitespace-nowrap font-semibold text-[#1A1C21]">{employee.name}</span>
                              {isSelf && <span className="rounded-full bg-[#E7F5EE] px-2 py-0.5 text-[11px] font-bold text-[#0E4D3A]">You</span>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3" onClick={stop}>
                            <a href={`mailto:${employee.email}`} className="font-medium text-[#1565D8] hover:underline">{employee.email}</a>
                          </td>
                          <td className="px-3"><RoleBadge role={employee.role} /></td>
                          <td className="whitespace-nowrap px-3 text-sm text-[#3A3E4A] capitalize">{employee.branch ?? <span className="text-[#B4B8C2]">—</span>}</td>
                          <td className="px-3"><StatusPill active={employee.is_active} /></td>
                          <td className="whitespace-nowrap px-3 tabular-nums text-[#1A1C21]">{formatPhone(employee.phone) ?? <span className="text-[#B4B8C2]">Not added</span>}</td>
                          <td className="whitespace-nowrap px-4 text-right" onClick={stop}>
                            {canEdit && (
                              <button type="button" onClick={() => setEditor({ employee })} aria-label={`Edit ${employee.name}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold text-[#4B5060] transition-colors hover:bg-[#E7F5EE] hover:text-[#0E4D3A]">
                                <Icon className="h-3.5 w-3.5">{icons.edit}</Icon> Edit
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(employee); }} aria-label={`Delete ${employee.name}`} className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold text-[#B42323] transition-colors hover:bg-rose-50">
                                <Icon className="h-3.5 w-3.5">{icons.trash}</Icon> Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:hidden">
                {pageRows.map((employee) => {
                  const canEdit = true;
                  const canDelete = employee.id !== viewer?.id;
                  return (
                    <article key={employee.id} className="relative rounded-xl border border-[#E7E7EA] bg-white transition-colors hover:border-[#7EE2A8]">
                      <button type="button" onClick={() => setSelected(employee)} className="block w-full rounded-xl p-4 text-left focus-visible:outline-2 focus-visible:outline-[#0E4D3A]">
                        <div className="flex items-center gap-3">
                          <Avatar employee={employee} />
                          <div className="min-w-0 flex-1 pr-16">
                            <h3 className="flex items-center gap-2 text-[14px] font-semibold leading-snug text-[#1A1C21]">
                              <span className="truncate">{employee.name}</span>
                              {employee.id === viewer?.id && <span className="shrink-0 rounded-full bg-[#E7F5EE] px-1.5 py-0.5 text-[10px] font-bold text-[#0E4D3A]">You</span>}
                            </h3>
                            <p className="mt-0.5 truncate text-[12px] text-[#6B7080]">{employee.email}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <RoleBadge role={employee.role} />
                          <StatusPill active={employee.is_active} />
                          {employee.branch && (
                            <span className="inline-flex items-center whitespace-nowrap rounded-[6px] bg-[#F0F7FF] px-2.5 py-[3px] text-xs font-semibold capitalize text-[#1D5BBF]">{employee.branch}</span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#6B7080]">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[#8A8F9C]">{icons.phone}</Icon>
                          <span className="truncate">{formatPhone(employee.phone) ?? "No phone added"}</span>
                        </div>
                        <div className="mt-3 border-t border-[#EFEFF2] pt-2.5 text-[11px] font-medium text-[#8A8F9C]">Joined {formatJoined(employee.created_at)}</div>
                      </button>
                      {canEdit && (
                        <div className="absolute right-3 top-3.5 flex gap-1">
                          <button type="button" onClick={() => setEditor({ employee })} aria-label={`Edit ${employee.name}`} title="Edit" className="rounded-md p-1.5 text-[#8A8F9C] transition-colors hover:bg-[#E7F5EE] hover:text-[#0E4D3A]">
                            <Icon className="h-3.5 w-3.5">{icons.edit}</Icon>
                          </button>
                          {canDelete && (
                            <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(employee); }} aria-label={`Delete ${employee.name}`} title="Delete" className="rounded-md p-1.5 text-[#8A8F9C] transition-colors hover:bg-rose-50 hover:text-rose-600">
                              <Icon className="h-3.5 w-3.5">{icons.trash}</Icon>
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-3 py-3 sm:px-4 sm:py-3.5" aria-label="Employees pagination">
                <p className="text-sm text-[#3A3E4A]">Showing {rangeStart} to {rangeEnd} of {filtered.length.toLocaleString()} employees{filtered.length !== employees.length ? ` (filtered from ${employees.length})` : ""}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:cursor-not-allowed disabled:opacity-40">
                    <Icon className="h-3.5 w-3.5" >{icons.chevronLeft}</Icon>
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      aria-label={`Page ${pageNumber}`}
                      aria-current={pageNumber === currentPage ? "page" : undefined}
                      className={`h-9 min-w-9 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors ${pageNumber === currentPage ? ACCENT_BUTTON : "border border-[#E1E1E6] bg-white text-[#3A3E4A] hover:bg-[#F3F3F5]"}`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B3E2F] disabled:cursor-not-allowed disabled:opacity-40">
                    Next
                    <Icon className="h-3.5 w-3.5">{icons.chevronRight}</Icon>
                  </button>
                </div>
              </nav>
            </>
          )}
        </section>
      </div>

      {/* Detail dialog */}
      {selected && viewer && (
        <div className="fixed inset-0 z-[1100] bg-white overflow-y-auto sm:grid sm:place-items-center sm:p-4 sm:bg-[rgba(17,18,20,0.45)] sm:backdrop-blur-[5px]" onClick={() => setSelected(null)}>
          <section onClick={(event) => event.stopPropagation()} className="flex min-h-dvh w-full flex-col bg-gray-50 sm:min-h-0 sm:max-h-[90vh] sm:max-w-lg sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="employee-title">
            <header className="relative overflow-hidden bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] px-5 pt-5 pb-6 text-white shrink-0">
              <div className="pointer-events-none absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="absolute top-4 right-4 z-10 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><Icon className="w-5 h-5">{icons.close}</Icon></button>
              <div className="relative flex items-center gap-4 pr-10">
                <Avatar employee={selected} size="lg" />
                <div className="min-w-0">
                  <h2 id="employee-title" className="text-xl font-extrabold tracking-tight truncate">{selected.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-extrabold uppercase tracking-wider">{roleLabel(selected.role)}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${selected.is_active ? "text-emerald-300" : "text-rose-300"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selected.is_active ? "bg-emerald-400" : "bg-rose-400"}`} />{selected.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <dl className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
                {[
                  { label: "Email", value: selected.email },
                  { label: "Phone", value: formatPhone(selected.phone) ?? "Not added" },
                  { label: "Branch", value: selected.branch ? selected.branch.charAt(0).toUpperCase() + selected.branch.slice(1) : "Not assigned" },
                  { label: "Member since", value: formatDate(selected.created_at) },
                  { label: "Last updated", value: formatDate(selected.updated_at) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt className="text-gray-500">{row.label}</dt>
                    <dd className="font-semibold text-gray-900 truncate">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <footer className="grid grid-cols-2 gap-3 px-5 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end">
              {selected.id !== viewer.id && (
                <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(selected); }} className="min-h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"><Icon>{icons.trash}</Icon> Delete</button>
              )}
              <button type="button" onClick={() => setEditor({ employee: selected })} className={primaryButton}><Icon>{icons.edit}</Icon> Edit</button>
            </footer>
          </section>
        </div>
      )}

      {editor && viewer && <EmployeeFormDialog employee={editor.employee} viewer={viewer} onClose={() => setEditor(null)} onSaved={handleSaved} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-[1110] grid place-items-center overflow-y-auto p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[5px]">
          <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="delete-employee-title">
            <div className="px-6 pt-6">
              <h2 id="delete-employee-title" className="text-lg font-extrabold text-[#0a192f]">Delete employee?</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed"><strong className="text-gray-900">{deleteTarget.name}</strong> will no longer be able to sign in. Their email stays reserved and their records are kept.</p>
              {deleteError && <p role="alert" className="mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{deleteError}</p>}
            </div>
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)} className={secondaryButton}>Cancel</button>
              <button type="button" disabled={isDeleting} onClick={() => void confirmDelete()} className="min-h-11 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">{isDeleting ? "Deleting…" : "Delete employee"}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
