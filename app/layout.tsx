import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Menstrual Tracker — Know your cycle",
  description:
    "Track your menstrual cycle from your last period dates and your own cycle length. Predict your next period, ovulation and fertile window.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-rose-50/60 antialiased">{children}</body>
    </html>
  );
}
