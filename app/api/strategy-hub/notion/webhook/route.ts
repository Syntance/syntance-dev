import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pullFromNotion } from "@/lib/strategy-hub/notion-sync";

export const runtime = "nodejs";

/**
 * Webhook endpoint dla Notion.
 *
 * Notion wysyła:
 * 1) initial verification: {verification_token}
 * 2) eventy: {entity: {id, type: 'page'}, type: 'page.content_updated', …}
 *
 * Konfigurujemy NOTION_WEBHOOK_SECRET — weryfikujemy podpis HMAC.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 1) initial verification — Notion przesyła token, trzeba go zalogować i wkleić w UI
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (parsed.verification_token) {
    // Musi działać nawet bez sekretu — to jednorazowy handshake do zarejestrowania
    // webhooka w Notion, zanim NOTION_WEBHOOK_SECRET w ogóle istnieje.
    console.log("[notion-webhook] verification_token:", parsed.verification_token);
    return NextResponse.json({ ok: true });
  }

  // 2) HMAC verification — fail-closed na produkcji (spójnie z cron i MCP).
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[notion-webhook] NOTION_WEBHOOK_SECRET brak na produkcji — odrzucam.");
      return NextResponse.json({ error: "webhook not configured" }, { status: 401 });
    }
  } else {
    const signature = req.headers.get("x-notion-signature") ?? "";
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    const valid =
      sigBuf.length === expBuf.length &&
      crypto.timingSafeEqual(sigBuf, expBuf);
    if (!valid) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  // 3) Event processing
  const entity = parsed.entity as { id?: string; type?: string } | undefined;
  if (!entity?.id || entity.type !== "page") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await pullFromNotion(entity.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    console.error("[notion-webhook]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/strategy-hub/notion/webhook",
    description:
      "Notion webhook receiver. Skonfiguruj URL w Notion → Settings → My connections → Webhooks.",
  });
}
