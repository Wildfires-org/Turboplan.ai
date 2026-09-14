import { useRouter } from "next/navigation";

import { toast } from "@/components/toast";
import { AppUrls } from "@/lib/nav/urls";
import type { SignupAttribution } from "@/lib/signup-attribution";
import {
  type CreateProjectResult,
  type CreateUserWithOrganizationResult,
  createProjectForAuthenticatedUser,
  createUserWithOrganization,
} from "../actions";
import { useEmailExistsRedirect } from "./use-email-exists-redirect";

interface SubmitFormData {
  email: string;
  projectTitle: string;
  projectDescription?: string;
  organizationId?: string;
  officeId?: string;
  /** Landing-page handoff attribution; only meaningful on the signup path. */
  attribution?: SignupAttribution;
}

interface SubmissionOptions {
  /**
   * Callback to update email exists state (for form validation feedback)
   */
  onEmailExists?: () => void;
}

/**
 * Consolidated submission logic for both auto-process and manual form submission.
 * Handles authenticated and unauthenticated user flows.
 */
export function useSubmission() {
  const router = useRouter();
  const { checkAndRedirect } = useEmailExistsRedirect();

  const submitForm = async (
    data: SubmitFormData,
    isAuthenticated: boolean,
    options: SubmissionOptions = {},
  ): Promise<boolean> => {
    const {
      email,
      projectTitle,
      projectDescription,
      organizationId,
      officeId,
      attribution,
    } = data;
    const { onEmailExists } = options;

    try {
      // For unauthenticated users, check if email exists first
      if (!isAuthenticated && email) {
        const emailExists = await checkAndRedirect({
          email,
          projectTitle,
          projectDescription,
          attribution,
        });

        // If email exists, redirect was initiated
        if (emailExists) {
          if (onEmailExists) {
            onEmailExists();
          }
          return false; // Submission did not complete
        }

        // Email doesn't exist, proceed with registration
        const result: CreateUserWithOrganizationResult =
          await createUserWithOrganization({
            email,
            projectTitle,
            projectDescription: projectDescription || undefined,
            organizationId: organizationId || undefined,
            officeId: officeId || undefined,
            attribution,
          });

        if (result.status === "success") {
          toast({
            type: "success",
            description: "Account created successfully!",
          });

          if (result.redirectTo) {
            router.push(result.redirectTo);
          } else {
            router.push("/");
          }
          return true;
        } else if (result.status === "email_sent") {
          // Registration successful - user needs to verify email
          toast({
            type: "success",
            description: "Check your email for a verification link!",
          });

          // Redirect to check-email page with the email
          const checkEmailUrl = `/check-email?email=${encodeURIComponent(result.email || data.email)}`;
          router.push(checkEmailUrl);
          return true;
        } else if (result.status === "user_exists") {
          toast({
            type: "error",
            description: "This email is already registered.",
          });
          if (onEmailExists) {
            onEmailExists();
          }
          return false;
        } else if (result.status === "invalid_data") {
          toast({
            type: "error",
            description: result.error || "Invalid data provided",
          });
          return false;
        } else {
          toast({
            type: "error",
            description: result.error || "Failed to create account",
          });
          return false;
        }
      } else if (isAuthenticated) {
        // Authenticated user - create project
        const result: CreateProjectResult =
          await createProjectForAuthenticatedUser({
            projectTitle,
            projectDescription: projectDescription || undefined,
            existingOrgId: organizationId || undefined,
            existingOfficeId: officeId || undefined,
          });

        if (result.status === "success") {
          toast({
            type: "success",
            description: "Project created successfully!",
          });

          if (result.redirectTo) {
            router.push(result.redirectTo);
          } else {
            router.push("/");
          }
          return true;
        } else if (result.status === "upgrade_required") {
          // The org's plan reached its active-project limit. This submission path is shared between
          // the manual self-service form and the URL-param auto-processor (which
          // runs mid-navigation with only a loading screen), so there is no
          // stable surface to mount the full upgrade modal here. We keep a toast
          // but make the limit explicit and link to billing, where the in-app
          // upgrade flow lives. The org id is threaded through the result for
          // when a modal-capable call site adopts this path.
          toast({
            type: "error",
            description:
              "This organization reached its plan limit for projects. Upgrade to keep creating.",
            action: result.organizationSlug
              ? {
                  label: "Upgrade",
                  href: AppUrls.organizationBilling(result.organizationSlug),
                }
              : undefined,
          });
          return false;
        } else if (result.status === "invalid_data") {
          toast({
            type: "error",
            description: result.error || "Invalid data provided",
          });
          return false;
        } else {
          toast({
            type: "error",
            description: result.error || "Failed to create project",
          });
          return false;
        }
      }

      return false;
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
      });
      return false;
    }
  };

  return { submitForm };
}
