import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "Syntance <noreply@syntance.dev>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://syntance.dev";

export async function sendPasswordSetupEmail(
  email: string,
  token: string
) {
  const url = `${BASE_URL}/set-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Ustaw hasło do portalu Syntance",
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #fafafa; margin: 0;">Syntance</h1>
        </div>
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #fafafa; margin: 0 0 12px;">Ustaw swoje hasło</h2>
          <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 24px; line-height: 1.6;">
            Kliknij poniższy przycisk, aby ustawić hasło do portalu klienta Syntance.
            Link jest ważny przez 24 godziny.
          </p>
          <a href="${url}" style="display: inline-block; background: #6d28d9; color: #ffffff; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            Ustaw hasło
          </a>
        </div>
        <p style="font-size: 12px; color: #52525b; text-align: center; margin-top: 24px;">
          Jeśli nie prosiłeś o ten email, zignoruj go.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send setup email:", error);
    throw new Error("Nie udało się wysłać emaila");
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
) {
  const url = `${BASE_URL}/reset-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset hasła — Syntance",
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #fafafa; margin: 0;">Syntance</h1>
        </div>
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #fafafa; margin: 0 0 12px;">Resetuj hasło</h2>
          <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 24px; line-height: 1.6;">
            Otrzymaliśmy prośbę o reset hasła do Twojego konta.
            Kliknij poniższy przycisk, aby ustawić nowe hasło.
            Link jest ważny przez 1 godzinę.
          </p>
          <a href="${url}" style="display: inline-block; background: #6d28d9; color: #ffffff; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            Resetuj hasło
          </a>
        </div>
        <p style="font-size: 12px; color: #52525b; text-align: center; margin-top: 24px;">
          Jeśli nie prosiłeś o reset hasła, zignoruj ten email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send reset email:", error);
    throw new Error("Nie udało się wysłać emaila");
  }
}
