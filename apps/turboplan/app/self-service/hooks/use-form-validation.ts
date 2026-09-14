import { useState } from "react";

interface ValidationErrors {
  [key: string]: string;
}

interface UseFormValidationParams {
  isAuthenticated: boolean;
}

export function useFormValidation({
  isAuthenticated,
}: UseFormValidationParams) {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateForm = (data: {
    email: string;
    projectTitle: string;
  }): boolean => {
    const newErrors: ValidationErrors = {};

    // Email validation (only for unauthenticated users)
    if (!isAuthenticated) {
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    if (!data.projectTitle) {
      newErrors.projectTitle = "Project title is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, setErrors, validateForm };
}
