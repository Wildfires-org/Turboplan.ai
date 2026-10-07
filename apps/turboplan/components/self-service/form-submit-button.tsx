"use client";

import { Button } from "@wildfires-org/turboplan-utils";

interface FormSubmitButtonProps {
  isAuthenticated: boolean;
  isSubmitting: boolean;
  isCheckingEmail: boolean;
  emailExists: boolean;
}

export function FormSubmitButton({
  isAuthenticated,
  isSubmitting,
  isCheckingEmail,
  emailExists,
}: FormSubmitButtonProps) {
  const getButtonText = () => {
    if (isSubmitting) {
      if (isAuthenticated) {
        return "Creating project...";
      }
      return emailExists ? "Redirecting..." : "Creating account...";
    }

    if (isAuthenticated) {
      return "Create project";
    }
    return emailExists ? "Continue" : "Create account";
  };

  return (
    <Button
      type="submit"
      disabled={isSubmitting || isCheckingEmail}
      variant="brand"
      className="mt-6 w-full"
    >
      {getButtonText()}
    </Button>
  );
}
