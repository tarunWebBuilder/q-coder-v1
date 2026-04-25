import type { Metadata } from "next";
import PlausibleProvider from "next-plausible";
import "./globals.css";
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';

let title = "Parexa AI – AI Code Generator";
let description = "Generate your next app with Parexa";
let url = "https://www.parexa.xyz/";
let ogimage = "https://llamacoder.io/og-image.png";
let sitename = "llamacoder.io";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    images: [ogimage],
    title,
    description,
    url: url,
    siteName: sitename,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: [ogimage],
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
<body>
        {/* <PlausibleProvider domain="https://www.parexa.xyz/" /> */}

   <AuthKitProvider>
  {children}
   </AuthKitProvider>
    
  
</body>
    </html>
  );
}
