import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DialogBaseProps {
  title?: string;
  separator?: boolean;
  children: React.ReactNode;
  triggerSlot: React.ReactNode;
  footerSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function DialogBase({
  title,
  triggerSlot,
  footerSlot,
  headerSlot,
  separator = true,
  children,
  className,
  isOpen,
  onOpenChange,
}: DialogBaseProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {triggerSlot}
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "max-h-[90vh] z-[50] flex flex-col outline-hidden overflow-hidden",
          className,
        )}
      >
        <DialogHeader>
          {headerSlot ? (
            <>
              {title != null && (
                <DialogTitle className="sr-only">{title}</DialogTitle>
              )}
              {headerSlot}
            </>
          ) : headerSlot === null ? (
            <DialogTitle className="hidden" />
          ) : title ? (
            <DialogTitle>{title}</DialogTitle>
          ) : (
            <DialogTitle className="hidden" />
          )}
        </DialogHeader>

        {separator && <Separator className="!mt-6 max-lg:!mt-4" />}
        <div className="flex-grow overflow-hidden">{children}</div>
        {footerSlot && <DialogFooter>{footerSlot}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
