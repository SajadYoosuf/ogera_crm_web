"use client";

/**
 * /dashboard/settings
 *
 *   General        — everyone (company name and logo; saving is admin-only on the server)
 *   Account        — everyone (own name, email, password)
 *   Team           — admin
 *   Integrations   — admin (API keys + website / Google Sheet snippets)
 *   WhatsApp       — admin (Meta credentials, webhook URL and verify token)
 *   Templates      — admin (WhatsApp message templates: create, send to Meta, status)
 *   Lead Statuses  — admin
 *   Follow-ups     — admin and manager (timings, reminders, staff permissions, task status labels)
 */

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canDo, isLeadHead } from "@/lib/shared/roles";
import GeneralTab from "./GeneralTab";
import AccountTab from "./AccountTab";
import TeamTab from "./TeamTab";
import IntegrationsTab from "./IntegrationsTab";
import WhatsAppTab from "./WhatsAppTab";
import TemplatesTab from "./TemplatesTab";
import LeadStatusesTab from "./LeadStatusesTab";
import ContactFieldsTab from "./ContactFieldsTab";
import PipelineStagesTab from "./PipelineStagesTab";
import FollowupsSettingsTab from "@/features/settings/components/FollowupsSettingsTab";

export type SettingsTabKey = "general" | "account" | "team" | "integrations" | "whatsapp" | "templates" | "lead_statuses" | "followups" | "contact_fields" | "pipeline_stages";

type SectionItem = {
  key: SettingsTabKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** Permission module the tab needs `r` on. Null = every signed-in user. */
  module: string | null;
  /** Admin and manager only, whatever the permission map says (Follow-ups). */
  headOnly?: boolean;
};

const SECTIONS: SectionItem[] = [
  {
    key: "general",
    label: "General",
    description: "Company name & logo",
    module: "company",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: "account",
    label: "Account",
    description: "Name, email & password",
    module: null,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    key: "team",
    label: "Role Permissions",
    description: "Staff & role permissions",
    module: "team",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "API keys & webhooks",
    module: "integrations",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Business API connection",
    module: "integrations",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" />
        <path d="M9 8.5c.3 2.6 2.4 5 5.5 6l1.2-1.3-2-1-.8.7c-.9-.4-1.6-1.2-2-2l.7-.8-1-2z" />
      </svg>
    ),
  },
  {
    key: "templates",
    label: "WhatsApp Templates",
    description: "Message templates for Meta",
    module: "integrations",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    key: "lead_statuses",
    label: "Lead Statuses",
    description: "Manage pipeline stages",
    module: "lead_statuses",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    key: "contact_fields",
    label: "Contact Fields",
    description: "Consumer & partner profile fields",
    module: "team",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
      </svg>
    ),
  },
  {
    key: "pipeline_stages",
    label: "Pipeline Stages",
    description: "Kanban columns per contact type",
    module: "team",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="4" height="18" rx="1" />
        <rect x="10" y="3" width="4" height="12" rx="1" />
        <rect x="17" y="3" width="4" height="15" rx="1" />
      </svg>
    ),
  },
  {
    key: "followups",
    label: "Follow-ups",
    description: "Timings, reminders & task statuses",
    module: null,
    headOnly: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" />
      </svg>
    ),
  },
];

export function visibleSettingsTabs(user: Parameters<typeof canDo>[0]) {
  return SECTIONS.filter((s) => (s.headOnly ? isLeadHead(user) : s.module === null || canDo(user, s.module, "r")));
}

export default function SettingsView() {
  const { user } = useAuth();
  const sections = visibleSettingsTabs(user);
  const [active, setActive] = useState<SettingsTabKey>("general");
  const currentSection = sections.find((s) => s.key === active) ?? sections[0];
  const current = currentSection.key;

  return (
    <div className="flex flex-1 flex-col bg-[#F4FBF7]">
      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center border-b border-[#E7E7EA] bg-white pl-16 pr-6 lg:pl-7">
        <h1 className="text-[22px] font-bold tracking-[-0.01em] text-[#1A1C21] sm:text-[26px]">Settings</h1>
      </header>

      {/*
        Below xl the section list is a horizontally scrolling strip above the content, so the form gets the full
        width on phones and tablets. From xl up it is a sidebar beside the content.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 xl:flex-row xl:gap-6 xl:py-6 xl:pl-7 xl:pr-6">
        {/* Section list */}
        <nav aria-label="Settings sections" className="-mx-4 min-w-0 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 xl:mx-0 xl:w-52 xl:shrink-0 xl:overflow-visible xl:p-0">
          <ul className="flex w-max gap-2 xl:w-auto xl:flex-col xl:gap-0.5" role="list">
            {sections.map((s) => {
              const isActive = s.key === current;
              return (
                <li key={s.key} className="shrink-0 xl:shrink">
                  <button
                    type="button"
                    onClick={() => setActive(s.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-left transition-colors xl:w-full xl:gap-3 xl:rounded-xl xl:border-transparent xl:px-3 xl:py-2.5 ${
                      isActive
                        ? "border-[#0E4D3A] bg-[#0E4D3A] text-white"
                        : "border-[#E5E7EA] bg-white text-[#3A3E4A] hover:text-[#1A1C21] xl:bg-transparent xl:hover:bg-white"
                    }`}
                  >
                    <span className={isActive ? "text-white/80" : "text-[#8A8F9C]"}>{s.icon}</span>
                    <span className="text-[13.5px] font-semibold">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-[18px] font-bold text-[#1A1C21]">{currentSection.label}</h2>
            <p className="text-[13px] text-[#8A8F9C]">{currentSection.description}</p>
          </div>

          {current === "general" && <GeneralTab />}
          {current === "account" && user && (
            <AccountTab profile={{ id: user.id, name: user.name, email: user.email, role: user.role }} />
          )}
          {current === "team" && <TeamTab />}
          {current === "integrations" && <IntegrationsTab />}
          {current === "whatsapp" && <WhatsAppTab />}
          {current === "templates" && <TemplatesTab />}
          {current === "lead_statuses" && <LeadStatusesTab />}
          {current === "contact_fields" && <ContactFieldsTab />}
          {current === "pipeline_stages" && <PipelineStagesTab />}
          {current === "followups" && <FollowupsSettingsTab />}
        </div>
      </div>
    </div>
  );
}
