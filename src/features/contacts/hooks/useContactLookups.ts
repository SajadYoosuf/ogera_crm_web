"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { canManageEmployees, listAllEmployees, type Employee } from "@/lib/api/employees";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";
import { listLeadSources, listProfessionTypes, type LeadSource, type ProfessionOption } from "@/features/contacts/api/contacts";
import { DEFAULT_PARTNER_TYPES, KERALA_DISTRICTS } from "@/features/contacts/utils";

/** Reference data the contacts screens need: lead sources, partner types, districts, and the employee list for admins and managers. */
export function useContactLookups() {
  // Districts are managed in Settings; the built-in Kerala list shows until they load.
  const { options: districtRows } = useEnumOptions("district", staticOptions(KERALA_DISTRICTS.map((name) => ({ value: name, label: name }))));
  const districtNames = useMemo(() => districtRows.map((row) => row.label), [districtRows]);

  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<ProfessionOption[]>(DEFAULT_PARTNER_TYPES);

  // Sources are loaded once on page open; both the filters and the form use them.
  useEffect(() => {
    if (leadSources.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listLeadSources(accessToken).then(setLeadSources).catch(() => { /* the dropdown falls back to the current value only */ });
  }, [leadSources.length]);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listProfessionTypes(accessToken).then(setPartnerTypes).catch(() => { /* keeps the built-in list */ });
  }, []);

  // sessionStorage is browser-only, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const viewerRole = useMemo(() => { try { return (JSON.parse(storedUser ?? "null") as { role?: string } | null)?.role; } catch { return undefined; } }, [storedUser]);

  // Only admins and managers may read the employee list, so only they can change the owner.
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesFailed, setEmployeesFailed] = useState(false);
  const canAssign = canManageEmployees(viewerRole) && !employeesFailed;
  useEffect(() => {
    if (!canAssign || employees.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listAllEmployees(accessToken).then((result) => setEmployees(result.employees)).catch(() => setEmployeesFailed(true));
  }, [canAssign, employees.length]);

  return { leadSources, partnerTypes, districtNames, employees, viewerRole, canAssign };
}
