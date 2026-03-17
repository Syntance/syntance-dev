export function SyntanceLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-lg bg-accent" />
        <div className="absolute inset-[3px] rounded-[5px] bg-background" />
        <div className="absolute inset-[6px] rounded-[3px] bg-accent-light" />
      </div>
      <span className="text-xl font-semibold tracking-tight">Syntance</span>
    </div>
  );
}
