import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routing } from "@/utils/routing";

export default function ProjectNotFound() {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <div className="text-6xl mb-6">🔒</div>
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Project Not Found
      </h1>
      <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8">
        This project doesn&apos;t exist or is not publicly available. The
        project owner may have made it private.
      </p>
      <Button asChild>
        <Link href={routing.catalog()}>Browse Projects</Link>
      </Button>
    </div>
  );
}
