import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { JetBrains_Mono, Manrope } from "next/font/google";
import AppShell from "@/lib/components/app-shell/app-shell";
import "@/lib/styles/breakpoints.scss";
import "@/lib/styles/colors.scss";
import "@/lib/styles/core.scss";
import "@/lib/styles/display.scss";
import "@/lib/styles/flex.scss";
import "@/lib/styles/globals.scss";
import "@/lib/styles/height.scss";
import "@/lib/styles/interactions.scss";
import "@/lib/styles/max-height.scss";
import "@/lib/styles/max-width.scss";
import "@/lib/styles/min-height.scss";
import "@/lib/styles/min-width.scss";
import "@/lib/styles/overflow.scss";
import "@/lib/styles/placement.scss";
import "@/lib/styles/position.scss";
import "@/lib/styles/radius.scss";
import "@/lib/styles/spacing.scss";
import "@/lib/styles/text.scss";
import "@/lib/styles/variables.scss";
import "@/lib/styles/platform-ui.scss";
import "@/lib/styles/width.scss";
import "./shell.scss";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "zCRM",
  description: "Simple pipeline and follow-up tracking.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/zcrm-icon.svg", type: "image/svg+xml" },
      { url: "/icons/zcrm-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/zcrm-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6d45d9",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <Suspense fallback={<div id="main-content">{children}</div>}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
