"use client";

/**
 * MessageThread — the centre panel: chat bubbles for one lead plus the reply composer.
 *
 * Mount it with key={leadId} so switching conversation resets all state.
 * Polls every 10 s while the tab is visible. New inbound messages are marked read
 * as soon as they are shown, then onRead() lets the parent refresh badges.
 * Meta only allows free text within 24 hours of the customer's last message;
 * outside that window a pre-approved template must be used.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { listWhatsAppMessages, sendWhatsAppReply, type WhatsAppMessage } from "@/features/leads/api/leadSettings";
import { markConversationRead } from "./api";

type Mode = "text" | "template";

const POLL_MS = 10_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function parseIso(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
}

/** Free text is only allowed within 24 hours of the customer's last message. */
function isWindowOpen(rows: WhatsAppMessage[]): boolean {
  const lastInbound = [...rows].reverse().find((m) => m.direction === "in");
  return !!lastInbound && Date.now() - parseIso(lastInbound.created_at).getTime() < WINDOW_MS;
}

export default function MessageThread({
  leadId,
  hasPhone,
  onRead,
  onSent,
}: {
  leadId: number;
  hasPhone: boolean;
  onRead: () => void;
  onSent: () => void;
}) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [windowOpen, setWindowOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [template, setTemplate] = useState("");
  const [params, setParams] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await listWhatsAppMessages(token, leadId);
      setMessages(rows);
      setWindowOpen(isWindowOpen(rows));
      setLoadError("");
      if (rows.some((m) => m.direction === "in" && !m.is_read)) {
        await markConversationRead(token, leadId);
        onRead();
      }
    } catch (caught) {
      setLoadError(caught instanceof ApiError ? caught.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [token, leadId, onRead]);

  useEffect(() => {
    const first = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  const canSend = hasPhone && !sending && (mode === "text" ? text.trim().length > 0 : template.trim().length > 0);

  async function send() {
    if (!token || !canSend) return;
    setSending(true); setSendError("");
    try {
      const body = mode === "text"
        ? { message: text.trim() }
        : { template_name: template.trim(), template_params: params.split(",").map((p) => p.trim()).filter(Boolean) };
      const sent = await sendWhatsAppReply(token, leadId, body);
      setMessages((cur) => [...cur, sent]);
      setText(""); setParams("");
      onSent();
    } catch (caught) {
      setSendError(caught instanceof ApiError ? caught.message : "Message not sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#EFEAE2] px-4 py-4">
        {loading && <p className="text-center text-sm text-gray-500">Loading…</p>}
        {loadError && (
          <div role="alert" className="mx-auto max-w-xs rounded-lg bg-white/90 px-4 py-3 text-center text-sm text-red-600">
            {loadError}
            <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}
        {!loading && !loadError && messages.length === 0 && (
          <p className="mx-auto mt-10 max-w-[260px] rounded-lg bg-white/80 px-4 py-3 text-center text-sm text-gray-600">
            No WhatsApp messages with this lead yet.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm sm:max-w-[75%] ${m.direction === "out" ? "bg-[#D9FDD3]" : "bg-white"}`}>
              {m.content_type === "template"
                ? <p className="italic text-[#3A3E4A]">Template: {m.template_name}</p>
                : m.body
                  ? <p className="whitespace-pre-wrap break-words text-[#111B21]">{m.body}</p>
                  : <p className="italic text-[#667781]">[{m.content_type}]</p>}
              <p className="mt-1 text-right text-[11px] text-[#667781]">
                {parseIso(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {m.direction === "out" && ` · ${m.status}`}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="space-y-2 border-t border-[#EFEFF2] bg-white px-4 py-3">
        {!hasPhone && <p className="text-xs text-amber-700">This lead has no phone number, so WhatsApp messages cannot be sent.</p>}
        {hasPhone && mode === "text" && !loading && !windowOpen && (
          <p className="text-xs text-amber-700">More than 24 hours since the customer last wrote. Switch to Template to message them.</p>
        )}
        <div className="flex gap-1.5 text-xs font-semibold" role="tablist" aria-label="Message type">
          {(["text", "template"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? "bg-[#0E4D3A] text-white" : "bg-[#F3F3F5] text-[#4B5060]"}`}>
              {m === "text" ? "Message" : "Template"}
            </button>
          ))}
        </div>
        {mode === "text" ? (
          <textarea aria-label="WhatsApp message" rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            className="w-full resize-none rounded-lg border border-[#DEE1E5] px-3 py-2 text-sm" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Template name" value={template} onChange={(e) => setTemplate(e.target.value)}
              placeholder="Approved template name, e.g. welcome" className="rounded-lg border border-[#DEE1E5] px-3 py-2 text-sm" />
            <input aria-label="Template values" value={params} onChange={(e) => setParams(e.target.value)}
              placeholder="Values, comma-separated (optional)" className="rounded-lg border border-[#DEE1E5] px-3 py-2 text-sm" />
          </div>
        )}
        {sendError && <p role="alert" className="text-xs text-red-600">{sendError}</p>}
        <div className="flex justify-end">
          <button type="button" onClick={() => void send()} disabled={!canSend}
            className="h-9 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white hover:bg-[#1EBE5A] disabled:opacity-50">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
