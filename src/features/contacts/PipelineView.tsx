"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import PipelineTabBar, { type PipelineTab } from "./components/PipelineTabBar";
import PipelineBoard from "./components/PipelineBoard";
import {
  listPipelineStages,
  listPipelineContacts,
  type PipelineStageItem,
  type PipelineContact,
} from "./api/contacts";

export default function PipelineView() {
  const { token } = useAuth();
  const [tab, setTab] = useState<PipelineTab>("consumer");
  const [stages, setStages] = useState<PipelineStageItem[]>([]);
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<PipelineTab, number>>({ consumer: 0, partner: 0, dealer: 0 });

  const load = useCallback(
    async (contactType: PipelineTab) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const [stagesData, contactsData] = await Promise.all([
          listPipelineStages(token, contactType),
          listPipelineContacts(token, contactType),
        ]);
        setStages(stagesData);
        setContacts(contactsData);
        setCounts((prev) => ({ ...prev, [contactType]: contactsData.length }));
      } catch {
        setError("Failed to load pipeline. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const handleTabChange = (next: PipelineTab) => {
    setTab(next);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A1C21]">Pipeline</h1>
          <p className="mt-0.5 text-sm text-[#6B7080]">Track contacts through your sales pipeline</p>
        </div>
        <div className="w-[300px]">
          <PipelineTabBar active={tab} onChange={handleTabChange} />
        </div>
      </div>

      {/* Count row */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-3 border-b border-gray-100">
        <span className="text-sm text-[#6B7080]">
          <span className="font-semibold text-[#1A1C21]">{counts[tab]}</span> contacts
        </span>
        {stages.length > 0 && (
          <span className="text-sm text-[#6B7080]">
            <span className="font-semibold text-[#1A1C21]">{stages.length}</span> stages
          </span>
        )}
      </div>

      {/* Board area */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-3 text-[#6B7080]">
              <svg className="h-5 w-5 animate-spin text-[#0E4D3A]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Loading pipeline…
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
              {error}
              <button
                type="button"
                onClick={() => load(tab)}
                className="ml-3 font-semibold underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <PipelineBoard
            stages={stages}
            contacts={contacts}
            onCardClick={(c) => {
              // TODO: open contact detail modal (phase 8c)
              void c;
            }}
          />
        )}
      </div>
    </div>
  );
}
