"use client";

import {
  useAutoProcess,
  useEmailCheck,
  useFormState,
  useFormSubmit,
  useFormValidation,
  useUrlParams,
} from "@/app/self-service/hooks";
import { useLogout } from "@/hooks/use-logout";
import { appendAttributionParams } from "@/lib/signup-attribution";
import type { AuthUser } from "@/lib/types/auth";
import { EmailMismatchScreen } from "./email-mismatch-screen";
import { FormFields } from "./form-fields";
import { FormFooter } from "./form-footer";
import { FormHeader } from "./form-header";
import { FormSubmitButton } from "./form-submit-button";
import { LoadingState } from "./loading-state";

interface SelfServiceFormProps {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export function SelfServiceForm({
  user,
  isAuthenticated,
}: SelfServiceFormProps) {
  // Get URL parameters and check for email mismatch
  const {
    urlEmail,
    urlProjectTitle,
    urlProjectDescription,
    urlOrganizationId,
    urlOfficeId,
    attribution,
    hasEmailMismatch,
  } = useUrlParams({ isAuthenticated, user });

  // Form state management
  const { email, setEmail, projectTitle, setProjectTitle } = useFormState({
    isAuthenticated,
    user,
    urlEmail,
    urlProjectTitle,
  });

  // Form validation
  const { errors, validateForm } = useFormValidation({ isAuthenticated });

  // Auto-process hook
  const { isSubmitting, autoProcessed, showLoadingState, setIsSubmitting } =
    useAutoProcess({ user, isAuthenticated });

  // Email check hook
  const { emailExists, isCheckingEmail, setEmailExists } = useEmailCheck(
    email,
    isAuthenticated,
    autoProcessed,
  );

  // Form submission hook
  const { handleSubmit: handleFormSubmit } = useFormSubmit({
    isAuthenticated,
    setIsSubmitting,
    setEmailExists,
  });

  // Logout handler - preserves form data in URL params when redirecting
  const { logout } = useLogout();

  const handleLogout = async () => {
    const params = new URLSearchParams();
    if (urlEmail) params.set("email", urlEmail);
    if (projectTitle) params.set("projectTitle", projectTitle);
    if (urlProjectDescription)
      params.set("projectDescription", urlProjectDescription);
    appendAttributionParams(params, attribution);

    await logout({ redirectTo: `/self-service?${params.toString()}` });
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm({ email, projectTitle })) {
      return;
    }

    await handleFormSubmit({
      email,
      projectTitle,
      projectDescription: urlProjectDescription,
      organizationId: urlOrganizationId || undefined,
      officeId: urlOfficeId || undefined,
      attribution,
    });
  };

  // Show loading state during auto-processing
  if (showLoadingState) {
    return <LoadingState isAuthenticated={isAuthenticated} />;
  }

  // Show email mismatch screen
  if (hasEmailMismatch && user) {
    return (
      <EmailMismatchScreen
        user={user}
        urlEmail={urlEmail || ""}
        projectTitle={projectTitle}
        projectDescription={urlProjectDescription}
        isSubmitting={isSubmitting}
        onContinueWithLoggedInEmail={async () => {
          setIsSubmitting(true);
          await handleFormSubmit({
            email: user.email || "",
            projectTitle,
            projectDescription: urlProjectDescription,
            organizationId: urlOrganizationId || undefined,
            officeId: urlOfficeId || undefined,
            attribution,
          });
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Main form
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <FormHeader isAuthenticated={isAuthenticated} />

        <form onSubmit={handleSubmit}>
          <FormFields
            isAuthenticated={isAuthenticated}
            user={user}
            email={email}
            setEmail={setEmail}
            projectTitle={projectTitle}
            setProjectTitle={setProjectTitle}
            isSubmitting={isSubmitting}
            isCheckingEmail={isCheckingEmail}
            emailExists={emailExists}
            errors={errors}
          />

          <FormSubmitButton
            isAuthenticated={isAuthenticated}
            isSubmitting={isSubmitting}
            isCheckingEmail={isCheckingEmail}
            emailExists={emailExists}
          />
        </form>

        <FormFooter isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}
