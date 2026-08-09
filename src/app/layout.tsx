import type { Metadata } from "next";
import "./globals.css";
import "./team-comparison-landscape.css";
import "./team-comparison-landscape-hybrid.css";

export const metadata: Metadata = {
  title: "WTDGC 2026 Scout",
  description: "Teams, players and PDGA comparison tools for WTDGC 2026.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
