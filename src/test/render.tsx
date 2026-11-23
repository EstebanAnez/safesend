import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from '@coinbase/cds-web';
import { PortalProvider } from '@coinbase/cds-web/overlays';
import { MediaQueryProvider } from '@coinbase/cds-web/system';
import { defaultTheme } from '@coinbase/cds-web/themes/defaultTheme';

export function renderWithTheme(ui: ReactElement) {
  return render(
    <MediaQueryProvider>
      <ThemeProvider theme={defaultTheme} activeColorScheme="light">
        <PortalProvider>{ui}</PortalProvider>
      </ThemeProvider>
    </MediaQueryProvider>,
  );
}
