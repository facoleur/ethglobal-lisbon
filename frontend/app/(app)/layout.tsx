import { BottomNav } from "@/components/navigation/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-sm px-6 py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
