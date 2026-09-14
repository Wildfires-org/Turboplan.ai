"use client";

import { type FormEvent, useState } from "react";

import { toast } from "sonner";

import {
  Button,
  Checkbox,
  Input,
  Label,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import {
  useDeleteOrgSigningConfig,
  useOrgSigningConfig,
  useUpdateOrgSigningConfig,
} from "../hooks/use-org-signing-config";

interface OrgSigningConfigProps {
  organizationId: string;
}

export const OrgSigningConfig = ({ organizationId }: OrgSigningConfigProps) => {
  const { config, isLoading, mutate } = useOrgSigningConfig(organizationId);
  const { updateConfig, isUpdating } =
    useUpdateOrgSigningConfig(organizationId);
  const { deleteConfig, isDeleting } =
    useDeleteOrgSigningConfig(organizationId);

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize form state from fetched config (once). Secrets (API key, webhook
  // secret) are never sent back from the server, so their inputs stay blank.
  if (config && !hasInitialized) {
    setApiUrl(config.documensoApiUrl);
    setIsEnabled(config.isEnabled);
    setHasInitialized(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-4 py-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!apiUrl.trim()) {
      toast.error("Documenso API URL is required");
      return;
    }

    if (!apiKey.trim()) {
      toast.error("API Key is required");
      return;
    }

    try {
      await updateConfig({
        documensoApiUrl: apiUrl.trim(),
        documensoApiKey: apiKey.trim(),
        documensoWebhookSecret: webhookSecret.trim() || undefined,
        isEnabled,
      });
      await mutate();
      setApiKey("");
      toast.success("Signing configuration saved");
    } catch {
      toast.error("Failed to save signing configuration");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteConfig();
      await mutate();
      setApiUrl("");
      setApiKey("");
      setWebhookSecret("");
      setIsEnabled(true);
      setHasInitialized(false);
      toast.success("Signing configuration removed");
    } catch {
      toast.error("Failed to remove signing configuration");
    }
  };

  return (
    <div className="max-w-xl py-6">
      <p className="text-sm text-muted-foreground mb-6">
        Configure a custom Documenso instance for this organization. Leave
        unconfigured to use the platform default.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="documenso-api-url">Documenso API URL</Label>
          <Input
            id="documenso-api-url"
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://documenso.example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="documenso-api-key">API Key</Label>
          <Input
            id="documenso-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="documenso-webhook-secret">Webhook Secret</Label>
          <Input
            id="documenso-webhook-secret"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="signing-enabled"
            checked={isEnabled}
            onCheckedChange={(checked) => setIsEnabled(checked === true)}
          />
          <Label htmlFor="signing-enabled" className="cursor-pointer">
            Enabled
          </Label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save"}
          </Button>

          {config && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Configuration"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
