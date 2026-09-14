"use client";

import { ErrorPage } from "@/components/error-page";

const NotFound = () => {
  return (
    <ErrorPage
      title="Looks like you're off the trail!"
      description="The page you're looking for doesn't exist. Our beaver might have chewed through the wrong link or built a dam over it! Let's get you back to your projects."
    />
  );
};

export default NotFound;
