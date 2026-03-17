import Image from "next/image";

export function SyntanceLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logo.svg"
        alt="Syntance"
        width={160}
        height={53}
        className="h-10 w-auto"
      />
    </div>
  );
}
