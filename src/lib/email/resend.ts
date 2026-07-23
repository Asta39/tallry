import { Resend } from "resend";
import React from "react";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key_to_avoid_crash");

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("No RESEND_API_KEY found, mocking email dispatch to:", to);
    return;
  }
  
  // resend.dev's shared testing domain only ever delivers to the account owner's
  // own verified address — every send to a real customer silently fails on that
  // sender. Set RESEND_FROM_EMAIL once a real domain is verified in Resend
  // (Domains → Add Domain → verify DNS records), e.g. "Zeno <billing@yourdomain.com>".
  const from = process.env.RESEND_FROM_EMAIL || "Zeno <onboarding@resend.dev>";
  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn(`RESEND_FROM_EMAIL not set — sending from ${from}, which only delivers to the Resend account's own address. Verify a real domain and set RESEND_FROM_EMAIL to reach real customers.`);
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      react,
    });

    if (error) {
      console.error(`Resend API Error sending "${subject}" to ${to}:`, error);
    }
  } catch (error) {
    console.error(`Failed to send email "${subject}" to ${to}:`, error);
  }
}
