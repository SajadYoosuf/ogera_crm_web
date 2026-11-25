// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConversationList from "@/features/whatsapp-inbox/ConversationList";
import type { ConversationSummary } from "@/features/whatsapp-inbox/api";

const row = (over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  lead_id: 1,
  lead_name: "Asha Nair",
  phone: "919000000001",
  status: "new",
  last_message: { body: "What is the price?", direction: "in", content_type: "text", template_name: null, created_at: "2026-11-24T05:00:00Z" },
  unread_count: 2,
  assigned_to: null,
  assigned_name: null,
  ...over,
});

const base = { selectedId: null, onSelect: vi.fn(), search: "", onSearchChange: vi.fn(), loading: false, error: "", onRetry: vi.fn() };

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ConversationList", () => {
  it("shows name, preview and unread badge, and selects on click", () => {
    const onSelect = vi.fn();
    render(<ConversationList {...base} conversations={[row()]} onSelect={onSelect} />);
    expect(screen.getByText("Asha Nair")).toBeTruthy();
    expect(screen.getByText("What is the price?")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    fireEvent.click(screen.getByText("Asha Nair"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("prefixes our own replies and labels templates", () => {
    render(<ConversationList {...base} conversations={[
      row({ lead_id: 1, unread_count: 0, last_message: { body: "On my way", direction: "out", content_type: "text", template_name: null, created_at: "2026-11-24T05:00:00Z" } }),
      row({ lead_id: 2, lead_name: "Ravi", unread_count: 0, last_message: { body: null, direction: "out", content_type: "template", template_name: "welcome", created_at: "2026-11-24T05:00:00Z" } }),
    ]} />);
    expect(screen.getByText("You: On my way")).toBeTruthy();
    expect(screen.getByText("Template: welcome")).toBeTruthy();
  });

  it("shows the assignee when there is one", () => {
    render(<ConversationList {...base} conversations={[row({ assigned_name: "Anu Sales" })]} />);
    expect(screen.getByText("Assigned: Anu Sales")).toBeTruthy();
  });

  it("shows an empty state, and a different one while searching", () => {
    const { rerender } = render(<ConversationList {...base} conversations={[]} />);
    expect(screen.getByText("No WhatsApp conversations yet.")).toBeTruthy();
    rerender(<ConversationList {...base} conversations={[]} search="zzz" />);
    expect(screen.getByText("No conversations match your search.")).toBeTruthy();
  });

  it("shows a retryable error", () => {
    const onRetry = vi.fn();
    render(<ConversationList {...base} conversations={[]} error="Could not load conversations." onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Could not load conversations.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("reports typing in the search box", () => {
    const onSearchChange = vi.fn();
    render(<ConversationList {...base} conversations={[]} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByLabelText("Search conversations"), { target: { value: "asha" } });
    expect(onSearchChange).toHaveBeenCalledWith("asha");
  });
});
