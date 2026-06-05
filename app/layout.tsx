import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'PoXter',
  description: 'PoXter local social planning controller'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
