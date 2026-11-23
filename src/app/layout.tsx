import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@coinbase/cds-icons/fonts/web/icon-font.css';
import '@coinbase/cds-web/defaultFontStyles';
import '@coinbase/cds-web/globalStyles';
import './reduced-motion.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'SafeSend: catch lookalike recipients before you send USDC',
  description:
    'A Base Sepolia testnet prototype that tracks where every address in your history came from and makes a clear decision at send time.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
