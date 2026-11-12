import { Suspense } from "react";

import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

const Page = () => {
  return (
    <div className="flex flex-col items-center gap-[30px]">
      <div className="flex flex-col items-center gap-9 w-full">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <BrandMark size={56} className="mb-4" />
          <h1 className="text-2xl font-semibold text-gray-950">Sign In</h1>
          <p className="text-sm text-neutral-400">
            Enter your email to receive a sign in link
          </p>
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="text-center text-sm text-neutral-400">
        {"Don't have an account? "}
        <Link
          href="/register"
          className="font-bold text-brandAlt-400 hover:underline"
        >
          Sign up
        </Link>
        {" for free."}
      </p>
    </div>
  );
};

export default Page;
