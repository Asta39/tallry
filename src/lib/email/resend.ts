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
  
  try {
    const { data, error } = await resend.emails.send({
      from: "Tallry <billing@tallry.com>", // You will need to verify this domain on Resend later
      to,
      subject,
      react,
    });

    if (error) {
      console.error("Resend API Error:", error);
    }
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
