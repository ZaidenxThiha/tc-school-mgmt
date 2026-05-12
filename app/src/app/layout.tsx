import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thazin & Cherry',
  description: 'English Training Centre — Internal Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
