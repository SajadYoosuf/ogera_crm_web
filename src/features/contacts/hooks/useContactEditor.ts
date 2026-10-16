"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type PickerItem } from "@/components/SearchPicker";
import { validatePhone } from "@/components/PhoneField";
import { ApiError } from "@/lib/api/auth";
import { createContact, deleteContact as deleteContactApi, getContact, listContacts, updateContact, type LeadSource } from "@/features/contacts/api/contacts";
import { blankContact, toForm, type Contact, type ContactForm } from "@/features/contacts/utils";

type Editor = { contact?: Contact; values: ContactForm; loading?: boolean } | null;

/** Add / edit / delete for one contact. `onSaved` refreshes the list after a change. */
export function useContactEditor({ leadSources, onSaved }: { leadSources: LeadSource[]; onSaved: () => Promise<void> | void }) {
  const router = useRouter();
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

  const openEditor = (contact?: Contact) => {
    setFormError("");
    setSelectedReferral(null);
    setEditor(contact ? { contact, values: toForm(contact), loading: true } : { values: blankContact });
    if (!contact) return;
    // List rows lack the referrer and house stage, so load the full record.
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setEditor((current) => current ? { ...current, loading: false } : current); return; }
    getContact(accessToken, contact.id)
      .then((detail) => {
        if (detail.referred_by) setSelectedReferral({ id: detail.referred_by.id, primary: detail.referred_by.name, secondary: detail.referred_by.phone ?? undefined });
        setEditor((current) => current?.contact?.id === contact.id ? {
          ...current, loading: false,
          values: {
            ...current.values,
            partnerType: detail.partner_profile?.profession_type ?? current.values.partnerType,
            district: detail.district, address: detail.address ?? "",
            houseStage: detail.consumer_profile?.house_stage ?? "",
            referredByContactId: detail.referred_by_id,
            dealerOwnerName: detail.dealer_profile?.owner_name ?? "",
            dealerEmail: detail.dealer_profile?.email ?? "",
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
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return [];
    const result = await listContacts(accessToken, { limit: 10, search: query });
    return result.items
      .filter((item) => item.id !== editor?.contact?.id)
      .map((item) => ({ id: item.id, primary: item.name || "Unnamed contact", secondary: item.phone }));
  }, [editor?.contact?.id]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before saving this contact."); return; }
    const values = editor.values;
    const phoneValidation = validatePhone(values.phone);
    if (!phoneValidation.valid) { setFormError(phoneValidation.message || "Invalid phone number"); return; }
    if (values.contactType === "partner" && !values.partnerType) { setFormError("Select the partner type."); return; }
    if (values.contactType === "dealer" && !values.dealerOwnerName.trim()) { setFormError("Owner name is required for dealer contacts."); return; }

    const source = leadSources.find((item) => item.name === sourceValue);
    const houseStage = values.houseStage.trim();
    const body = {
      contact_type: values.contactType,
      name: values.name.trim(),
      phone: values.phone,
      district: values.district.trim(),
      address: values.address.trim(),
      referred_by_id: values.referredByContactId,
      lead_source_id: source?.id ?? null,
      // Send the owner only when it was chosen (create) or changed (edit); otherwise the backend keeps or auto-picks it.
      ...(values.assignedTo && values.assignedTo !== String(editor.contact?.assignedToId ?? "") ? { assigned_to: Number(values.assignedTo) } : {}),
      ...(values.contactType === "partner" ? { partner_profile: { profession_type: values.partnerType } } : {}),
      ...(values.contactType === "consumer" && (houseStage || editor.contact) ? { consumer_profile: { house_stage: houseStage || null } } : {}),
      ...(values.contactType === "dealer" ? { dealer_profile: { owner_name: values.dealerOwnerName.trim(), ...(values.dealerEmail.trim() ? { email: values.dealerEmail.trim() } : {}) } } : {}),
    };
    setIsSaving(true); setFormError("");
    try {
      if (editor.contact) {
        await updateContact(accessToken, editor.contact.id, body);
      } else {
        await createContact(accessToken, body);
      }
      if (!editor.contact && returnTo) { setEditor(null); router.push(returnTo); return; }
      setEditor(null); await onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setFormError(caught instanceof ApiError ? caught.message : "Contact could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  async function deleteContact() {
    if (!deleteTarget) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before deleting this contact."); return; }
    setIsSaving(true); setFormError("");
    try {
      await deleteContactApi(accessToken, deleteTarget.id);
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
