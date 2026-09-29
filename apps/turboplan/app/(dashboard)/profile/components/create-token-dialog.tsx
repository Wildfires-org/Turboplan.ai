"use client";

import { useState } from "react";

import { Check, Copy, Loader2, Plus } from "lucide-react";

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import { useAccessTokens, useCreateToken } from "@/hooks/use-access-tokens";
import { HEADER_ACTION_BUTTON_CLASS } from "@/lib/glass";

// Tokens always expire; the server caps the lifetime at 365 days.
type ExpirationOption = "30d" | "90d" | "1y";

const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

const EXPIRATION_DAYS: Record<ExpirationOption, number> = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

const getExpirationDate = (option: ExpirationOption): string => {
  const date = new Date();
  date.setDate(date.getDate() + EXPIRATION_DAYS[option]);
  return date.toISOString();
};

export const CreateTokenDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [actor, setActor] = useState("");
  const [expiration, setExpiration] = useState<ExpirationOption>("90d");
  const [plaintextToken, setPlaintextToken] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const { mutate } = useAccessTokens();
  const { createToken, isCreating, error: createError } = useCreateToken();

  const isFormValid = name.trim().length > 0 && actor.trim().length > 0;

  const handleSubmit = async () => {
    if (!isFormValid || isCreating) {
      return;
    }

    const result = await createToken({
      name: name.trim(),
      actor: actor.trim(),
      expiresAt: getExpirationDate(expiration),
    });

    if (result) {
      setPlaintextToken(result.token);
    }
  };

  const handleCopy = async () => {
    if (!plaintextToken) {
      return;
    }

    await navigator.clipboard.writeText(plaintextToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setName("");
      setActor("");
      setExpiration("90d");
      setPlaintextToken(null);
      setIsCopied(false);
      mutate();
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <Button
        variant="brand"
        onClick={() => setIsOpen(true)}
        className={cn(HEADER_ACTION_BUTTON_CLASS, "shrink-0 self-start")}
      >
        <Plus aria-hidden />
        Create token
      </Button>
      <DialogContent className="sm:max-w-md">
        {plaintextToken ? (
          <>
            <DialogHeader>
              <DialogTitle>Token created</DialogTitle>
              <DialogDescription>
                Copy this token now. You won&apos;t be able to see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={plaintextToken}
                  className="font-mono text-sm"
                />
                <Button
                  variant="glass"
                  size="icon"
                  aria-label={isCopied ? "Copied" : "Copy token"}
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {isCopied ? (
                    <Check className="size-4 text-brand-800" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800 ring-1 ring-inset ring-amber-700/15 dark:bg-amber-950/30 dark:text-amber-300">
                Make sure to copy your personal access token now. You won&apos;t
                be able to see it again.
              </p>
            </div>
            <DialogFooter>
              <Button variant="brand" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create access token</DialogTitle>
              <DialogDescription>
                Create a personal access token for API integrations.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token-name">Name</Label>
                  <Input
                    id="token-name"
                    placeholder="My integration token"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-actor">Actor</Label>
                  <Input
                    id="token-actor"
                    placeholder="e.g., hermes-slack, claude-code"
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-expiration">Expiration</Label>
                  <Select
                    value={expiration}
                    onValueChange={(value) =>
                      setExpiration(value as ExpirationOption)
                    }
                  >
                    <SelectTrigger id="token-expiration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createError ? (
                  <p role="alert" className="text-[13px] text-error-700">
                    {createError}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:space-x-0">
                <Button
                  type="button"
                  variant="glass"
                  onClick={() => handleClose(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  disabled={!isFormValid || isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
