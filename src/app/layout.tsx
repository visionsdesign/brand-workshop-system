import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './slides.css';
import './portal.css';

// Helvetica Neue is the template face. Inter Light is the fallback on machines without it (mostly Windows).
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '700'], variable: '--font-inter' });

export const metadata: Metadata = {
  // Share images and links need the full address
  metadataBase: new URL(process.env.URL || 'https://brand.visionsdesign.co.uk'),
  title: 'Brand Workshop · Visions Design',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
