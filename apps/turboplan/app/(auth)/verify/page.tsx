"use client";

import { Suspense, useEffect, useState } from "react";

import { CircleCheck, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { verifyMagicLink } from "../actions";

type VerifyStatus = "loading" | "success" | "error" | "invalid" | "expired";

const VerifyContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const userId = searchParams.get("userId");
  const type =
    (searchParams.get("type") as "verification" | "login") || "verification";
  const redirectTo = searchParams.get("redirectTo");
  const setupProjectId = searchParams.get("setupProjectId");

  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const verify = async () => {
      if (!token || !userId) {
        setStatus("invalid");
        setErrorMessage("Invalid magic link. Please request a new one.");
        return;
      }

      try {
        const result = await verifyMagicLink(
          userId,
          token,
          type,
          redirectTo || undefined,
          setupProjectId || undefined,
        );

        if (result.status === "success") {
          setStatus("success");
          setTimeout(() => {
            router.push(result.redirectTo || "/");
          }, 1500);
        } else if (result.status === "invalid_token") {
          setStatus("invalid");
          setErrorMessage("This link is invalid or has already been used.");
        } else if (result.status === "expired") {
          setStatus("expired");
          setErrorMessage("This link has expired. Please request a new one.");
        } else {
          setStatus("error");
          setErrorMessage("Something went wrong. Please try again.");
        }
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      }
    };

    verify();
  }, [token, userId, type, redirectTo, setupProjectId, router]);

  const isError =
    status === "error" || status === "invalid" || status === "expired";

  const getBeaverSrc = () => {
    if (status === "loading") {
      return "/images/auth/beaver-verifying.gif";
    }
    if (status === "success") {
      return "/images/auth/beaver-success.png";
    }
    return "/images/auth/beaver-failed.png";
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        {status === "loading" && (
          <>
            <Image
              src={getBeaverSrc()}
              alt=""
              width={111}
              height={120}
              className="mb-2"
              unoptimized
            />
            <h1 className="text-2xl font-bold text-gray-950">Verifying...</h1>
            <p className="text-sm text-neutral-400">
              Please wait while we verify your link
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex items-center justify-center rounded-full bg-brandAlt-100 p-3">
              <CircleCheck className="size-8 text-brandAlt-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-950">
              {type === "verification" ? "Email verified!" : "Signed in!"}
            </h1>
            <p className="text-sm text-neutral-400">Redirecting you now...</p>
          </>
        )}

        {isError && (
          <>
            <div className="flex items-center justify-center rounded-full bg-error-100 p-3">
              <XCircle className="size-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-950">
              Verification failed
            </h1>
            <p className="text-sm text-neutral-400">{errorMessage}</p>
          </>
        )}
      </div>

      {isError && (
        <p className="text-center text-sm text-neutral-400 mt-9">
          <Link
            href="/login"
            className="font-bold text-brandAlt-400 hover:underline"
          >
            Try signing in again
          </Link>
          {" or "}
          <Link
            href="/register"
            className="font-bold text-brandAlt-400 hover:underline"
          >
            Create a new account
          </Link>
        </p>
      )}

      {status !== "loading" && (
        <Image
          src={getBeaverSrc()}
          alt=""
          width={166}
          height={168}
          className="absolute -bottom-4 -right-16 pointer-events-none hidden sm:block"
          unoptimized
        />
      )}
    </>
  );
};

const VerifyPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="size-8 rounded-full border-2 border-brandAlt-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
};

export default VerifyPage;
