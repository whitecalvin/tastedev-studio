import { LanguageProvider } from "@/i18n/react";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/theme";
import "@/styles/globals.css";
import "@/styles/workspace.css";
import "@/styles/files.css";
import '@xterm/xterm/css/xterm.css';
import '@/styles/process.css';

export const metadata: Metadata = { title: "TASTESTUDIO", description: "Your projects, ready for the next step." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LanguageProvider><ThemeProvider>{children}</ThemeProvider></LanguageProvider></body></html>;
}



import '@/styles/git.css';

import '@/styles/core.css';
