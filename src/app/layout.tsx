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
  title: "Custom Map Builder",
  description:
    "Create a custom world map with coloured countries, markers, and export or share it.",
  openGraph: {
    title: "Custom Map Builder",
    description:
      "Create a custom world map with coloured countries, markers, and export or share it.",
    images: [
      {
        url: "/WorldMap.png",
        width: 1200,
        height: 630,
        alt: "Custom world map preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Map Builder",
    description:
      "Create a custom world map with coloured countries, markers, and export or share it.",
    images: ["/WorldMap.png"],
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
