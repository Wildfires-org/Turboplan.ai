"use client";
import { ReactNode } from "react";

import Link, { LinkProps } from "next/link";

import { useAnalytics } from "@/hooks/useAnalytics";

type Props = LinkProps & {
  className?: string;
  eventName: string;
  children: ReactNode;
};

export const AnalyticsLink = ({ eventName, children, ...props }: Props) => {
  const { captureEvent } = useAnalytics();

  return (
    <Link
      {...props}
      onClick={(e) => {
        captureEvent(eventName);
        props.onClick && props?.onClick(e);
      }}
    >
      {children}
    </Link>
  );
};
