"use client";

import { Input, Label } from "@wildfires-org/turboplan-utils";

import type { DialogForm } from "./schema";

interface ProjectNameFieldProps {
  form: DialogForm;
}

export function ProjectNameField({ form }: ProjectNameFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="name">Project name</Label>
      <Input
        id="name"
        placeholder="Enter your project name..."
        maxLength={100}
        {...form.register("name")}
        disabled={form.formState.isSubmitting}
      />
      {form.formState.errors.name && (
        <p className="text-sm text-error-700">
          {form.formState.errors.name.message}
        </p>
      )}
    </div>
  );
}
