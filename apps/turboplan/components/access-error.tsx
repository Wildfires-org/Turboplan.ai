"use client";

import { ErrorPage } from "@/components/error-page";

interface AccessErrorProps {
  type?: "organization" | "office" | "project";
  message?: string;
}

const defaultMessages = {
  organization:
    "There is no such organization, or you don't have access to it.",
  office: "There is no such office, or you don't have access to it.",
  project: "There is no such project, or you don't have access to it.",
};

export const AccessError = ({ type, message }: AccessErrorProps) => {
  const description =
    message ||
    (type
      ? defaultMessages[type]
      : "This resource doesn't exist, or you don't have access to it.");

  return <ErrorPage title="Access Restricted" description={description} />;
};
