import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4, Noto_Sans_JP } from 'next/font/google';
import { QueryProvider } from '@/components/ui/QueryProvider';
import { SwRegistrar } from '@/components/ui/SwRegistrar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'English Phrasebook',
  description: '自分専用の英語フラッシュカード',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Phrasebook' },
};

export const viewport: Viewport = {
  themeColor: '#2783DE',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`h-full antialiased ${inter.variable} ${sourceSerif.variable} ${notoSansJP.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <SwRegistrar />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
