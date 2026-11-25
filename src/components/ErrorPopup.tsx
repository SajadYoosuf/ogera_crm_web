"use client";

/**
 * Small message box centred on the screen, for errors that happen while a modal is open.
 * A banner inside a scrolling modal can sit below the visible area, so the user never sees it.
 */
export default function ErrorPopup({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="error-popup-message"
      className="fixed left-1/2 top-1/2 z-[1200] w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-rose-200 bg-white p-5 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <p id="error-popup-message" className="flex-1 text-sm leading-relaxed text-gray-800">{message}</p>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          autoFocus
          className="h-9 rounded-[8px] bg-[#0E4D3A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B3E2F]"
        >
          OK
        </button>
      </div>
    </div>
  );
}
