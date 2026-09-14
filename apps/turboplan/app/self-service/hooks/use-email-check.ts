import { useEffect, useState } from "react";

import { checkEmailExists } from "../actions";

export function useEmailCheck(
  email: string,
  isAuthenticated: boolean,
  autoProcessed: boolean,
) {
  const [emailExists, setEmailExists] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  useEffect(() => {
    if (isAuthenticated || autoProcessed) {
      // Skip email check for authenticated users or if auto-processed
      return;
    }

    const checkEmail = async () => {
      if (!email) {
        setIsCheckingEmail(false);
        return;
      }

      setIsCheckingEmail(true);
      const result = await checkEmailExists(email);
      setEmailExists(result.exists);
      setIsCheckingEmail(false);
    };

    // Debounce the email check
    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [email, isAuthenticated, autoProcessed]);

  return { emailExists, isCheckingEmail, setEmailExists };
}
