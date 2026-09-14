"use client";

import { Leaf, Moon } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

const themes = {
  light: {
    label: "light",
    icon: <Moon className="mr-2 size-4" />,
  },
  dark: {
    label: "dark",
    icon: <Moon className="mr-2 size-4" />,
  },
  environmental: {
    label: "environmental",
    icon: <Leaf className="mr-2 size-4" />,
  },
  admin: {
    label: "admin",
    icon: <span className="mr-2 size-4">Admin</span>,
  },
} as const;
export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 rounded-md">
          {theme === "environmental" ? (
            <Leaf className="size-5" />
          ) : (
            <Moon className="size-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(themes).map(([key, value]) => (
          <DropdownMenuItem key={key} onClick={() => setTheme(value.label)}>
            {value.icon}
            <span>{value.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
