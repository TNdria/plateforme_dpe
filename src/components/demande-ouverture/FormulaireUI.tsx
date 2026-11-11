// @ts-nocheck
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LABEL_CLS, INPUT_CLS } from "@/constants/demandeOuvertureConfig";

export function SectionBar({ num, title, sub, accent }) {
  const colorMap = {
    green: "bg-emerald-600",
    amber: "bg-amber-500",
    blue: "bg-blue-600",
    violet: "bg-violet-600",
  };
  const bg = accent ? colorMap[accent] || "bg-primary" : "bg-primary";

  return (
    <div className="flex items-center gap-3 pb-3 border-b border-border">
      <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs shrink-0", bg)}>
        {num}
      </span>
      <span className="text-sm sm:text-base font-semibold text-foreground">{title}</span>
      {sub && (
        <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
          {sub}
        </span>
      )}
    </div>
  );
}

export function Field({ label, required, error, className, children }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className={LABEL_CLS}>
        {label}
        {required && <span className="text-red-500 font-bold ml-0.5"> *</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

export function ReadOnlyField({ label, value, type = "text", error, className }) {
  return (
    <Field label={label} error={error} className={className}>
      <Input className={cn("h-9 bg-muted text-muted-foreground", INPUT_CLS)} type={type} value={value ?? ""} readOnly disabled />
    </Field>
  );
}

export function LocSelect({ label, value, options, placeholder, onChange, disabled, errorClass, error }) {
  return (
    <Field label={label} required error={error}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={cn("h-9 w-full", errorClass)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function CheckboxOuiNon({ value, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value === true || value === "true"}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary cursor-pointer"
      />
      {label && <span className="text-xs sm:text-sm font-medium">{label}</span>}
    </label>
  );
}