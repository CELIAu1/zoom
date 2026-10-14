import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Redo — Your ride. Your offer.",
  description:
    "A considered way to move. Request rides and deliveries, negotiate a fair fare, and follow every journey.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
