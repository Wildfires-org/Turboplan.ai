"use client";

import { Button } from "@wildfires-org/turboplan-utils";

import type { AuthUser } from "@/lib/types/auth";

interface EmailMismatchScreenProps {
  user: AuthUser;
  urlEmail: string;
  projectTitle: string;
  projectDescription: string;
  isSubmitting: boolean;
  onContinueWithLoggedInEmail: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export function EmailMismatchScreen({
  user,
  urlEmail,
  projectTitle,
  isSubmitting,
  onContinueWithLoggedInEmail,
  onLogout,
}: EmailMismatchScreenProps) {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-800 p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="size-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <svg
                className="size-8 text-green-600 dark:text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-neutral-black dark:text-zinc-50 mb-4">
            Which email would you like to use?
          </h1>

          {/* Description */}
          <p className="text-center text-gray-600 dark:text-zinc-400 mb-8 text-lg">
            You&apos;re currently logged in as{" "}
            <span className="font-semibold text-neutral-black dark:text-zinc-50">
              {user.email}
            </span>
            , but you entered{" "}
            <span className="font-semibold text-neutral-black dark:text-zinc-50">
              {urlEmail}
            </span>{" "}
            in the form.
          </p>

          {/* Project details card */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-6 mb-8">
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
              Project details:
            </p>
            <div className="space-y-2">
              {projectTitle && (
                <p className="text-base">
                  <span className="text-gray-600 dark:text-zinc-400">
                    Project:
                  </span>{" "}
                  <span className="font-medium text-neutral-black dark:text-zinc-50">
                    {projectTitle}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={onContinueWithLoggedInEmail}
              disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-xl text-base font-medium transition-colors"
            >
              {isSubmitting
                ? "Creating project..."
                : `Continue with ${user.email}`}
            </Button>

            <Button
              type="button"
              onClick={onLogout}
              disabled={isSubmitting}
              variant="outline"
              className="w-full border-2 border-gray-300 dark:border-zinc-700 text-neutral-black dark:text-zinc-50 hover:bg-gray-50 dark:hover:bg-zinc-800 py-6 rounded-xl text-base font-medium transition-colors"
            >
              Logout and use {urlEmail}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
