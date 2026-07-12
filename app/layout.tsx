import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "BusPulse — Live Bus Tracker",
    template: "%s · BusPulse",
  },
  description:
    "Real-time crowdsourced bus tracking for SNIST students. Know exactly where your bus is, without any hardware on the bus.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BusPulse",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://buspulse.app",
  ),
  openGraph: {
    title: "BusPulse — Live Bus Tracker",
    description: "Crowdsourced live bus tracking for engineering colleges.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import { AuthProvider } from "@/components/auth/auth-provider";
import { FcmNotificationManager } from "@/components/FcmNotificationManager";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content="#0a0a0b" />
      </head>
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          <ServiceWorkerRegistrar />
          <FcmNotificationManager />
          <PwaInstallPrompt />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
