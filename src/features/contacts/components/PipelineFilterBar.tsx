"use client";

import DateRangePicker from "@/components/DateRangePicker";
import FilterSelect, { type FilterOption } from "@/components/FilterSelect";

export type PipelineFilterValues = {
  search: string;
  source: string;
  assignedTo: string;
  branch: string;
  from: string;
  to: string;
};

export const NO_PIPELINE_FILTERS: PipelineFilterValues = { search: "", source: "", assignedTo: "", branch: "", from: "", to: "" };

interface Props {
  values: PipelineFilterValues;
  onChange: (patch: Partial<PipelineFilterValues>) => void;
  onClear: () => void;
  sourceOptions: FilterOption[];
  branchOptions: FilterOption[];
  employeeOptions: FilterOption[];
  /** Employee filter is for admins and managers only, like on the contacts list. */
  canAssign: boolean;
}

/** Search (name or phone), created-date range, and lead source / branch / employee pickers for the pipeline board. */
export default function PipelineFilterBar({ values, onChange, onClear, sourceOptions, branchOptions, employeeOptions, canAssign }: Props) {
  const hasActive = Object.values(values).some(Boolean);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-6 py-3">
      <div className="relative w-full sm:w-[260px]">
        <label className="sr-only" htmlFor="pipeline-search">Search contacts</label>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
        <input
          id="pipeline-search"
          value={values.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search name or phone…"
          autoComplete="off"
          className={`h-[38px] w-full rounded-[8px] border border-[#E1E1E6] bg-white pl-9 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8] ${values.search ? "pr-9" : "pr-3"}`}
        />
        {values.search && (
          <button type="button" onClick={() => onChange({ search: "" })} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8A8F9C] hover:text-[#1A1C21]">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <DateRangePicker
        plain
        label="Created between"
        from={values.from}
        to={values.to}
        onChange={(from, to) => onChange({ from, to })}
        emptyLabel="Any date"
        className="w-full sm:w-[280px]"
      />

      <FilterSelect plain clearable label="Lead source" value={values.source} onChange={(value) => onChange({ source: value })} options={sourceOptions} className="w-full sm:w-[190px]" />
      <FilterSelect plain clearable label="Branch" value={values.branch} onChange={(value) => onChange({ branch: value })} options={branchOptions} className="w-full sm:w-[170px]" />
      {canAssign && (
        <FilterSelect plain clearable label="Employee" value={values.assignedTo} onChange={(value) => onChange({ assignedTo: value })} options={employeeOptions} className="w-full sm:w-[190px]" />
      )}

      {hasActive && (
        <button type="button" onClick={onClear} className="px-2 text-sm font-medium text-[#6B7080] transition-colors hover:text-[#1A1C21]">
          Clear all
        </button>
      )}
    </div>
  );
}
