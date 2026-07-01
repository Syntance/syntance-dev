import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { exportJobs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { buildStrategyReport } from "@/lib/strategy-hub/export/build-report";
import { reportToMarkdown } from "@/lib/strategy-hub/export/to-markdown";
import { reportToDocx } from "@/lib/strategy-hub/export/to-docx";
import { reportToPdf } from "@/lib/strategy-hub/export/to-pdf";

const bodySchema = z.object({
  type: z.enum(["json", "md", "docx", "pdf_full", "png_map", "svg_graph"]),
});

const MIME: Record<string, string> = {
  json: "application/json",
  md: "text/markdown",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf_full: "application/pdf",
  png_map: "image/png",
  svg_graph: "image/svg+xml",
};

// GET — historia eksportów projektu
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const items = await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.projectId, id))
    .orderBy(desc(exportJobs.createdAt))
    .limit(50);

  return NextResponse.json({ items });
}

/**
 * POST — generuje eksport typu json/md/docx na żądanie i zwraca plik bezpośrednio
 * (Content-Disposition: attachment). png_map/svg_graph tylko rejestruje wpis
 * historii — plik jest generowany po stronie klienta (React Flow / html-to-image).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { type } = parsed.data;

  if (type === "png_map" || type === "svg_graph") {
    const [job] = await db
      .insert(exportJobs)
      .values({ projectId: id, type, status: "done" })
      .returning();
    return NextResponse.json({ job });
  }

  try {
    const report = await buildStrategyReport(id);
    let bytes: Buffer | string;
    let filename: string;

    if (type === "json") {
      bytes = JSON.stringify(report, null, 2);
      filename = `strategia-${slug(report.projectName)}.json`;
    } else if (type === "md") {
      bytes = reportToMarkdown(report);
      filename = `strategia-${slug(report.projectName)}.md`;
    } else if (type === "pdf_full") {
      bytes = await reportToPdf(report);
      filename = `strategia-${slug(report.projectName)}.pdf`;
    } else {
      bytes = await reportToDocx(report);
      filename = `strategia-${slug(report.projectName)}.docx`;
    }

    await db.insert(exportJobs).values({ projectId: id, type, status: "done" });

    const responseBody = typeof bytes === "string" ? bytes : new Uint8Array(bytes);
    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": MIME[type],
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export generation failed", err);
    await db.insert(exportJobs).values({ projectId: id, type, status: "failed" });
    return NextResponse.json({ error: "Generowanie eksportu nie powiodło się" }, { status: 500 });
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
