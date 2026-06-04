import type { ReactNode } from 'react';

export const metadata = {
  title: 'Social Controller',
  description: 'Local social planning controller'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
