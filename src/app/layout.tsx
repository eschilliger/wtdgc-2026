import type { Metadata } from "next";
import { AppNavigation } from "@/components/navigation/AppNavigation";
import { getSessionClaims, roleFromClaims } from "@/server/auth/session";
import "./globals.css";
import "./team-comparison-landscape.css";
import "./team-comparison-landscape-hybrid.css";
import "./team-comparison-landscape-dedicated.css";
import "./team-comparison-landscape-polish.css";
import "./comparison-flow.css";

export const metadata: Metadata = {
  title: "WTDGC 2026",
  description: "Comparateur d’équipes et outils opérationnels WTDGC 2026 pour l’Équipe de France.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);

  return (
    <html lang="fr">
      <body>
        {role ? <AppNavigation role={role} email={claims?.email ?? null} /> : null}
        {children}
      </body>
    </html>
  );
}
