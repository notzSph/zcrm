import type { Metadata } from "next";
import { Suspense } from "react";
import { JetBrains_Mono, Manrope } from "next/font/google";
import AppShell from "@/components/app-shell";
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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${mono.variable}`}>
      <body><Suspense fallback={children}><AppShell>{children}</AppShell></Suspense></body>
    </html>
  );
}
