import type { Metadata } from "next";
import { Figtree, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/context/LocaleContext";
import { CallProvider } from "@/context/CallContext";
import { UIProvider } from "@/context/UIContext";
import { LiveSessionProvider } from "@/context/LiveSessionContext";
import { AccCallProvider } from "@/context/AccCallContext";
import { BlockProvider } from "@/context/BlockContext";
import { GamificationProvider } from "@/context/GamificationContext";
import Navbar from "@/components/Navbar";
import LiveSessionOverlay from "@/components/LiveSessionOverlay";
import AccCallOverlay from "@/components/AccCallOverlay";
import GlobalReminders from "@/components/GlobalReminders";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import XPToast from "@/components/XPToast";
import SessionRecapWrapper from "@/components/SessionRecapWrapper";
import BadgeCelebration from "@/components/BadgeCelebration";
import { SpeedInsights } from '@vercel/speed-insights/next';

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BrilliPlan",
    template: "%s — BrilliPlan",
  },
  description: "Atteignez vos objectifs ensemble. BrilliPlan est la plateforme collaborative pour fixer, suivre et accomplir vos objectifs avec un partenaire de responsabilité.",
  keywords: ["objectifs", "accountability", "productivité", "pomodoro", "coworking", "collaboration"],
  authors: [{ name: "BrilliPlan" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "BrilliPlan",
    title: "BrilliPlan — Collaborative Goal Setting",
    description: "Atteignez vos objectifs ensemble avec BrilliPlan.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BrilliPlan — Collaborative Goal Setting",
    description: "Atteignez vos objectifs ensemble avec BrilliPlan.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${figtree.variable} ${bricolage.variable} ${figtree.className} theme-dark`} suppressHydrationWarning>
        <UIProvider>
          <LocaleProvider>
            <AuthProvider>
              <BlockProvider>
              <GamificationProvider>
              <CallProvider>
                <LiveSessionProvider>
                <AccCallProvider>
                  {/* Subtle warm ambient glow */}
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none', background: '#0b0b0d', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '50vh', background: 'radial-gradient(ellipse, rgba(200, 169, 96, 0.035) 0%, transparent 65%)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50vw', height: '50vh', background: 'radial-gradient(ellipse, rgba(94, 234, 212, 0.02) 0%, transparent 60%)', borderRadius: '50%' }} />
                  </div>
                  <Navbar />
                  <LiveSessionOverlay />
                  <AccCallOverlay />
                  <GlobalReminders />
                  <OnboardingTutorial />
                  <XPToast />
                  <SessionRecapWrapper />
                  <BadgeCelebration />
                  <main className="min-h-screen" style={{ paddingTop: '56px', position: 'relative' }}>
                    {children}
                  </main>
                  <footer style={{
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap' as const,
                    gap: '8px',
                  }}>
                    <style>{`.bp-footer-link { font-size:.68rem; color:rgba(255,255,255,0.22); font-weight:500; text-decoration:none; transition:color .15s; } .bp-footer-link:hover { color:rgba(255,255,255,0.55); }`}</style>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)', fontWeight: 500 }}>
                      © {new Date().getFullYear()} BrilliPlan
                    </span>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <a href="/privacy" className="bp-footer-link">Confidentialité</a>
                      <a href="/terms" className="bp-footer-link">CGU</a>
                    </div>
                  </footer>
                  <SpeedInsights />
                </AccCallProvider>
                </LiveSessionProvider>
              </CallProvider>
              </GamificationProvider>
              </BlockProvider>
            </AuthProvider>
          </LocaleProvider>
        </UIProvider>
      </body>
    </html>
  );
}
