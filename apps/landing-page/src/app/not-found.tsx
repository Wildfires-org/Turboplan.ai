import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import BeaverLeft from "@/../public/images/beaver_left.png";
import {
  GLASS_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/catalog/catalog-layout";
import { GoBackButton } from "@/components/shared/go-back-button";
import { StatusPanel } from "@/components/shared/status-panel";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

// A server component so it can set its own title; it used to inherit the home
// page's on every 404.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <StatusPanel
      icon={Compass}
      eyebrow="404"
      title="Page not found"
      lead="The page you're looking for doesn't exist or has been moved."
      image={BeaverLeft}
      actions={
        <>
          <Link
            href={routing.home()}
            className={cn(PRIMARY_BUTTON_CLASS, "h-11")}
          >
            Go to homepage
          </Link>
          <GoBackButton className={cn(GLASS_BUTTON_CLASS, "h-11")} />
        </>
      }
    />
  );
}
