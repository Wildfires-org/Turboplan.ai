"use client";

import { Suspense } from "react";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const CheckEmailContent = () => {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const type = searchParams.get("type") || "login";

  const isVerification = type === "verification";

  return (
    <>
      <div className="flex flex-col items-center gap-9">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-2xl font-semibold text-gray-950">
            Check your inbox
          </h1>
          <p className="text-sm text-neutral-400">
            {isVerification
              ? "We sent a verification link to"
              : "We sent a sign-in link to"}
          </p>
        </div>
        {email && (
          <div className="w-full border border-dashed border-gray-250 rounded-md h-10 flex items-center justify-center">
            <span className="text-sm text-gray-950">{email}</span>
          </div>
        )}
      </div>
      <p className="text-center text-sm text-neutral-400 mt-9">
        {"Didn't receive the email? "}
        <Link
          href="/login"
          className="font-bold text-brandAlt-400 hover:underline"
        >
          Try again
        </Link>
      </p>
      <Image
        src="/images/auth/beaver-inbox.png"
        alt=""
        width={159}
        height={162}
        className="absolute -bottom-4 -right-16 pointer-events-none hidden sm:block"
      />
    </>
  );
};

const CheckEmailPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="size-8 rounded-full border-2 border-brandAlt-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
};

export default CheckEmailPage;
