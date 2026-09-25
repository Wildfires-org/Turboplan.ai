"use client";

import { useState } from "react";

import Link from "next/link";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import { useSession } from "@wildfires-org/turboplan-auth/client";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import Cross from "@/components/icons/cross";
import LabeledInput from "@/components/shared/labeled-input";
import LabeledTextarea from "@/components/shared/labeled-textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import DialogBase from "../dialog-base/dialog-base";

const { TURBOPLAN_URL } = getLandingPageEnv();

interface CatalogRequestDialogProps {
  children: React.ReactNode;
}

export default function CatalogRequestDialog({
  children,
}: CatalogRequestDialogProps) {
  const { toast } = useToast();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  const { trigger, isMutating, data } = useSWRMutation(
    "/api/admin/cataloger/run",
    postFetcher<{ runId: string; status: string }>,
  );

  const isSuccess = !!data;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setMessage("");
      setHasError(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setHasError(true);
      return;
    }

    try {
      await trigger({ message: message.trim() });
    } catch (error) {
      toast({
        title: "Catalog Request",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DialogBase
      className="w-[calc(100%-24px)] md:w-[448px] rounded-lg bg-neutral-light border-[0.75px] border-neutral-grey"
      separator={false}
      triggerSlot={children}
      headerSlot={null}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
    >
      <Cross
        className="absolute right-7 top-7 cursor-pointer"
        onClick={(e) => {
          handleOpenChange(false);
          e?.stopPropagation();
        }}
      />
      <div className="w-full flex flex-col p-6 gap-2 items-center">
        <h2 className="text-neutral-black text-lg text-center pb-2">
          Request for <span className="text-green-60">Catalog</span>
        </h2>

        {!isLoggedIn ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-neutral-black">
              Sign in to request catalog templates.
            </p>
            <Link
              href={TURBOPLAN_URL}
              className="text-sm font-medium text-green-60 underline underline-offset-4 hover:text-green-70"
            >
              Sign in to TurboPlan
            </Link>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-neutral-black">
              Your request has been submitted. Templates will appear in the
              catalog shortly.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-4">
            <LabeledInput
              label="Email address"
              type="email"
              value={session?.user?.email ?? ""}
              disabled
              className="bg-white"
            />
            <LabeledTextarea
              label="Message"
              placeholder="Describe the catalog templates you need..."
              className="bg-white resize-none"
              hasError={hasError}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (hasError && e.target.value.trim()) {
                  setHasError(false);
                }
              }}
            />
            <div className="flex justify-center mt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isMutating}
                className="rounded-full"
              >
                {isMutating ? "Sending" : "Send it"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DialogBase>
  );
}
