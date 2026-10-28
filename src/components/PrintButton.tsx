"use client";

export function PrintButton({ children = "Print or save as PDF", className = "s-btn" }: { children?: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}
