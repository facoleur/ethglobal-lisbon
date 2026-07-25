"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function LoginError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorPage reset={reset} />;
}
