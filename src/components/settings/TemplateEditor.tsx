"use client";

/**
 * TemplateEditor — create or edit one WhatsApp template, with a live preview.
 *
 * Meta's rules (limits, variables, buttons) are checked by the server, which answers with one
 * plain sentence that is shown above the form. The form only prevents the obvious: counters at
 * the limit, a name in Meta's format, one sample-value box per variable.
 */

import { useState } from "react";
import {
  LANGUAGES,
  TEMPLATE_LIMITS,
  fillSamples,
  variableIndices,
  type TemplateButton,
  type TemplateButtonType,
  type TemplateCategory,
  type TemplateHeaderType,
  type WhatsAppTemplate,
  type WhatsAppTemplateInput,
} from "@/features/whatsapp/api/templates";
import { Panel, accentButton, secondaryButton } from "./ui";

const inputClass = "h-10 w-full rounded-[8px] border border-[#E1E1E6] px-3 text-sm disabled:bg-[#F6F6F8] disabled:text-[#8A8F9C]";
const areaClass = "w-full rounded-[8px] border border-[#E1E1E6] px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-semibold text-[#3A3E4A]";
const hintClass = "mt-1 text-xs text-[#8A8F9C]";

const BUTTON_LABEL: Record<TemplateButtonType, string> = {
  QUICK_REPLY: "Quick reply", URL: "Visit website", PHONE_NUMBER: "Call phone number", COPY_CODE: "Copy code",
};

type Form = {
  name: string;
  language: string;
  category: TemplateCategory;
  headerType: "" | TemplateHeaderType;
  headerContent: string;
  headerMediaUrl: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
  bodySamples: string[];
  headerSample: string;
};

function formFrom(t: WhatsAppTemplate | null): Form {
  return {
    name: t?.name ?? "",
    language: t?.language ?? "en_US",
    category: t?.category ?? "MARKETING",
    headerType: t?.header_type ?? "",
    headerContent: t?.header_content ?? "",
    headerMediaUrl: t?.header_media_url ?? "",
    body: t?.body_text ?? "",
    footer: t?.footer_text ?? "",
    buttons: t?.buttons ?? [],
    bodySamples: t?.sample_values?.body ?? [],
    headerSample: t?.sample_values?.header?.[0] ?? "",
  };
}

/** The server's input shape: one sample value per variable, blanks kept so the server can name the empty one. */
export function inputFromForm(f: Form): WhatsAppTemplateInput {
  const bodyCount = variableIndices(f.body).length;
  const headerCount = f.headerType === "text" ? variableIndices(f.headerContent).length : 0;
  const media = f.headerType && f.headerType !== "text";
  return {
    name: f.name.trim(),
    language: f.language,
    category: f.category,
    header_type: f.headerType || null,
    header_content: f.headerType === "text" ? f.headerContent : null,
    header_media_url: media ? f.headerMediaUrl.trim() || null : null,
    body_text: f.body,
    footer_text: f.footer.trim() || null,
    buttons: f.buttons.length ? f.buttons : null,
    sample_values: {
      body: Array.from({ length: bodyCount }, (_, i) => f.bodySamples[i] ?? ""),
      header: headerCount ? [f.headerSample] : [],
    },
  };
}

type Props = {
  /** null = a new template. */
  template: WhatsAppTemplate | null;
  busy: boolean;
  error: string;
  onSave: (input: WhatsAppTemplateInput, thenSubmit: boolean) => void;
  onCancel: () => void;
};

