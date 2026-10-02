"use client";

import type { AuthUser } from "@/lib/types/auth";
import { FormField } from "./form-field";

interface FormFieldsProps {
  isAuthenticated: boolean;
  user: AuthUser | null;
  email: string;
  setEmail: (value: string) => void;
  projectTitle: string;
  setProjectTitle: (value: string) => void;
  isSubmitting: boolean;
  isCheckingEmail: boolean;
  emailExists: boolean;
  errors: Record<string, string>;
}

export function FormFields({
  isAuthenticated,
  user,
  email,
  setEmail,
  projectTitle,
  setProjectTitle,
  isSubmitting,
  isCheckingEmail,
  emailExists,
  errors,
}: FormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Email field (only for unauthenticated users) */}
      {!isAuthenticated && (
        <div>
          <FormField
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="john@company.com"
            disabled={isSubmitting}
            error={errors.email}
            helperText={
              isCheckingEmail && email
                ? "Checking email..."
                : emailExists && !isCheckingEmail
                  ? 'This email is already registered. Click "Continue" to sign in.'
                  : undefined
            }
            required
          />
        </div>
      )}

      {/* Show current user email for authenticated users */}
      {isAuthenticated && user?.email && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            Email address
          </label>
          <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 rounded-md text-sm text-gray-600 dark:text-zinc-400">
            {user.email}
          </div>
        </div>
      )}

      {/* Project title field */}
      <FormField
        id="projectTitle"
        label="Project name"
        value={projectTitle}
        onChange={setProjectTitle}
        placeholder="Forest Road 43 repair, Tahoe NF"
        disabled={isSubmitting}
        error={errors.projectTitle}
        required
      />
    </div>
  );
}
