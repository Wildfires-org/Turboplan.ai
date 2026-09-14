"use client";

import { useState } from "react";

import { Check, Copy, Loader2 } from "lucide-react";

import {
  Button,
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

type ExpirationOption = "30d" | "90d" | "1y" | "never";

const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "never", label: "Never" },
];

const getExpirationDate = (option: ExpirationOption): string | undefined => {
  const now = new Date();

  switch (option) {
    case "30d":
      now.setDate(now.getDate() + 30);
      return now.toISOString();
    case "90d":
      now.setDate(now.getDate() + 90);
      return now.toISOString();
    case "1y":
      now.setFullYear(now.getFullYear() + 1);
      return now.toISOString();
    case "never":
      return undefined;
  }
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
      <Button onClick={() => setIsOpen(true)}>Create Token</Button>
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
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {isCopied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Make sure to copy your personal access token now. You won&apos;t
                be able to see it again.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
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
                  <p className="text-sm text-destructive">{createError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!isFormValid || isCreating}>
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
