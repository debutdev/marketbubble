import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { TwitchStreamPopout } from "@/components/TwitchStreamPopout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = localFont({
  variable: "--font-playfair-display",
  display: "swap",
  src: [
    {
      path: "./fonts/PlayfairDisplay-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/PlayfairDisplay-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/PlayfairDisplay-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/PlayfairDisplay-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
    {
      path: "./fonts/PlayfairDisplay-Black.ttf",
      weight: "900",
      style: "normal",
    },
    {
      path: "./fonts/PlayfairDisplay-BlackItalic.ttf",
      weight: "900",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Market Bubble",
    template: "%s | Market Bubble",
  },
  description:
    "Market Bubble is a live market intelligence dashboard for crypto, stocks, prediction markets, smart money flows, news, heatmaps, and stream-driven trading context.",
  openGraph: {
    description:
      "Track live crypto, stocks, prediction markets, smart money flows, news, heatmaps, and stream-driven trading context in one market dashboard.",
    images: [
      {
        alt: "Market Bubble live market dashboard",
        url: "/market-bubble-social.avif",
      },
    ],
    siteName: "Market Bubble",
    title: "Market Bubble",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Live crypto, stocks, prediction markets, smart money flows, news, heatmaps, and stream-driven trading context.",
    images: ["/market-bubble-social.avif"],
    title: "Market Bubble",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <TwitchStreamPopout />
      </body>
    </html>
  );
}
