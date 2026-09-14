import Form from "next/form";

import { Input, Label } from "@wildfires-org/turboplan-utils";

export const AuthForm = ({
  action,
  children,
  defaultEmail = "",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
}) => {
  return (
    <Form action={action} className="flex flex-col gap-5 w-full min-w-[340px]">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-neutral-500 font-normal">
          Email Address
        </Label>

        <Input
          id="email"
          name="email"
          className="bg-neutral-50 border-gray-250 h-10 rounded-md text-sm pl-4"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          autoFocus
          defaultValue={defaultEmail}
        />
      </div>

      {children}
    </Form>
  );
};
