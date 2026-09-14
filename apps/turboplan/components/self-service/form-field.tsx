import { Input } from "@wildfires-org/turboplan-utils";

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  helperText,
  required = false,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
      >
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? "border-red-500" : ""}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {helperText}
        </p>
      )}
    </div>
  );
}
