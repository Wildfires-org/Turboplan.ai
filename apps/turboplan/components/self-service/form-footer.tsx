import Link from "next/link";

interface FormFooterProps {
  isAuthenticated: boolean;
}

export function FormFooter({ isAuthenticated }: FormFooterProps) {
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
      Already have an account?{" "}
      <Link
        href="/login"
        className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
      >
        Sign in
      </Link>
    </div>
  );
}
