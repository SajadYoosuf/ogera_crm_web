"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllEmployees, type Employee } from "@/lib/api/employees";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";
import { listLeadSources, listProfessionTypes, type LeadSource, type ProfessionOption } from "@/features/contacts/api/contacts";
import { listProducts, type ProductListItem } from "@/lib/api/products";
import { DEFAULT_HOUSE_STAGES, DEFAULT_PARTNER_TYPES, DEFAULT_TANK_TYPES, KERALA_DISTRICTS } from "@/features/contacts/utils";

/** Reference data the contacts screens need: lead sources, partner types, districts, house stages, and the employee list. */
export function useContactLookups() {
  // Districts are managed in Settings; the built-in Kerala list shows until they load.
  const { options: districtRows } = useEnumOptions("district", staticOptions(KERALA_DISTRICTS.map((name) => ({ value: name, label: name }))));
  const districtNames = useMemo(() => districtRows.map((row) => row.label), [districtRows]);
  // House stages are managed in Settings too. The form sends the stored value (e.g. "under_construction"), not the label.
  const { options: houseStageRows, labelOf: houseStageLabel } = useEnumOptions("house_stage", staticOptions(DEFAULT_HOUSE_STAGES));
  const houseStages = useMemo(() => houseStageRows.map((row) => ({ value: row.value, label: row.label })), [houseStageRows]);
  // Tank types from Settings > Lists & Options.
  const { options: tankTypeRows, labelOf: tankTypeLabel } = useEnumOptions("tank_type", staticOptions(DEFAULT_TANK_TYPES));
  const tankTypes = useMemo(() => tankTypeRows.map((row) => ({ value: row.value, label: row.label })), [tankTypeRows]);

  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<ProfessionOption[]>(DEFAULT_PARTNER_TYPES);
  const [products, setProducts] = useState<ProductListItem[]>([]);

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

  // Active products for the "interested products" picker in the contact form.
  // A limit of 200 covers all typical catalogues; archived products are excluded here
  // but existing interested products from a contact's detail are shown regardless.
  useEffect(() => {
    if (products.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listProducts(accessToken, { isActive: true, limit: 200 }).then((result) => setProducts(result.items)).catch(() => {});
  }, [products.length]);

  // The owner picker needs the employee list; if it fails to load, the picker is hidden.
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesFailed, setEmployeesFailed] = useState(false);
  const canAssign = !employeesFailed;
  useEffect(() => {
    if (!canAssign || employees.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listAllEmployees(accessToken).then((result) => setEmployees(result.employees)).catch(() => setEmployeesFailed(true));
  }, [canAssign, employees.length]);

  return { leadSources, partnerTypes, districtNames, houseStages, houseStageLabel, tankTypes, tankTypeLabel, employees, canAssign, products };
}
