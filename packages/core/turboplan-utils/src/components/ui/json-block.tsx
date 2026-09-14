import { cn } from "../../tailwind";

interface JsonBlockProps {
  label: string;
  data: unknown;
  className?: string;
}

export const JsonBlock = ({ label, data, className }: JsonBlockProps) => {
  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2">{label}</h3>
      <pre className="rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap break-words">
        {data ? JSON.stringify(data, null, 2) : `No ${label.toLowerCase()}`}
      </pre>
    </div>
  );
};
