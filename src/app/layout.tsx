import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGate } from "@/components/auth/auth-gate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Weight Tracker",
  description: "Muscle gain food tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    // Translucent, so the web view reaches the top of the screen and the
    // background gradient paints behind the status bar rather than the OS
    // filling that strip with flat black. The app owes the inset back as
    // padding — see `pt-safe` on the authed shell and the login screen.
    statusBarStyle: "black-translucent",
    title: "Tracker",
  },
};

export const viewport: Viewport = {
  /*
   * The colour of the gradient where it meets the top of the screen, not the
   * flat background beneath it. Browsers that tint their own chrome from this
   * value (Safari's non-standalone bar, Android) then blend into the page
   * instead of drawing a dark band above it.
   */
  themeColor: "#05141e",
  width: "device-width",
  initialScale: 1,
  // No pinch-zoom on a data entry app — it only ever fires by accident.
  maximumScale: 1,
  // Extend under the status bar. Insets are paid back with `pt-safe`.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
