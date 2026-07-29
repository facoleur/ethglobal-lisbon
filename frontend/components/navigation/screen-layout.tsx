"use client";

import { useRouter } from "next/navigation";

type ScreenLayoutProps = {
  children: React.ReactNode;
  back?: boolean;
  stretch?: boolean;
};

function ChevronLeft() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ScreenLayout({
  children,
  back = false,
  stretch = false,
}: ScreenLayoutProps) {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col">
      {back && (
        <div className="shrink-0 flex items-center px-2 pt-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-xl squircle text-foreground"
          >
            <ChevronLeft />
          </button>
        </div>
      )}
      {stretch ? (
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      )}
    </div>
  );
}
