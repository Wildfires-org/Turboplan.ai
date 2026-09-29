import { Lock } from "lucide-react";
import Link from "next/link";

import BeaverRight from "@/../public/images/beaver_right.png";
import {
  GLASS_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/catalog/catalog-layout";
import { StatusPanel } from "@/components/shared/status-panel";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

export default function ProjectNotFound() {
  return (
    <StatusPanel
      icon={Lock}
      eyebrow="Not available"
      title="Project not found"
      lead="This project doesn't exist or is not publicly available. The project owner may have made it private."
      image={BeaverRight}
      actions={
        <>
          <Link
            href={routing.catalog()}
            className={cn(PRIMARY_BUTTON_CLASS, "h-11")}
          >
            Browse projects
          </Link>
          <Link
            href={routing.home()}
            className={cn(GLASS_BUTTON_CLASS, "h-11")}
          >
            Go to homepage
          </Link>
        </>
      }
    />
  );
}
