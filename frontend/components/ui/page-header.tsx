type PageHeaderProps = { title: string; subtitle: string };

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{subtitle}</p>
    </div>
  );
}
