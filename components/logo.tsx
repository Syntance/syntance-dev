import Image from "next/image";

export function SyntanceLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="Syntance"
        width={32}
        height={32}
        className="h-8 w-8 brightness-0 invert"
      />
      <span className="text-xl font-semibold tracking-tight">Syntance</span>
    </div>
  );
}
