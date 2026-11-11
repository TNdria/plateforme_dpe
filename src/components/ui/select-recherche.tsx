import React from "react";

export function SelectAvecRecherche({
  value,
  options = [],
  onChange,
  placeholder = "Sélectionner",
}: {
  value?: string;
  options?: Array<{ value: string; label?: string }> | string[];
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {(options as any[]).map((option, index) => {
        const normalized = typeof option === "string" ? { value: option, label: option } : option;
        return (
          <option key={`${normalized.value ?? index}`} value={normalized.value}>
            {normalized.label ?? normalized.value}
          </option>
        );
      })}
    </select>
  );
}

export default SelectAvecRecherche;
