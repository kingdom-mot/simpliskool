/** How schools and parents reach Dream Savvy. One address and one WhatsApp number for every enquiry. */
export const ENQUIRIES_EMAIL = "enquiries@simpliskool.com";
export const WHATSAPP_NUMBER = "2347048776371";
export const WHATSAPP_DISPLAY = "+234 704 877 6371";

/** A WhatsApp chat link, optionally with a message already typed. */
export function whatsapp(message?: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export const PRICING_CHAT = whatsapp("Hello Simpliskool, I'd like to know about pricing for my school.");
