import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { exportJobs, deliveryLog, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { Resend } from "resend";
import { buildStrategyReport } from "@/lib/strategy-hub/export/build-report";
import { reportToMarkdown } from "@/lib/strategy-hub/export/to-markdown";
import { reportToDocx } from "@/lib/strategy-hub/export/to-docx";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Syntance <noreply@syntance.dev>";

const bodySchema = z.object({
  email: z.string().email(),
  type: z.enum(["json", "md", "docx", "png_map", "svg_graph"]),
  // Dla png_map/svg_graph — plik wygenerowany po stronie klienta (html-to-image), przekazany jako base64.
  fileBase64: z.string().optional(),
  filename: z.string().optional(),
});

/**
 * POST — wysyła eksport strategii mailem (Resend), z załącznikiem base64.
 * Loguje wysyłkę do `delivery_log` powiązanego z wpisem `export_jobs`.
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
  const { email, type, fileBase64, filename } = parsed.data;

  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let attachmentContent: string;
  let attachmentFilename: string;

  try {
    if (fileBase64) {
      attachmentContent = fileBase64;
      attachmentFilename = filename ?? `eksport-${type}`;
    } else {
      const report = await buildStrategyReport(id);
      if (type === "json") {
        attachmentContent = Buffer.from(JSON.stringify(report, null, 2)).toString("base64");
        attachmentFilename = "strategia.json";
      } else if (type === "md") {
        attachmentContent = Buffer.from(reportToMarkdown(report)).toString("base64");
        attachmentFilename = "strategia.md";
      } else if (type === "docx") {
        const buf = await reportToDocx(report);
        attachmentContent = buf.toString("base64");
        attachmentFilename = "strategia.docx";
      } else {
        return NextResponse.json(
          { error: "Dla png_map/svg_graph wymagany fileBase64 z klienta" },
          { status: 400 }
        );
      }
    }

    const [job] = await db
      .insert(exportJobs)
      .values({ projectId: id, type, status: "done" })
      .returning();

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Eksport strategii — ${project.name}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
          <h2 style="font-size:18px;font-weight:600;color:#18181b;margin:0 0 12px;">Eksport strategii — ${project.name}</h2>
          <p style="font-size:14px;color:#52525b;line-height:1.6;">W załączniku znajdziesz aktualny eksport (${type.toUpperCase()}) strategii projektu wygenerowany ze Strategy Hub.</p>
        </div>
      `,
      attachments: [{ filename: attachmentFilename, content: attachmentContent }],
    });

    if (error) {
      console.error("export delivery email failed", error);
      return NextResponse.json({ error: "Wysyłka nie powiodła się" }, { status: 502 });
    }

    await db.insert(deliveryLog).values({
      projectId: id,
      exportJobId: job?.id,
      recipientEmail: email,
      channel: "email",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("export deliver failed", err);
    return NextResponse.json({ error: "Wysyłka nie powiodła się" }, { status: 500 });
  }
}
