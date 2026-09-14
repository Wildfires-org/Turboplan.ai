import { brand } from "@/lib/brand";

interface FormHeaderProps {
  isAuthenticated: boolean;
}

export function FormHeader({ isAuthenticated }: FormHeaderProps) {
  const appName = brand.name;

  return (
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-bold text-neutral-black dark:text-zinc-50">
        {isAuthenticated ? "Create New Project" : `Sign up for ${appName}`}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
        {isAuthenticated
          ? "Set up a new project in your workspace"
          : "Create your account to get started"}
      </p>
    </div>
  );
}
