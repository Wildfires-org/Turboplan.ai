import Image from "next/image";

import { brand } from "@/lib/brand";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const appName = brand.name;

  return (
    <div className="flex min-h-dvh w-screen bg-brandAlt-100">
      {/* Logo top-left */}
      <div className="absolute top-6 left-6 sm:top-[63px] sm:left-[116px] flex items-center gap-1.5">
        <Image
          src={brand.logo}
          alt={appName}
          width={32}
          height={32}
          className="size-8"
        />
        <span className="font-mono font-semibold text-[22px] bg-gradient-to-b from-neutral-800 to-[#033923] bg-clip-text text-transparent tracking-tight">
          {appName}
        </span>
      </div>

      {/* Centered card */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-9 w-full max-w-[456px]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
