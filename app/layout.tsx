import type { Metadata } from "next";
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
  openGraph: {
    title: "neo - 2FA Manager",
    description: "A modern two-factor authentication manager",
    type: "website",
  },
};

const themeScript = `(function() {
  try {
    var storedTheme = localStorage.getItem('theme');
    var dark = storedTheme === 'dark' || (storedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.classList.toggle('light', !dark);
    el.dataset.mode = dark ? 'dark' : 'light';

    var storedAccent = localStorage.getItem('basalt-accent') || 'purple';
    var isDark = el.classList.contains('dark');
    var swatches = {
      purple: { light: '270 70% 60%', dark: '270 70% 65%', fg: '0 0% 100%' },
      primary: { light: '217 91% 60%', dark: '217 91% 65%', fg: '0 0% 100%' }
    };
    var swatch = swatches[storedAccent] || swatches.purple;
    var primary = isDark ? swatch.dark : swatch.light;
    el.style.setProperty('--basalt-primary', primary);
    el.style.setProperty('--basalt-primary-foreground', swatch.fg);
    el.style.setProperty('--basalt-ring', primary);
    el.dataset.accent = storedAccent;
    if (!localStorage.getItem('basalt-accent')) {
      localStorage.setItem('basalt-accent', 'purple');
    }
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
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
