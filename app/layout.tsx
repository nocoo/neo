import type { Metadata, Viewport } from "next";
import { DM_Sans, Inter } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL || "http://localhost:7026"),
  title: "neo - 2FA Manager",
  description: "A modern two-factor authentication manager",
  appleWebApp: {
    capable: true,
    title: "Neo",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "neo - 2FA Manager",
    description: "A modern two-factor authentication manager",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7c3aed",
};

const themeScript = `(function() {
  try {
    var storedTheme = localStorage.getItem('theme');
    var dark = storedTheme === 'dark' || (storedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.classList.toggle('light', !dark);
    el.dataset.mode = dark ? 'dark' : 'light';

    // Semantic values derived by @nocoo/basalt applyAccent for the default
    // purple accent; other accents are re-derived by AccentProvider on mount.
    var storedAccent = localStorage.getItem('basalt-accent');
    var accents = {
      purple: { light: '280 53% 50%', dark: '280 53% 77%' },
      primary: { light: '204 88% 36%', dark: '204 90% 70%' }
    };
    var accent = accents[storedAccent] || accents.purple;
    var primary = dark ? accent.dark : accent.light;
    el.style.setProperty('--basalt-primary', primary);
    el.style.setProperty('--basalt-primary-foreground', dark ? '0 0% 10%' : '0 0% 100%');
    el.style.setProperty('--basalt-ring', primary);
    el.dataset.accent = storedAccent || 'purple';
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme and accent bootstrap script to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${dmSans.variable} antialiased`}>
        <AppProviders>
          {children}
          <Toaster
            offset={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
            mobileOffset={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
          />
        </AppProviders>
      </body>
    </html>
  );
}
