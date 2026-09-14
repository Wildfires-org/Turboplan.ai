import type { SignupAttribution } from "@/lib/signup-attribution";
import { useSubmission } from "./use-submission";

interface UseFormSubmitParams {
  isAuthenticated: boolean;
  setIsSubmitting: (value: boolean) => void;
  setEmailExists: (value: boolean) => void;
}

interface FormData {
  email: string;
  projectTitle: string;
  projectDescription?: string;
  organizationId?: string;
  officeId?: string;
  attribution?: SignupAttribution;
}

export function useFormSubmit({
  isAuthenticated,
  setIsSubmitting,
  setEmailExists,
}: UseFormSubmitParams) {
  const { submitForm } = useSubmission();

  const handleSubmit = async (formData: FormData) => {
    const {
      email,
      projectTitle,
      projectDescription,
      organizationId,
      officeId,
      attribution,
    } = formData;

    setIsSubmitting(true);

    const success = await submitForm(
      {
        email,
        projectTitle,
        projectDescription,
        organizationId,
        officeId,
        attribution,
      },
      isAuthenticated,
      {
        onEmailExists: () => setEmailExists(true),
      },
    );

    if (!success) {
      setIsSubmitting(false);
    }
  };

  return { handleSubmit };
}
