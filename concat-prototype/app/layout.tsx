import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CONCAT — Think for yourself.",
  description: "A learning platform for building real understanding. Teach what you know, challenge your reasoning, and discover what you really understand.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
