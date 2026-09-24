"use client";

import { Compass } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import BeaverLeft from "@/../public/images/beaver_left.png";
import {
  GLASS_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/catalog/catalog-layout";
import { StatusPanel } from "@/components/shared/status-panel";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

export default function NotFound() {
  const router = useRouter();

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
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(GLASS_BUTTON_CLASS, "h-11")}
          >
            Go back
          </button>
        </>
      }
    />
  );
}
