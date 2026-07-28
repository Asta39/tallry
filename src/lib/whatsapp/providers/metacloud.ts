import { WhatsAppProvider, SendResult, MessageOptions } from "../types";

/**
 * Meta Official WhatsApp Cloud API Driver.
 * Direct Graph API client for individual numbers with official Meta template approval.
 */
export class MetaCloudProvider implements WhatsAppProvider {
  private apiKey: string;
  private phoneNumberId: string;

  constructor(apiKey?: string | null, phoneNumberId?: string | null) {
    this.apiKey = apiKey || "";
    this.phoneNumberId = phoneNumberId || "";
  }

  async sendMessage(to: string, text: string, _options?: MessageOptions): Promise<SendResult> {
    if (!this.apiKey || !this.phoneNumberId) {
      return { success: false, error: "Meta Cloud API Key or Phone Number ID missing" };
    }

    // Meta Cloud API only supports individual phone numbers
    if (to.includes("@g.us")) {
      return { success: false, error: "Meta Cloud API does not support company group chats. Use Baileys provider for group messaging." };
    }

    const formattedPhone = this.formatPhone(to);

    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: { body: text },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || "Meta API Error" };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id || `meta_${Date.now()}`,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Meta Cloud request failed" };
    }
  }

  async sendDocument(to: string, docUrl: string, fileName: string, caption?: string): Promise<SendResult> {
    if (!this.apiKey || !this.phoneNumberId) {
      return { success: false, error: "Meta Cloud API Key or Phone Number ID missing" };
    }

    const formattedPhone = this.formatPhone(to);

    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "document",
          document: {
            link: docUrl,
            filename: fileName,
            caption: caption || "",
          },
        }),
      });

      const data = await res.json();
      return {
        success: res.ok,
        messageId: data.messages?.[0]?.id,
        error: res.ok ? undefined : data.error?.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private formatPhone(to: string): string {
    const digits = to.replace(/\D/g, "");
    if (digits.startsWith("0")) return `254${digits.slice(1)}`;
    if (!digits.startsWith("254") && digits.length === 9) return `254${digits}`;
    return digits;
  }
}