export default function TemplateEditor({ template, busy, error, onSave, onCancel }: Props) {
  const [f, setF] = useState<Form>(() => formFrom(template));
  const submitted = template !== null && !template.can_submit; // already at Meta: name and language are fixed
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const bodyVars = variableIndices(f.body);
  const headerHasVar = f.headerType === "text" && variableIndices(f.headerContent).length > 0;
  const urlButtons = f.buttons.filter((b) => b.type === "URL").length;
  const canSave = !busy && f.name.trim() !== "" && f.body.trim() !== "";

  const updateButton = (i: number, patch: Partial<TemplateButton>) =>
    set("buttons", f.buttons.map((b, n) => (n === i ? { ...b, ...patch } : b)));
  const addButton = (type: TemplateButtonType) => set("buttons", [...f.buttons, { type, text: "" }]);

  function addBodyVariable() {
    const next = (bodyVars[bodyVars.length - 1] ?? 0) + 1;
    set("body", `${f.body}{{${next}}}`);
  }

  const previewBody = fillSamples(f.body, f.bodySamples);
  const previewHeader = f.headerType === "text" ? fillSamples(f.headerContent, [f.headerSample]) : "";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); if (canSave) onSave(inputFromForm(f), false); }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-[#1A1C21]">{template ? `Edit ${template.name}` : "New template"}</h3>
        <button type="button" className={secondaryButton} onClick={onCancel}>Back to templates</button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {template && !template.can_submit && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This template is already with Meta. Saving sends your changes for a new review, and it cannot be used until Meta approves it again.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel title="Basics">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label htmlFor="tpl-name" className={labelClass}>Template name</label>
                <input id="tpl-name" className={inputClass} value={f.name} disabled={submitted} maxLength={512} autoComplete="off"
                  onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[\s-]+/g, "_"))} />
                <p className={hintClass}>Lowercase letters, numbers and underscores, e.g. order_update. It cannot be changed after it is sent to Meta.</p>
              </div>
              <div>
                <label htmlFor="tpl-language" className={labelClass}>Language</label>
                <select id="tpl-language" className={inputClass} value={f.language} disabled={submitted} onChange={(e) => set("language", e.target.value)}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  {!LANGUAGES.some((l) => l.code === f.language) && <option value={f.language}>{f.language}</option>}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="tpl-category" className={labelClass}>Category</label>
                <select id="tpl-category" className={inputClass} value={f.category} onChange={(e) => set("category", e.target.value as TemplateCategory)}>
                  <option value="MARKETING">Marketing: offers, promotions, announcements</option>
                  <option value="UTILITY">Utility: order and account updates</option>
                </select>
                <p className={hintClass}>Meta may change the category when it reviews the template.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Header (optional)">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="tpl-header-type" className={labelClass}>Type</label>
                <select id="tpl-header-type" className={inputClass} value={f.headerType} onChange={(e) => set("headerType", e.target.value as Form["headerType"])}>
                  <option value="">None</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                </select>
              </div>
              {f.headerType === "text" && (
                <div className="sm:col-span-2">
                  <label htmlFor="tpl-header-text" className={labelClass}>Header text</label>
                  <input id="tpl-header-text" className={inputClass} value={f.headerContent} maxLength={TEMPLATE_LIMITS.headerText} onChange={(e) => set("headerContent", e.target.value)} />
                  <p className={hintClass}>{f.headerContent.length}/{TEMPLATE_LIMITS.headerText}. One variable at most: {"{{1}}"}.</p>
                </div>
              )}
              {f.headerType && f.headerType !== "text" && (
                <div className="sm:col-span-2">
                  <label htmlFor="tpl-header-url" className={labelClass}>Sample {f.headerType} link</label>
                  <input id="tpl-header-url" className={inputClass} value={f.headerMediaUrl} placeholder="https://" onChange={(e) => set("headerMediaUrl", e.target.value)} />
                  <p className={hintClass}>A public https link Meta can open, to review what this header looks like.</p>
                </div>
              )}
            </div>
            {headerHasVar && (
              <div>
                <label htmlFor="tpl-header-sample" className={labelClass}>Sample for {"{{1}}"} in the header</label>
                <input id="tpl-header-sample" className={inputClass} value={f.headerSample} onChange={(e) => set("headerSample", e.target.value)} />
              </div>
            )}
          </Panel>

          <Panel title="Message">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="tpl-body" className="text-xs font-semibold text-[#3A3E4A]">Body</label>
                <button type="button" className="text-xs font-semibold text-[#0E4D3A] hover:underline" onClick={addBodyVariable}>Add variable</button>
              </div>
              <textarea id="tpl-body" rows={6} className={areaClass} value={f.body} maxLength={TEMPLATE_LIMITS.body} onChange={(e) => set("body", e.target.value)} />
              <p className={hintClass}>{f.body.length}/{TEMPLATE_LIMITS.body}. Use {"{{1}}"}, {"{{2}}"}, … for names, order numbers and so on, in order with no gaps.</p>
            </div>
            {bodyVars.length > 0 && (
              <fieldset className="space-y-2 rounded-xl border border-[#E5E7EA] p-3">
                <legend className="px-1 text-xs font-semibold text-[#3A3E4A]">Sample values: Meta reviews the template with these</legend>
                {bodyVars.map((n, i) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs text-[#8A8F9C]">{`{{${n}}}`}</span>
                    <input aria-label={`Sample for {{${n}}}`} className={inputClass} value={f.bodySamples[i] ?? ""}
                      onChange={(e) => set("bodySamples", bodyVars.map((_, k) => (k === i ? e.target.value : f.bodySamples[k] ?? "")))} />
                  </div>
                ))}
              </fieldset>
            )}
            <div>
              <label htmlFor="tpl-footer" className={labelClass}>Footer (optional)</label>
              <input id="tpl-footer" className={inputClass} value={f.footer} maxLength={TEMPLATE_LIMITS.footer} onChange={(e) => set("footer", e.target.value)} />
              <p className={hintClass}>{f.footer.length}/{TEMPLATE_LIMITS.footer}. No variables.</p>
            </div>
          </Panel>

          <Panel title="Buttons (optional)" subtitle={`Up to ${TEMPLATE_LIMITS.buttons}. Quick replies must come first; at most ${TEMPLATE_LIMITS.urlButtons} website buttons and one phone button.`}>
            {f.buttons.map((b, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-[#E5E7EA] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#3A3E4A]">Button {i + 1}: {BUTTON_LABEL[b.type]}</span>
                  <button type="button" aria-label={`Remove button ${i + 1}`} className="text-xs font-semibold text-red-600 hover:underline"
                    onClick={() => set("buttons", f.buttons.filter((_, n) => n !== i))}>Remove</button>
                </div>
                <input aria-label={`Button ${i + 1} text`} className={inputClass} placeholder="Button text" value={b.text} maxLength={TEMPLATE_LIMITS.buttonText}
                  onChange={(e) => updateButton(i, { text: e.target.value })} />
                {b.type === "URL" && (
                  <>
                    <input aria-label={`Button ${i + 1} URL`} className={inputClass} placeholder="https://example.com/track/{{1}}" value={b.url ?? ""} onChange={(e) => updateButton(i, { url: e.target.value })} />
                    {variableIndices(b.url).length > 0 && (
                      <input aria-label={`Button ${i + 1} example link`} className={inputClass} placeholder="Example link, e.g. https://example.com/track/123" value={b.example ?? ""} onChange={(e) => updateButton(i, { example: e.target.value })} />
                    )}
                  </>
                )}
                {b.type === "PHONE_NUMBER" && (
                  <input aria-label={`Button ${i + 1} phone number`} className={inputClass} placeholder="+917994437444" value={b.phone_number ?? ""} onChange={(e) => updateButton(i, { phone_number: e.target.value })} />
                )}
                {b.type === "COPY_CODE" && (
                  <input aria-label={`Button ${i + 1} example code`} className={inputClass} placeholder="Example code, e.g. SAVE20" value={b.example ?? ""} onChange={(e) => updateButton(i, { example: e.target.value })} />
                )}
              </div>
            ))}
            {f.buttons.length < TEMPLATE_LIMITS.buttons && (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BUTTON_LABEL) as TemplateButtonType[]).map((type) => (
                  <button key={type} type="button" className={secondaryButton}
                    disabled={(type === "URL" && urlButtons >= TEMPLATE_LIMITS.urlButtons) || (type === "PHONE_NUMBER" && f.buttons.some((b) => b.type === type)) || (type === "COPY_CODE" && f.buttons.some((b) => b.type === type))}
                    onClick={() => addButton(type)}>+ {BUTTON_LABEL[type]}</button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <aside aria-label="Preview" className="lg:sticky lg:top-24 lg:self-start">
          <Panel title="Preview" subtitle="How it looks on WhatsApp, with your sample values.">
            <div className="rounded-xl bg-[#E7F1EC] p-3">
              <div className="max-w-full space-y-1 rounded-lg bg-white p-3 text-[13px] text-[#1A1C21] shadow-sm">
                {f.headerType === "text" && previewHeader && <p className="font-bold">{previewHeader}</p>}
                {f.headerType && f.headerType !== "text" && (
                  <p className="rounded-md bg-[#F0F0F3] px-2 py-6 text-center text-xs text-[#8A8F9C]">{f.headerType} header</p>
                )}
                <p data-testid="tpl-preview-body" className="whitespace-pre-wrap break-words">{previewBody || "Your message appears here."}</p>
                {f.footer && <p className="text-xs text-[#8A8F9C]">{f.footer}</p>}
              </div>
              {f.buttons.filter((b) => b.text.trim()).map((b, i) => (
                <p key={i} className="mt-1 rounded-lg bg-white px-3 py-2 text-center text-[13px] font-semibold text-[#0E7BC4] shadow-sm">{b.text}</p>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={accentButton} disabled={!canSave}>
          {busy ? "Saving…" : submitted ? "Save and resubmit to Meta" : "Save draft"}
        </button>
        {!submitted && (
          <button type="button" className={secondaryButton} disabled={!canSave} onClick={() => onSave(inputFromForm(f), true)}>
            Save and send to Meta
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
