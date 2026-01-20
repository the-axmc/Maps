import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible,
  Playfair_Display,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";

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
  title: "Custom Map Builder",
  description:
    "Create a custom world map with clickable countries, markers, and PNG export.",
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
