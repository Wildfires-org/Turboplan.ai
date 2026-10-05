"use client";

import React, { ReactNode } from "react";

import { AlertTriangle, Check } from "lucide-react";
import Link from "next/link";
import { toast as sonnerToast } from "sonner";

import {
  TOAST_ICON_CLASS,
  TOAST_ICON_TONE_CLASS,
  TOAST_SURFACE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

const iconsByType: Record<"success" | "error", ReactNode> = {
  success: <Check aria-hidden strokeWidth={2.5} />,
  error: <AlertTriangle aria-hidden />,
};

export function toast(props: Omit<ToastProps, "id">) {
  return sonnerToast.custom((id) => (
    <Toast
      id={id}
      type={props.type}
      description={props.description}
      action={props.action}
    />
  ));
}

function Toast(props: ToastProps) {
  const { id, type, description, action } = props;

  return (
    <div className="flex w-full toast-mobile:w-[356px] justify-center">
      <div
        data-testid="toast"
        key={id}
        className={cn(TOAST_SURFACE_CLASS, "w-full")}
      >
        <div
          data-type={type}
          className={cn(TOAST_ICON_CLASS, TOAST_ICON_TONE_CLASS[type])}
        >
          {iconsByType[type]}
        </div>
        <div>{description}</div>
        {action ? (
          <Link
            href={action.href}
            className="whitespace-nowrap font-medium text-brand-800 underline underline-offset-2 hover:text-brand-900"
            onClick={() => sonnerToast.dismiss(id)}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

interface ToastAction {
  label: string;
  href: string;
}

interface ToastProps {
  id: string | number;
  type: "success" | "error";
  description: string;
  /** Optional inline CTA link rendered to the right of the message. */
  action?: ToastAction;
}
