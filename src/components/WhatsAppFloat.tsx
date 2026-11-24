import { WHATSAPP_DISPLAY, whatsapp } from "@/lib/contact";

/** A round WhatsApp button fixed at the bottom right of the public pages. */
export function WhatsAppFloat() {
  return (
    <aside aria-label="WhatsApp">
      <a
        href={whatsapp("Hello Simpliskool, I'd like to find out more.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chat with us on WhatsApp, ${WHATSAPP_DISPLAY} (opens WhatsApp)`}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#1F8A4C] text-white shadow-[0_16px_32px_-10px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 hover:bg-[#18713E] print:hidden"
      >
        <svg
          aria-hidden="true"
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
        </svg>
      </a>
    </aside>
  );
}
