"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/auth";
import {
  assignableRoles, canManageEmployees, canModifyEmployee, createEmployee, deleteEmployee, getEmployee,
  listAllEmployees, logEvent, updateEmployee, EMPLOYEE_ROLES, isPrivilegedRole, type Employee, type EmployeeRole, type EmployeeUpdate,
} from "@/lib/api/employees";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import FilterSelect, { type FilterOption } from "@/components/FilterSelect";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: ApiError | { kind: "auth"; message: string } }
  | { status: "ready"; employees: Employee[]; syncedAt: Date };

type Viewer = { id: number; role: string };
type FormValues = { name: string; email: string; phone: string; role: EmployeeRole; is_field_staff: boolean; is_active: boolean; password: string };

const AVATAR_GRADIENTS = [
  "from-blue-500 to-blue-700", "from-cyan-500 to-blue-600", "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600",
];
const ROLE_STYLES: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700 border-violet-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  team_lead: "bg-cyan-50 text-cyan-700 border-cyan-200",
  sales_executive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  tele_caller: "bg-amber-50 text-amber-700 border-amber-200",
  field_executive: "bg-orange-50 text-orange-700 border-orange-200",
  support: "bg-rose-50 text-rose-700 border-rose-200",
};

/** Roles that never work on-site, so the "Field staff" option is not offered for them. */
const NON_FIELD_ROLES: readonly string[] = ["admin", "manager", "tele_caller", "support"];

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

const primaryButton = "inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 active:scale-[.98] disabled:opacity-60 transition-all";
const secondaryButton = "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors";

