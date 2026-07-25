"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorPage reset={reset} />;
}
