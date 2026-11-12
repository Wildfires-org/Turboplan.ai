"use client";

import { ErrorPage } from "@/components/error-page";

const NotFound = () => {
  return (
    <ErrorPage
      title="Looks like you're off the trail!"
      description="The page you're looking for doesn't exist. The link may be broken, or the page may have moved. Let's get you back to your projects."
    />
  );
};

export default NotFound;
