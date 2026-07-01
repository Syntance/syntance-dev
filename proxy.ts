import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP nonce-based (script-src) + strict-dynamic — patrz .cursor/rules/55-security.mdc
 * i rozstrzygnięcie w 00-core.mdc: `style-src` MUSI dopuścić `'unsafe-inline'`
 * (Framer Motion/GSAP wstrzykują inline `style`), ale `script-src` NIGDY.
 *
 * Start w trybie Report-Only (zgodnie z regułą: enforcement dopiero po
 * tygodniu obserwacji bez fałszywych alarmów) — przełącz na
 * `Content-Security-Policy` gdy `NEXT_PUBLIC_CSP_ENFORCE=1`.
 *
 * Next.js 16: `proxy.ts` (dawniej `middleware.ts`) — runtime Node.js domyślnie.
 */
export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://api.notion.com https://api.anthropic.com`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const cspHeaderName =
    process.env.NEXT_PUBLIC_CSP_ENFORCE === "1"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";
  res.headers.set(cspHeaderName, csp);

  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return res;
}

export const config = {
  matcher: [
    /*
     * Pomijamy statyki Next.js i pliki assetów — nagłówki bezpieczeństwa
     * na nich nie mają znaczenia i tylko dokładałyby narzut per-request.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
