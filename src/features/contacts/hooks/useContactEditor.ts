"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { type PickerItem } from "@/components/SearchPicker";
import { validatePhone } from "@/components/PhoneField";
import { ApiError } from "@/lib/api/auth";
import { createContact, deleteContact as deleteContactApi, getContact, listContacts, updateContact, type ContactFieldDefinition, type DealerProfileInput, type LeadSource } from "@/features/contacts/api/contacts";
import { blankContact, toCamel, toForm, KIND_LABELS, type Contact, type ContactForm } from "@/features/contacts/utils";

type Editor = { contact?: Contact; values: ContactForm; loading?: boolean } | null;

/** Add / edit / delete for one contact. `onSaved` refreshes the list after a change. */
export function useContactEditor({ leadSources, onSaved, consumerFields = [], partnerFields = [] }: { leadSources: LeadSource[]; onSaved: () => Promise<void> | void; consumerFields?: ContactFieldDefinition[]; partnerFields?: ContactFieldDefinition[] }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<PickerItem | null>(null);
  // Set when the page was opened from another page's "Add" button; the modal then hands the user back there.
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Older records store "showroom" / "Meta" etc.; match them to a real source by name or slug, and keep unknown values selectable.
  const currentSource = editor?.values.source ?? "";
  const matchedSource = leadSources.find((item) => item.name.toLowerCase() === currentSource.toLowerCase() || item.slug === currentSource.toLowerCase());
  const sourceValue = matchedSource?.name ?? currentSource;

  const updateForm = <Field extends keyof ContactForm>(field: Field, value: ContactForm[Field]) =>
    setEditor((current) => current ? { ...current, values: { ...current.values, [field]: value } } : current);

  const openEditor = (contact?: Contact, initialType?: string) => {
    setFormError("");
    setSelectedReferral(null);
    const showroomSource = leadSources.find((item) => item.slug === "showroom");
    const newValues = {
      ...(initialType ? { ...blankContact, contactType: initialType as typeof blankContact.contactType } : blankContact),
      ...(showroomSource ? { source: showroomSource.name } : {}),
      district: "Malappuram",
    };
    setEditor(contact ? { contact, values: toForm(contact), loading: true } : { values: newValues });
    if (!contact) return;
    // List rows lack the referrer and house stage, so load the full record.
    if (!token) { setEditor((current) => current ? { ...current, loading: false } : current); return; }
    getContact(token, contact.id)
      .then((detail) => {
        if (detail.referred_by) setSelectedReferral({ id: detail.referred_by.id, primary: detail.referred_by.name, secondary: detail.referred_by.phone ?? undefined });
        // Populate consumer / partner profile data dynamically from field definitions.
        const consumerProfileValues = Object.fromEntries(
          (consumerFields.length > 0 ? consumerFields : [
            { field_name: "house_stage" }, { field_name: "tank_type" }, { field_name: "tank_capacity" }, { field_name: "tank_age" },
          ]).map((f) => {
            const raw = detail.consumer_profile?.data?.[f.field_name];
            return [toCamel(f.field_name), raw != null ? String(raw) : ""];
          }),
        );
        const partnerProfileValues = Object.fromEntries(
          (partnerFields.length > 0 ? partnerFields : [
            { field_name: "partner_type" }, { field_name: "work_area" },
          ]).map((f) => {
            const raw = detail.partner_profile?.data?.[f.field_name];
            return [toCamel(f.field_name), raw != null ? String(raw) : ""];
          }),
        );
        setEditor((current) => current?.contact?.id === contact.id ? {
          ...current, loading: false,
          values: {
            ...current.values,
            branchId: detail.branch_id ?? null,
            district: detail.district, address: detail.address ?? "",
            ...consumerProfileValues,
            ...partnerProfileValues,
            dealerBusinessName: detail.dealer_profile?.business_name ?? "",
            dealerGstin: detail.dealer_profile?.gstin ?? "",
            dealerType: detail.dealer_profile?.dealer_type ?? "",
            dealerTownCity: detail.dealer_profile?.town_city ?? "",
            dealerPinCode: detail.dealer_profile?.pin_code ?? "",
            dealerAssignedRep: detail.dealer_profile?.assigned_rep != null ? String(detail.dealer_profile.assigned_rep) : "",
            dealerCreditLimit: detail.dealer_profile?.credit_limit != null ? String(detail.dealer_profile.credit_limit) : "",
            dealerOutstandingBalance: detail.dealer_profile?.outstanding_balance != null ? String(detail.dealer_profile.outstanding_balance) : "",
            referredByContactId: detail.referred_by_id,
            note: detail.notes ?? "",
          },
        } : current);
      })
      .catch((caught) => {
        setEditor((current) => current?.contact?.id === contact.id ? { ...current, loading: false } : current);
        setFormError(caught instanceof ApiError ? caught.message : "Contact details could not be loaded.");
      });
  };

  // /contacts?add=1&returnTo=/some/page opens the add form straight away.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("add") !== "1") return;
      const back = params.get("returnTo");
      setReturnTo(back && back.startsWith("/") && !back.startsWith("//") ? back : null);
      openEditor();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const closeEditor = () => { setEditor(null); if (returnTo) router.push(returnTo); };

  const searchReferral = useCallback(async (query: string): Promise<PickerItem[]> => {
    if (!token) return [];
    const result = await listContacts(token, { limit: 10, search: query });
    return result.items
      .filter((item) => item.id !== editor?.contact?.id)
      .map((item) => ({
        id: item.id,
        primary: item.name || "Unnamed contact",
        secondary: `${item.phone} · ${KIND_LABELS[item.contact_type] ?? item.contact_type}`,
      }));
  }, [editor?.contact?.id, token]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    if (!token) { setFormError("Sign in again before saving this contact."); return; }
    const values = editor.values;
    const phoneValidation = validatePhone(values.phone);
    if (!phoneValidation.valid) { setFormError(phoneValidation.message || "Invalid phone number"); return; }
    // Validate partner type: check via dynamic fields (fall back to values.partnerType if no definitions loaded yet).
    const partnerTypeValue = partnerFields.length > 0
      ? String((values as unknown as Record<string, unknown>)[toCamel("partner_type")] ?? "")
      : values.partnerType;
    if (values.contactType === "partner" && !partnerTypeValue) { setFormError("Select the partner type."); return; }
    // Dealer profile: blanks are left out (on edit, unchanged). Money fields go out for admins only.
    let dealerProfile: DealerProfileInput | undefined;
    if (values.contactType === "dealer") {
      const parseMoney = (raw: string, label: string): number | undefined => {
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        if (Number.isNaN(parsed) || parsed < 0) throw new Error(`${label} must be a number of 0 or more.`);
        return parsed;
      };
      let money: { credit_limit?: number; outstanding_balance?: number } = {};
      if (isAdmin) {
        try {
          money = {
            credit_limit: parseMoney(values.dealerCreditLimit, "Credit limit"),
            outstanding_balance: parseMoney(values.dealerOutstandingBalance, "Outstanding balance"),
          };
        } catch (caught) {
          setFormError(caught instanceof Error ? caught.message : "Check the dealer amounts.");
          return;
        }
      }
      dealerProfile = {
        business_name: values.dealerBusinessName.trim() || null,
        gstin: values.dealerGstin.trim() || null,
        dealer_type: values.dealerType.trim() || null,
        town_city: values.dealerTownCity.trim() || null,
        pin_code: values.dealerPinCode.trim() || null,
        assigned_rep: values.dealerAssignedRep ? Number(values.dealerAssignedRep) : null,
        // Drop unset money keys so the backend leaves them alone.
        ...Object.fromEntries(Object.entries(money).filter(([, value]) => value !== undefined)),
      };
    }

    const source = leadSources.find((item) => item.name === sourceValue);
    const rawValues = values as unknown as Record<string, unknown>;

    // Build consumer profile data: iterate field definitions (fall back to legacy keys when none loaded).
    const consumerData: Record<string, unknown> = {};
    const effectiveConsumerFields = consumerFields.length > 0 ? consumerFields : [
      { field_name: "house_stage", field_type: "dropdown" as const },
      { field_name: "tank_type", field_type: "dropdown" as const },
      { field_name: "tank_capacity", field_type: "number" as const },
      { field_name: "tank_age", field_type: "number" as const },
    ];
    for (const f of effectiveConsumerFields) {
      const raw = rawValues[toCamel(f.field_name)];
      if (raw === undefined || raw === "" || raw === null) continue;
      if (f.field_type === "number") {
        const n = Number(raw);
        if (!Number.isNaN(n)) consumerData[f.field_name] = n;
      } else {
        consumerData[f.field_name] = String(raw).trim();
      }
    }
    const hasConsumerFields = Object.keys(consumerData).length > 0 || Boolean(editor.contact);

    // Build partner profile data: iterate field definitions (fall back to legacy keys when none loaded).
    const partnerData: Record<string, unknown> = {};
    const effectivePartnerFields = partnerFields.length > 0 ? partnerFields : [
      { field_name: "partner_type", field_type: "dropdown" as const },
      { field_name: "work_area", field_type: "text" as const },
    ];
    for (const f of effectivePartnerFields) {
      const raw = rawValues[toCamel(f.field_name)];
      if (raw === undefined || raw === "" || raw === null) continue;
      partnerData[f.field_name] = f.field_type === "number" ? Number(raw) : String(raw).trim();
    }

    const body = {
      contact_type: values.contactType,
      branch_id: values.branchId,
      name: values.name.trim(),
      phone: values.phone,
      district: values.district.trim(),
      address: values.address.trim(),
      referred_by_id: values.referredByContactId,
      lead_source_id: source?.id ?? null,
      // Send the owner only when it was chosen (create) or changed (edit); otherwise the backend keeps or auto-picks it.
      ...(values.assignedTo && values.assignedTo !== String(editor.contact?.assignedToId ?? "") ? { assigned_to: Number(values.assignedTo) } : {}),
      ...(values.contactType === "partner" ? { partner_profile: { data: partnerData } } : {}),
      ...(dealerProfile ? { dealer_profile: dealerProfile } : {}),
      ...(values.contactType === "consumer" && hasConsumerFields ? { consumer_profile: { data: consumerData } } : {}),
      // Send null to clear the note, or the trimmed string when set. Omitting would leave it unchanged on PUT.
      notes: values.note.trim() || null,
    };
    setIsSaving(true); setFormError("");
    try {
      if (editor.contact) {
        await updateContact(token, editor.contact.id, body);
        setEditor(null); await onSaved();
      } else {
        const created = await createContact(token, body);
        setEditor(null);
        if (returnTo) { router.push(returnTo); return; }
        await onSaved();
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setFormError(caught instanceof ApiError ? caught.message : "Contact could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  async function deleteContact() {
    if (!deleteTarget) return;
    if (!token) { setFormError("Sign in again before deleting this contact."); return; }
    setIsSaving(true); setFormError("");
    try {
      await deleteContactApi(token, deleteTarget.id);
      setDeleteTarget(null); await onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setFormError(caught instanceof ApiError ? caught.message : "Contact could not be deleted. Please try again.");
    } finally { setIsSaving(false); }
  }

  return {
    editor, openEditor, closeEditor, updateForm, saveContact, searchReferral, sourceValue,
    deleteTarget, setDeleteTarget, deleteContact,
    isSaving, formError, setFormError, selectedReferral, setSelectedReferral,
  };
}
