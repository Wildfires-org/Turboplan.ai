"use client";

import { Suspense, useActionState, useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { ATTRIBUTION_PARAMS } from "@/lib/signup-attribution";
import { type MagicLinkActionState, requestRegistrationLink } from "../actions";

const RegisterContent = () => {
  const router = useRouter();
  // useSearchParams needs a Suspense boundary above it for static rendering —
  // same structure as /login (page wraps LoginForm in Suspense).
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<MagicLinkActionState, FormData>(
    requestRegistrationLink,
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
      router.push(
        `/check-email?email=${encodeURIComponent(email)}&type=verification`,
      );
    }
  }, [state, router, email]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    // Forward landing-page attribution that rode in on the URL so the signup
    // is attributed like a self-service one (mirrors login-form.tsx).
    for (const param of ATTRIBUTION_PARAMS) {
      const value = searchParams.get(param);
      if (value) {
        formData.set(param, value);
      }
    }
    formAction(formData);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-[30px]">
        <div className="flex flex-col items-center gap-9 w-full">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-2xl font-semibold text-gray-950">Sign Up</h1>
            <p className="text-sm text-neutral-400">
              Enter your email to create an account
            </p>
          </div>
          <AuthForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton isSuccessful={isSuccessful}>
              Send verification link
            </SubmitButton>
          </AuthForm>
        </div>
        <p className="text-center text-sm text-neutral-400">
          {"Already have an account? "}
          <Link
            href="/login"
            className="font-bold text-brandAlt-400 hover:underline"
          >
            Sign in
          </Link>
          {" instead."}
        </p>
      </div>
      <Image
        src="/images/auth/beaver-signin.png"
        alt=""
        width={162}
        height={165}
        className="absolute -bottom-[26px] -right-24 pointer-events-none hidden sm:block"
      />
    </>
  );
};

const Page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
};

export default Page;
