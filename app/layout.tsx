import type { Metadata } from "next";
import "./globals.css";
import { PennyThemeProvider } from "@/components/penny/theme";
export const metadata: Metadata = {
  title: "Penny · Your money, in focus",
  description: "Track expenses, plan budgets, and understand your spending.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><PennyThemeProvider>{children}</PennyThemeProvider></body>
    </html>
  );
}

