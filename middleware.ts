import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const subdomain = host.split(".")[0];

  if (
    subdomain === "syntance" ||
    subdomain === "www" ||
    subdomain === "localhost" ||
    host.startsWith("localhost")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.rewrite(req.nextUrl.clone());
  response.headers.set("x-project-slug", subdomain);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
