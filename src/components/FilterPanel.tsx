"use client";

import FilterSelect from "./FilterSelect";

export type FilterGroup = { key: string; label: string; value: string; options: { value: string; label: string }[] };

const filterIcon = <path d="M3 5h18M6 12h12M10 19h4" />;

/** A horizontal row of dropdown filters (wraps on small screens) with a "Clear" action while any is active. */
export function FilterBar({ groups, onChange, onClear }: {
  groups: FilterGroup[]; onChange: (key: string, value: string) => void; onClear: () => void;
}) {
  const activeCount = groups.filter((group) => group.value).length;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {groups.map((group) => (
        <FilterSelect
          key={group.key}
          label={group.label}
          value={group.value}
          onChange={(value) => onChange(group.key, value)}
          options={[{ value: "", label: "All" }, ...group.options]}
          icon={filterIcon}
          className="w-full sm:w-52"
        />
      ))}
      {activeCount > 0 && (
        <button type="button" onClick={onClear} className="min-h-11 px-3 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );
}
