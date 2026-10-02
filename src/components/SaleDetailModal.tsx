"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatSaleDate, SOURCE_LABEL, WATER_LABEL, type Sale } from "@/lib/saleTypes";

interface Referral { id: number; name?: string; phone?: string; contactType?: string; stage?: string }
interface Review { id: number; userName?: string; rating: number; text: string; isPublished: boolean }
interface Complaint { id: number; type?: string; status?: string; subject?: string; description: string; imageUrl?: string }
interface SaleDetails { referrals: Referral[]; reviews: Review[]; complaints: Complaint[] }

type DetailTab = "details" | "referrals" | "reviews" | "complaints";

const emptyDetails: SaleDetails = { referrals: [], reviews: [], complaints: [] };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-bold text-[#0a192f] break-words">{value}</div>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <div className="py-10 text-center text-xs text-gray-400">{message}</div>;
}

export default function SaleDetailModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>("details");
  const [details, setDetails] = useState<SaleDetails>(emptyDetails);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const accessToken = sessionStorage.getItem("ogera_access_token");
      if (!accessToken) { setDetails(emptyDetails); setIsLoading(false); return; }
      setIsLoading(true);
      void fetch(`/api/sales/${sale.id}/details`, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((response) => response.json() as Promise<{ success: boolean; data?: SaleDetails }>)
        .then((result) => setDetails(result.success && result.data ? result.data : emptyDetails))
        .catch(() => setDetails(emptyDetails))
        .finally(() => setIsLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sale.id]);

  const tabs: { key: DetailTab; label: string; count?: number; badge: string }[] = [
    { key: "details", label: "Details", badge: "" },
    { key: "referrals", label: "Referrals", count: details.referrals.length, badge: "bg-blue-100 text-blue-700" },
    { key: "reviews", label: "Reviews", count: details.reviews.length, badge: "bg-amber-100 text-amber-800" },
    { key: "complaints", label: "Feedback", count: details.complaints.length, badge: "bg-rose-100 text-rose-700" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <section
        className="relative w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
      >
        <header className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
          <div>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Sale record #{sale.id}</span>
            <h2 id="sale-detail-title" className="text-lg font-bold text-[#0a192f] mt-1.5">{sale.buyerName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="p-2 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all ${tab === item.key ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
              >
                {item.label}
                {!!item.count && <span className={`px-1.5 rounded-full text-[10px] font-extrabold ${item.badge}`}>{item.count}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "details" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" value={sale.buyerPhone} />
                <Field label="Sale date" value={formatSaleDate(sale.saleDate)} />
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-bold text-gray-500 mb-3">Tank details</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Size</div>
                    <div className="font-bold text-[#0a192f]">{sale.tankSize || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Qty</div>
                    <div className="font-bold text-[#0a192f]">{sale.quantity ?? 1} unit</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Value</div>
                    <div className="font-bold text-[#0a192f]">{formatCurrency(sale.totalPrice)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-bold text-gray-500 mb-3">Location</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Panchayath</div>
                    <div className="font-bold text-blue-600">{sale.panchayath || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ward</div>
                    <div className="font-bold text-[#0a192f]">{sale.ward || "—"}</div>
                  </div>
                </div>
                {sale.address && <p className="mt-3 pt-3 border-t border-gray-200/70 text-xs text-gray-500 leading-relaxed">{sale.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Source of sale" value={sale.sourceOfSale ? SOURCE_LABEL[sale.sourceOfSale] || sale.sourceOfSale : "—"} />
                <Field label="Water source" value={sale.waterSource ? WATER_LABEL[sale.waterSource] || sale.waterSource : "—"} />
              </div>

              {sale.remarks && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remarks</div>
                  <p className="text-sm text-gray-600 leading-relaxed">{sale.remarks}</p>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="py-10 flex flex-col items-center text-center">
              <span className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
              <p className="mt-3 text-xs text-gray-500">Loading connected records…</p>
            </div>
          ) : tab === "referrals" ? (
            details.referrals.length === 0 ? (
              <EmptyTab message="No referred contacts connected to this sale record yet." />
            ) : (
              <div className="space-y-3">
                {details.referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#0a192f] truncate">{referral.name || "Unnamed contact"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{referral.phone}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${referral.contactType === "lead" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                        {referral.contactType || "lead"}
                      </span>
                      <span className="text-[10px] text-gray-400">{referral.stage || "initial_contact"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "reviews" ? (
            details.reviews.length === 0 ? (
              <EmptyTab message="No customer reviews connected to this sale record yet." />
            ) : (
              <div className="space-y-3">
                {details.reviews.map((review) => (
                  <div key={review.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-amber-500">
                        {"★".repeat(Math.max(1, Math.min(5, review.rating || 5)))}
                        <span className="ml-1.5 text-gray-700">{review.userName}</span>
                      </span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${review.isPublished ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                        {review.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 italic leading-relaxed">{review.text}</p>
                  </div>
                ))}
              </div>
            )
          ) : details.complaints.length === 0 ? (
            <EmptyTab message="No complaints or feedback logged for this sale record." />
          ) : (
            <div className="space-y-3">
              {details.complaints.map((complaint) => (
                <div key={complaint.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase shrink-0 ${complaint.type === "complaint" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>
                        {complaint.type}
                      </span>
                      <span className="text-xs font-bold text-gray-900 truncate">{complaint.subject}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 capitalize shrink-0">{complaint.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{complaint.description}</p>
                  {complaint.imageUrl && (
                    <a href={complaint.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:underline">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L4 21" /></svg>
                      View photo attachment
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button type="button" onClick={onClose} className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">Close</button>
        </footer>
      </section>
    </div>
  );
}
