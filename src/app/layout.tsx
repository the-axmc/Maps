import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible,
  Playfair_Display,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.borderlesscitizen.org";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

const headingFont = Atkinson_Hyperlegible({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Borderless Citizen | Build & Share Custom Maps",
  description:
    "Design and share custom world and country maps with colours, markers, and labels. Export or share your map in seconds.",
  openGraph: {
    title: "Borderless Citizen | Build & Share Custom Maps",
    description:
      "Design and share custom world and country maps with colours, markers, and labels. Interactive maps to export or share in seconds.",
    siteName: "Borderless Citizen",
    url: siteUrl,
    images: [
      {
        url: "/WorldMap.png",
        width: 1200,
        height: 630,
        alt: "Interactive map builder preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Borderless Citizen | Build & Share Custom Maps",
    description:
      "Design and share custom world and country maps with colours, markers, and labels. Export or share your map in seconds.",
    images: ["/WorldMap.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${headingFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
