import Image from "next/image";

export function SyntanceLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logo-full.png"
        alt="Syntance"
        width={160}
        height={40}
        className="h-10 w-auto"
      />
    </div>
  );
}

export function SyntanceLogoIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Syntance"
      width={32}
      height={32}
      className={`brightness-0 invert ${className}`}
    />
  );
}
