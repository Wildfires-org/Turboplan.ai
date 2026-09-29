"use client";

import { useActionState, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { ATTRIBUTION_PARAMS } from "@/lib/signup-attribution";
import { type MagicLinkActionState, requestLoginLink } from "../actions";

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<MagicLinkActionState, FormData>(
    requestLoginLink,
    {
      status: "idle",
    },
  );

  useEffect(() => {
    if (state.status === "failed") {
      toast({
        type: "error",
        description: "Something went wrong. Please try again.",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Please enter a valid email address.",
      });
    } else if (state.status === "email_sent") {
      setIsSuccessful(true);
      router.push(`/check-email?email=${encodeURIComponent(email)}&type=login`);
    }
  }, [state.status, router, email]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    // requestLoginLink auto-registers unknown emails, so this submission can be
    // a signup. Forward the landing-page attribution that rode in on the URL so
    // that signup is attributed like a self-service one.
    // Where to land after the magic link (e.g. back to an invitation). The
    // server only honours same-site relative paths.
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl) {
      formData.set("callbackUrl", callbackUrl);
    }
    for (const param of ATTRIBUTION_PARAMS) {
      const value = searchParams.get(param);
      if (value) {
        formData.set(param, value);
      }
    }
    formAction(formData);
  };

  return (
    <AuthForm action={handleSubmit} defaultEmail={email}>
      <SubmitButton isSuccessful={isSuccessful}>Send sign-in link</SubmitButton>
    </AuthForm>
  );
};
