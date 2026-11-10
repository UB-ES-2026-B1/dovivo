import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { SessionGuard } from "~/app/_components/session-guard";
import { SiteHeader } from "~/app/_components/site-header";
import { auth } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: { default: "dovivo", template: "%s · dovivo" },
  description: "Find, rent, buy and publish homes.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <TRPCReactProvider>
          <SessionGuard signedIn={!!session} />
          <SiteHeader />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
