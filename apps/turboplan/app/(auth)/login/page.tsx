import { Suspense } from "react";

import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "./login-form";

const Page = () => {
  return (
    <>
      <div className="flex flex-col items-center gap-[30px]">
        <div className="flex flex-col items-center gap-9 w-full">
          <div className="flex flex-col items-center gap-1.5 text-center">
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

export default Page;