function Icon({ children, className = "w-4 h-4" }: { children: React.ReactNode; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const icons = {
  users: <><circle cx="9" cy="8" r="3.25" /><path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" /><path d="M16 4.6a3.25 3.25 0 0 1 0 6.3" /><path d="M18 14.3a4 4 0 0 1 3 3.7v1" /></>,
  active: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  field: <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
  mail: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="m2 7 10 6.5L22 7" /></>,
  search: <><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-3M4 5v3.5h3.5" /><path d="M4 13a8 8 0 0 0 14.9 3M20 19v-3.5h-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  wifiOff: <><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10 5.1" /><path d="M5 12.9a10 10 0 0 1 3.2-2M19 12.9a10 10 0 0 0-3.4-2.1" /><path d="M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></>,
  lock: <><rect width="16" height="11" x="4" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
};

function Avatar({ employee, size = "md" }: { employee: Employee; size?: "md" | "lg" }) {
  const dimension = size === "lg" ? "w-16 h-16 text-xl" : "w-12 h-12 text-sm";
  return (
    <span className={`${dimension} shrink-0 rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[employee.id % AVATAR_GRADIENTS.length]} text-white font-extrabold flex items-center justify-center shadow-md shadow-slate-900/10 ring-2 ring-white ${employee.is_active ? "" : "grayscale opacity-70"}`}>
      {initials(employee.name)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${ROLE_STYLES[role] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{roleLabel(role)}</span>;
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${active ? "text-emerald-600" : "text-rose-500"}`}><span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"}`} />{active ? "Active" : "Inactive"}</span>;
}

function StateCard({ tone, icon, title, body, children }: { tone: "rose" | "amber" | "blue"; icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  const toneClass = { rose: "bg-rose-50 text-rose-600", amber: "bg-amber-50 text-amber-600", blue: "bg-blue-50 text-blue-600" }[tone];
  return (
    <div role="status" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
      <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${toneClass}`}><Icon className="w-7 h-7">{icon}</Icon></span>
      <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{body}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading employees">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-gray-200" />
            <div className="flex-1 space-y-2.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /><div className="h-3 w-1/3 rounded bg-gray-100" /></div>
          </div>
          <div className="mt-5 space-y-2"><div className="h-3 w-3/4 rounded bg-gray-100" /><div className="h-3 w-1/2 rounded bg-gray-100" /></div>
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
  const roles = useMemo(() => {
    const options = assignableRoles(viewer.role);
    return employee && !options.includes(employee.role as EmployeeRole) ? [employee.role as EmployeeRole, ...options] : options;
  }, [viewer.role, employee]);
  const [values, setValues] = useState<FormValues>({
    name: employee?.name ?? "", email: employee?.email ?? "", phone: toIndianLocal(employee?.phone),
    role: (employee?.role as EmployeeRole) ?? "sales_executive", is_field_staff: employee?.is_field_staff ?? false,
    is_active: employee?.is_active ?? true, password: "",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const showFieldStaff = !NON_FIELD_ROLES.includes(values.role);
  // Switching to a role without the option also clears any previously ticked value.
  const changeRole = (role: EmployeeRole) => setValues((current) => ({ ...current, role, is_field_staff: NON_FIELD_ROLES.includes(role) ? false : current.is_field_staff }));

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
        if (values.is_field_staff !== employee.is_field_staff) patch.is_field_staff = values.is_field_staff;
        if (values.is_active !== employee.is_active) patch.is_active = values.is_active;
        if (values.password) patch.password = values.password;
        if (Object.keys(patch).length > 0) await updateEmployee(accessToken, employee.id, patch);
        onSaved(Object.keys(patch).length > 0 ? `${values.name.trim()} was updated.` : "No changes to save.");
      } else {
        await createEmployee(accessToken, {
          name: values.name.trim(), email: values.email.trim(), role: values.role,
          is_field_staff: values.is_field_staff, password: values.password,
          ...(values.phone ? { phone: `+91${values.phone}` } : {}),
        });
        onSaved(`${values.name.trim()} was added to the team.`);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setError(caught instanceof ApiError ? caught.message : "Employee could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto sm:grid sm:place-items-center sm:p-4 sm:bg-slate-900/50 sm:backdrop-blur-xs">
      <section className="flex min-h-dvh w-full flex-col bg-gray-50 sm:min-h-0 sm:max-h-[90vh] sm:max-w-2xl sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
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
              <div className={`flex items-center rounded-lg border bg-white shadow-xs transition-colors focus-within:ring-2 ${phoneTouched && values.phone && !INDIAN_MOBILE.test(values.phone) ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/15" : "border-gray-200 hover:border-gray-300 focus-within:border-blue-600 focus-within:ring-blue-600/15"}`}>
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
              <select value={values.role} disabled={isSelf} onChange={(e) => changeRole(e.target.value as EmployeeRole)} className="crm-select capitalize">
                {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
              {isSelf && <span className="text-[11px] font-normal text-gray-400">You can&apos;t change your own role.</span>}
            </label>
            <div className="crm-field-label">
              <label htmlFor="employee-password">{isEdit ? "New password" : "Password"}</label>
              <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-xs transition-colors hover:border-gray-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15">
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

            {showFieldStaff && <label className="sm:col-span-2 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              <span><span className="block font-semibold text-gray-800">Field staff</span><span className="block text-xs text-gray-500">Works on-site — visits, measurements, installs.</span></span>
              <input type="checkbox" checked={values.is_field_staff} onChange={(e) => set("is_field_staff", e.target.checked)} className="w-5 h-5 accent-blue-600" />
            </label>}
            {isEdit && (
              <label className="sm:col-span-2 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                <span><span className="block font-semibold text-gray-800">Account active</span><span className="block text-xs text-gray-500">{isSelf ? "You can't deactivate your own account." : "Inactive employees can't sign in."}</span></span>
                <input type="checkbox" checked={values.is_active} disabled={isSelf} onChange={(e) => set("is_active", e.target.checked)} className="w-5 h-5 accent-blue-600" />
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
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editor, setEditor] = useState<{ employee?: Employee } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState("");

  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const isHydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const viewer = useMemo<Viewer | null>(() => {
    if (!storedUser) return null;
    try {
      const parsed = JSON.parse(storedUser) as { id?: number; role?: string };
      return typeof parsed.id === "number" && parsed.role ? { id: parsed.id, role: parsed.role } : null;
    } catch { return null; }
  }, [storedUser]);
  const canView = canManageEmployees(viewer?.role);

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
    if (!canView) return;
    const timer = window.setTimeout(() => { void load("page opened"); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, load]);

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

  const employees = useMemo(() => state.status === "ready" ? state.employees : [], [state]);
  // Every role is always offered; counts show how many employees hold each one.
  const roleOptions = useMemo<FilterOption[]>(() => [
    { value: "all", label: "All roles", count: employees.length },
    ...EMPLOYEE_ROLES.map((role) => ({ value: role, label: roleLabel(role), count: employees.filter((employee) => employee.role === role).length })),
  ], [employees]);
  const statusOptions = useMemo<FilterOption[]>(() => [
    { value: "all", label: "All statuses", count: employees.length },
    { value: "active", label: "Active", count: employees.filter((employee) => employee.is_active).length, dot: "bg-emerald-500" },
    { value: "inactive", label: "Inactive", count: employees.filter((employee) => !employee.is_active).length, dot: "bg-rose-500" },
  ], [employees]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) =>
      (roleFilter === "all" || employee.role === roleFilter) &&
      (statusFilter === "all" || (statusFilter === "active") === employee.is_active) &&
      (!term || [employee.name, employee.email, employee.phone ?? "", roleLabel(employee.role)].some((field) => field.toLowerCase().includes(term))));
  }, [employees, search, roleFilter, statusFilter]);

  const totals = useMemo(() => ({
    team: employees.length,
    active: employees.filter((employee) => employee.is_active).length,
    field: employees.filter((employee) => employee.is_field_staff).length,
    leaders: employees.filter((employee) => isPrivilegedRole(employee.role)).length,
  }), [employees]);
  const isReady = state.status === "ready";

  function handleSaved(message: string) {
    setEditor(null); setSelected(null); setToast(message); void load("employee saved");
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

  if (isHydrated && !canView) {
    return (
      <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
        <StateCard tone="amber" icon={icons.lock} title="Restricted area" body="The employee directory is available to admins and managers only." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
        <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
        <div className="relative p-5 sm:p-7 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" /> Team directory
              </p>
              <h1 className="mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Employees</h1>
              <p className="mt-2 text-sm sm:text-[15px] text-white/65 leading-relaxed">Manage who can sign in to Ogera CRM — add team members, set their roles and keep access up to date.</p>
            </div>
            <div className="grid grid-cols-2 sm:flex gap-3 shrink-0">
              <button type="button" onClick={() => void load("Refresh button")} disabled={state.status === "loading"} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-white/20 bg-white/10 backdrop-blur text-sm font-semibold text-white hover:bg-white/20 active:scale-[.98] disabled:opacity-60 transition-all">
                <Icon className={`w-4 h-4 ${state.status === "loading" ? "animate-spin" : ""}`}>{icons.refresh}</Icon> Refresh
              </button>
              <button type="button" onClick={() => setEditor({})} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-white text-[#0a192f] text-sm font-bold shadow-lg shadow-black/20 hover:bg-sky-50 active:scale-[.98] transition-all">
                <Icon>{icons.plus}</Icon> Add employee
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Team members", value: totals.team, icon: icons.users },
              { label: "Active accounts", value: totals.active, icon: icons.active },
              { label: "Field staff", value: totals.field, icon: icons.field },
              { label: "Admins & managers", value: totals.leaders, icon: icons.shield },
            ].map((tile) => (
              <div key={tile.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] backdrop-blur px-4 py-3.5">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-white/10 text-sky-300 flex items-center justify-center"><Icon className="w-5 h-5">{tile.icon}</Icon></span>
                <div className="min-w-0">
                  <dd className="text-2xl font-extrabold leading-none tracking-tight">{isReady ? tile.value.toLocaleString() : "—"}</dd>
                  <dt className="mt-1.5 text-[11px] font-semibold text-white/50 truncate">{tile.label}</dt>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {toast && <p role="status" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800"><Icon>{icons.active}</Icon> {toast}</p>}

      {/* Toolbar */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center h-11 w-full xl:max-w-sm rounded-xl border border-gray-200 bg-gray-50 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="employee-search">Search employees</label>
          <Icon className="w-4 h-4 ml-3.5 mr-2 shrink-0 text-gray-400">{icons.search}</Icon>
          <input id="employee-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, phone or role" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="p-2 mr-1 text-gray-400 hover:text-gray-700"><Icon>{icons.close}</Icon></button>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")} options={statusOptions} icon={icons.active} />
          <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter} options={roleOptions} icon={icons.shield} />
        </div>
      </section>

      {!isOnline && isReady && (
        <p role="status" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <Icon>{icons.wifiOff}</Icon> You&apos;re offline — showing the last synced data.
        </p>
      )}

      {/* Content */}
      {state.status === "loading" ? (
        <SkeletonGrid />
      ) : state.status === "error" ? (
        state.error.kind === "auth" || state.error.kind === "invalid_credentials" ? (
          <StateCard tone="amber" icon={icons.lock} title="Session expired" body={state.error.message}>
            <button type="button" onClick={() => router.push("/")} className={primaryButton}>Sign in again</button>
          </StateCard>
        ) : state.error.kind === "forbidden" ? (
          <StateCard tone="amber" icon={icons.lock} title="Access denied" body="Your account isn't allowed to view employees. Ask an admin to update your role." />
        ) : state.error.kind === "offline" || state.error.kind === "network" ? (
          <StateCard tone="amber" icon={icons.wifiOff} title={state.error.kind === "offline" ? "You're offline" : "Can't reach the server"} body={`${state.error.message} We'll reload automatically when you're back online.`}>
            <button type="button" onClick={() => void load("Try again button")} className={primaryButton}>Try again</button>
          </StateCard>
        ) : (
          <StateCard tone="rose" icon={icons.alert} title="Couldn't load employees" body={state.error.message}>
            <button type="button" onClick={() => void load("Try again button")} className={primaryButton}>Try again</button>
          </StateCard>
        )
      ) : filtered.length === 0 ? (
        <StateCard tone="blue" icon={icons.users} title={employees.length === 0 ? "No employees yet" : "No matches found"} body={employees.length === 0 ? "Add your first team member to get started." : "Try a different search term or filter."}>
          {employees.length === 0
            ? <button type="button" onClick={() => setEditor({})} className={primaryButton}><Icon>{icons.plus}</Icon> Add employee</button>
            : <button type="button" onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }} className={secondaryButton}>Clear filters</button>}
        </StateCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{filtered.length} {filtered.length === 1 ? "employee" : "employees"}</span>
            <span>Synced {state.syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((employee) => {
              const canEdit = !!viewer && canModifyEmployee(viewer, employee);
              const canDelete = canEdit && employee.id !== viewer?.id;
              return (
                <div key={employee.id} className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 hover:-translate-y-0.5 transition-all">
                  <button type="button" onClick={() => setSelected(employee)} className="block w-full text-left p-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-blue-600">
                  <div className="flex items-start gap-4">
                    <Avatar employee={employee} />
                    <div className={`min-w-0 flex-1 ${canEdit ? "pr-[4.5rem]" : ""}`}>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#0a192f] truncate group-hover:text-blue-700 transition-colors">{employee.name}</h3>
                        {employee.id === viewer?.id && <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-extrabold uppercase tracking-wider">You</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <RoleBadge role={employee.role} />
                        <StatusDot active={employee.is_active} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-gray-500">
                    <p className="flex items-center gap-2 truncate"><Icon className="w-3.5 h-3.5 shrink-0 text-gray-400">{icons.mail}</Icon><span className="truncate">{employee.email}</span></p>
                    <p className="flex items-center gap-2 truncate"><Icon className="w-3.5 h-3.5 shrink-0 text-gray-400">{icons.phone}</Icon><span className="truncate">{formatPhone(employee.phone) ?? "No phone added"}</span></p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-400">
                    <span>Joined {formatDate(employee.created_at)}</span>
                    {employee.is_field_staff && <span className="inline-flex items-center gap-1 text-orange-600"><Icon className="w-3.5 h-3.5">{icons.field}</Icon> Field staff</span>}
                  </div>
                  </button>
                  {canEdit && (
                    <div className="absolute top-4 right-4 flex gap-1">
                      <button type="button" onClick={() => setEditor({ employee })} aria-label={`Edit ${employee.name}`} title="Edit" className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Icon>{icons.edit}</Icon>
                      </button>
                      {canDelete && (
                        <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(employee); }} aria-label={`Delete ${employee.name}`} title="Delete" className="p-2 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                          <Icon>{icons.trash}</Icon>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Detail dialog */}
      {selected && viewer && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto sm:grid sm:place-items-center sm:p-4 sm:bg-slate-900/50 sm:backdrop-blur-xs" onClick={() => setSelected(null)}>
          <section onClick={(event) => event.stopPropagation()} className="flex min-h-dvh w-full flex-col bg-gray-50 sm:min-h-0 sm:max-h-[90vh] sm:max-w-lg sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="employee-title">
            <header className="relative overflow-hidden bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] px-5 pt-5 pb-6 text-white shrink-0">
              <div className="pointer-events-none absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="absolute top-4 right-4 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><Icon className="w-5 h-5">{icons.close}</Icon></button>
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
                  { label: "Field staff", value: selected.is_field_staff ? "Yes" : "No" },
                  { label: "Member since", value: formatDate(selected.created_at) },
                  { label: "Last updated", value: formatDate(selected.updated_at) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt className="text-gray-500">{row.label}</dt>
                    <dd className="font-semibold text-gray-900 truncate">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {!canModifyEmployee(viewer, selected) && (
                <p className="mt-4 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">Only an admin can modify another admin or manager.</p>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-3 px-5 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end">
              {canModifyEmployee(viewer, selected) && selected.id !== viewer.id && (
                <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(selected); }} className="min-h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"><Icon>{icons.trash}</Icon> Delete</button>
              )}
              {canModifyEmployee(viewer, selected) && (
                <button type="button" onClick={() => setEditor({ employee: selected })} className={primaryButton}><Icon>{icons.edit}</Icon> Edit</button>
              )}
              {!canModifyEmployee(viewer, selected) && <a href={`mailto:${selected.email}`} className={secondaryButton}><Icon>{icons.mail}</Icon> Email</a>}
            </footer>
          </section>
        </div>
      )}

      {editor && viewer && <EmployeeFormDialog employee={editor.employee} viewer={viewer} onClose={() => setEditor(null)} onSaved={handleSaved} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-xs">
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
