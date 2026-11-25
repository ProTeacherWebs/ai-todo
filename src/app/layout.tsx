import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "EisenAI — AI Tasks Manager",
  description: "Умный менеджер задач с Brain Dump и Матрицей Эйзенхауэра",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
        {children}
        <Toaster
          theme="light"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              color: "var(--text)",
              boxShadow: "var(--sh-card)",
              borderRadius: "var(--r-card)",
            },
          }}
        />
      </body>
    </html>
  );
}
