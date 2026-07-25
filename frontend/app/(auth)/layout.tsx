"use client";

import { ScreenLayout } from "@/components/navigation/screen-layout";
import { usePathname } from "next/navigation";

const ROOT_AUTH_PAGES = ["/login"];

"use client";

import { usePathname } from "next/navigation";
import { ScreenLayout } from "@/components/navigation/screen-layout";

const ROOT_AUTH_PAGES = ["/login"];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const back = !ROOT_AUTH_PAGES.includes(pathname);

  return <ScreenLayout back={back}>{children}</ScreenLayout>;
}
