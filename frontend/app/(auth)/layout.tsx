export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
