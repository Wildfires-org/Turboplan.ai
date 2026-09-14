"use client";

import React, { ReactNode } from "react";

import Link from "next/link";
import { toast as sonnerToast } from "sonner";

import { CheckCircleFillIcon, WarningIcon } from "./icons";

const iconsByType: Record<"success" | "error", ReactNode> = {
  success: <CheckCircleFillIcon />,
  error: <WarningIcon />,
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
        className="bg-zinc-100 p-3 rounded-lg w-full toast-mobile:w-fit flex flex-row gap-2 items-center"
      >
        <div
          data-type={type}
          className="data-[type=error]:text-red-600 data-[type=success]:text-green-600"
        >
          {iconsByType[type]}
        </div>
        <div className="text-zinc-950 text-sm">{description}</div>
        {action ? (
          <Link
            href={action.href}
            className="text-sm font-medium text-brand-800 hover:text-brand-900 underline whitespace-nowrap"
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
