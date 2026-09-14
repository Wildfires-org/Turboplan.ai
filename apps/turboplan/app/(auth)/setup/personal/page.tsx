"use client";

import { startTransition, useActionState, useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Input, Label } from "@wildfires-org/turboplan-utils";

import { toast } from "@/components/toast";
import { brand } from "@/lib/brand";
import { FormStatus } from "@/lib/form-status";
import { completeSetup, type SetupState } from "../actions";

const setupFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
});

type SetupFormData = z.infer<typeof setupFormSchema>;

export default function SetupPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupFormSchema),
    mode: "onChange",
  });

  // Pending UI must come from useActionState's own isPending: a manual
  // useState set alongside the dispatch gets entangled with the action's
  // transition lane in React 19 and may not commit until the action resolves,
  // so the button would never show its in-flight state.
  const [state, formAction, isPending] = useActionState<SetupState, FormData>(
    completeSetup,
    { status: FormStatus.IDLE },
  );

  useEffect(() => {
    if (state.status === FormStatus.SUCCESS) {
      toast({ type: "success", description: "Profile setup complete!" });
      // Next onboarding step. When billing is disabled, /setup/plan
      // immediately redirects to /?setup=true, so this push is safe for
      // open-source installs too.
      router.push("/setup/plan");
    } else if (state.status === FormStatus.FAILED) {
      toast({ type: "error", description: "Failed to save your information!" });
    } else if (state.status === FormStatus.INVALID_DATA) {
      toast({
        type: "error",
        description: "Please provide valid information!",
      });
    }
  }, [state, router]);

  const onSubmit = (data: SetupFormData) => {
    const formData = new FormData();
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName);
    // Manual dispatch (not via a form `action` prop) must run inside
    // startTransition, otherwise React never activates isPending.
    startTransition(() => {
      formAction(formData);
    });
  };

  const watchedFields = watch();
  const isValid =
    !!watchedFields.firstName?.trim() && !!watchedFields.lastName?.trim();

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-12">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-primary">{brand.name}</div>
          <div className="text-sm text-muted-foreground">Personal Info</div>
        </div>

        <div className="flex flex-col items-center justify-center gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4">
              Tell us a little about yourself
            </h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="e.g. John"
                {...register("firstName")}
                className="w-full"
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="e.g. Smith"
                {...register("lastName")}
                className="w-full"
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            <div className="flex justify-end items-center pt-8">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">Press Enter</div>
                <Button
                  type="submit"
                  disabled={isPending || !isValid}
                  className="px-8"
                >
                  {isPending ? "Saving..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
