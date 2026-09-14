"use client";

import { useLogout } from "@/hooks/use-logout";

export const SignOutForm = () => {
  const { logout } = useLogout();

  return (
    <button
      type="button"
      className="w-full text-left px-1 py-0.5 text-red-500"
      onClick={() => logout({ redirectTo: "/" })}
    >
      Sign out
    </button>
  );
};
