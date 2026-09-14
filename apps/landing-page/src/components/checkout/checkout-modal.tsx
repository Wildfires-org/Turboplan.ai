"use client";

import { CheckoutView } from "@wildfires-org/turboplan-billing/client";
import { CATALOG } from "@wildfires-org/turboplan-billing/types";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import DialogBase from "@/components/dialogs/dialog-base/dialog-base";
import Cross from "@/components/icons/cross";

interface CheckoutModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutModal({ isOpen, onOpenChange }: CheckoutModalProps) {
  return (
    <DialogBase
      className="w-[calc(100%-24px)] max-w-[960px] rounded-lg bg-neutral-light border-[0.75px] border-neutral-grey"
      separator={false}
      triggerSlot={null}
      headerSlot={null}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Cross
        className="absolute right-7 top-7 cursor-pointer"
        onClick={(e) => {
          onOpenChange(false);
          e?.stopPropagation();
        }}
      />
      <div className="flex w-full flex-col gap-6 overflow-y-auto p-6 md:p-8">
        <header>
          <h2 className="text-2xl font-medium text-neutral-black">
            Choose your plan
          </h2>
          <p className="mt-1 text-sm text-gray-70">
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
