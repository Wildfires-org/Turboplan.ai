"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { getSupportEmail } from "@wildfires-org/turboplan-env";
import { Button } from "@wildfires-org/turboplan-utils";

import { BrandHeader, BrandMark } from "@/components/brand-mark";

interface ErrorPageProps {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  showGoBack?: boolean;
  showFooter?: boolean;
}

export const ErrorPage = ({
  title,
  description,
  primaryAction = { label: "Return to Basecamp", href: "/" },
  showGoBack = true,
  showFooter = true,
}: ErrorPageProps) => {
  const router = useRouter();
  const supportEmail = getSupportEmail();

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh w-screen bg-brandAlt-100">
      <BrandHeader />

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-9 w-full max-w-[456px]">
          <div className="flex flex-col items-center gap-[30px]">
            <div className="flex flex-col items-center gap-9 w-full">
              <div className="flex flex-col items-center gap-[18px] w-full max-w-[384px]">
                <BrandMark size={64} />
                <h1 className="text-2xl font-semibold text-foreground text-center">
                  {title}
                </h1>
                <p className="text-sm text-gray-400 text-center leading-5">
                  {description}
                </p>
              </div>

              <div className="flex items-start gap-1.5">
                {showGoBack && (
                  <Button
                    variant="ghost"
                    className="text-[15px] font-medium"
                    onClick={() => router.back()}
                  >
                    Go back
                  </Button>
                )}
                {primaryAction.href ? (
                  <Button
                    asChild
                    variant="brand"
                    className="text-[15px] font-medium min-w-[201px]"
                  >
                    <Link href={primaryAction.href}>{primaryAction.label}</Link>
                  </Button>
                ) : (
                  <Button
                    variant="brand"
                    className="text-[15px] font-medium min-w-[201px]"
                    onClick={primaryAction.onClick}
                  >
                    {primaryAction.label}
                  </Button>
                )}
              </div>
            </div>

            {showFooter && (
              <p className="text-xs text-gray-400 text-center">
                Keep hitting this dead end?{" "}
                <a href={`mailto:${supportEmail}`} className="underline">
                  Report
                </a>{" "}
                it to our support rangers.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
