import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "./provider/queryprovider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CPay — Church Partnership Payments",
  description: "Dedicated virtual accounts for church partnership members",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
