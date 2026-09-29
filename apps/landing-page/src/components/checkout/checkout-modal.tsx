"use client";

import { X } from "lucide-react";

import { CheckoutView } from "@wildfires-org/turboplan-billing/client";
import { CATALOG } from "@wildfires-org/turboplan-billing/types";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_SURFACE_CLASS,
} from "@/components/catalog/catalog-layout";
import DialogBase from "@/components/dialogs/dialog-base/dialog-base";
import { cn } from "@/lib/utils";

interface CheckoutModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutModal({ isOpen, onOpenChange }: CheckoutModalProps) {
  return (
    <DialogBase
      className={cn(MODAL_SURFACE_CLASS, "w-[calc(100%-24px)] max-w-[960px]")}
      separator={false}
      triggerSlot={null}
      headerSlot={null}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <button
        type="button"
        aria-label="Close"
        className={MODAL_CLOSE_BUTTON_CLASS}
        onClick={(e) => {
          onOpenChange(false);
          e.stopPropagation();
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
      {/* 90vh = DialogBase max height, minus the 1.5px surface border. */}
      <div className="flex max-h-[calc(90vh-3px)] w-full flex-col gap-6 overflow-y-auto p-6 sm:p-8">
        <header className="pr-12">
          <h2 className="font-heading text-[28px] font-normal leading-[1.15] tracking-[-0.04em] text-balance text-egray-900 sm:text-[32px]">
            Choose your plan
          </h2>
          <p className="mt-2 font-inter text-[15px] leading-[22px] text-egray-700">
            {CATALOG.billing.trial_days > 0
              ? `You won't be charged until your ${CATALOG.billing.trial_days}-day free trial ends.`
              : "A flat workspace price — seats beyond the included count bill separately."}
          </p>
        </header>

        <CheckoutView
          showHeader={false}
          turboplanUrl={getLandingPageEnv().TURBOPLAN_URL}
        />
      </div>
    </DialogBase>
  );
}
