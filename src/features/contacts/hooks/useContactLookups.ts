"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllEmployees, type Employee } from "@/lib/api/employees";
import { KERALA_DISTRICTS } from "@/features/contacts/utils";
import { listLeadSources, listPartnerTypes, listContactFieldDefinitions, listBranches, type LeadSource, type PartnerTypeOption, type ContactFieldDefinition, type BranchOption } from "@/features/contacts/api/contacts";

/*
 * useContactLookups — loads all reference data the contacts screens need.
 *
 * WHAT IT LOADS:
 *   - consumerFields / partnerFields: field definitions from GET /contact-field-definitions
 *     These tell the form which fields to render, what type they are (dropdown/number/text),
 *     and what dropdown options are valid. This replaces the old hardcoded DEFAULT_HOUSE_STAGES
 *     and DEFAULT_TANK_TYPES approach.
 *   - leadSources: for the Source picker on the contact form
 *   - partnerTypes: for the partner type dropdown (from GET /contacts/partner-types)
 *   - districtNames: Kerala districts for the district filter
 *   - employees: for the Assigned To picker
 *
 * HOW FIELD DEFINITIONS WORK:
 *   Each ContactFieldDefinition has:
 *     field_name  → the key in the JSONB data dict (e.g. "tank_type")
 *     field_label → what to show in the UI (e.g. "Tank Type")
 *     field_type  → "dropdown" | "number" | "text" | "boolean"
 *     options     → for dropdowns: ["plastic", "steel", "fiber", ...]
 *     is_required → whether the form should mark it required
 *
 *   The form iterates over the returned definitions and renders the right input type for each.
 */

export function useContactLookups() {
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<PartnerTypeOption[]>([]);
  const [consumerFields, setConsumerFields] = useState<ContactFieldDefinition[]>([]);
  const [partnerFields, setPartnerFields] = useState<ContactFieldDefinition[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesFailed, setEmployeesFailed] = useState(false);
  const canAssign = !employeesFailed;

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;

    listLeadSources(accessToken).then(setLeadSources).catch(() => {});
    listPartnerTypes(accessToken).then(setPartnerTypes).catch(() => {});
    listContactFieldDefinitions(accessToken, "consumer").then(setConsumerFields).catch(() => {});
    listContactFieldDefinitions(accessToken, "partner").then(setPartnerFields).catch(() => {});
    listBranches(accessToken).then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canAssign || employees.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listAllEmployees(accessToken)
      .then((result) => setEmployees(result.employees))
      .catch(() => setEmployeesFailed(true));
  }, [canAssign, employees.length]);

  // Kerala districts are the standard list; not managed via field definitions.
  const districtNames = useMemo(() => KERALA_DISTRICTS, []);

  return { leadSources, partnerTypes, consumerFields, partnerFields, branches, districtNames, employees, canAssign };
}
