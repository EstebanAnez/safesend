import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from '@/domain/types';
import { compareAddresses } from '@/risk/compare';
import type { HistoryClassification } from '@/risk/history';
import { a, contact, dustFrom, entry, lookalikeOf, SISTER } from '@/test/builders';
import { buildNameBook, displayAddress } from '@/risk/names';
import { renderWithTheme } from '@/test/render';
import { HistoryList } from './HistoryList';

const MATEO = a('5b0e2a9d7c4f61e83b2a0d9c5e7f14a36b8c2d07');
const NONE = new Map<string, HistoryClassification>();

function page(entries: readonly HistoryEntry[]) {
  return {
    status: 'success' as const,
    data: { entries, coverage: { kind: 'fixture' as const, scenarioId: 'test' } },
  };
}

describe('HistoryList', () => {
  it('loading: says so in text, hides the skeleton from assistive tech', () => {
    renderWithTheme(
      <HistoryList
        history={{ status: 'loading' }}
        classifications={NONE}
        onUseAddress={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading activity');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('error: explains the consequence for checks and offers a retry', async () => {
    const onRetry = vi.fn();
    renderWithTheme(
      <HistoryList
        history={{ status: 'error', error: new Error('The activity service did not respond.') }}
        classifications={NONE}
        onUseAddress={vi.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Could not load activity')).toBeInTheDocument();
    expect(
      screen.getByText(/blocks any address that looks like one of your contacts/),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('empty: a clear message, no list', () => {
    renderWithTheme(
      <HistoryList
        history={page([])}
        classifications={NONE}
        onUseAddress={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('No USDC activity yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('rows are collapsed disclosures: "Use as recipient" appears only for the opened row', async () => {
    const onUseAddress = vi.fn();
    renderWithTheme(
      <HistoryList
        history={page([
          entry({ counterparty: MATEO, direction: 'in' }),
          entry({ counterparty: SISTER, direction: 'out' }),
        ])}
        classifications={NONE}
        onUseAddress={onUseAddress}
        onRetry={vi.fn()}
      />,
    );
    const list = screen.getByRole('list', { name: /USDC activity, newest first, 2 transfers/ });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Use address/ })).not.toBeInTheDocument();

    const row = screen.getByRole('button', { name: /^Received from 0x5b0E…/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('button', { name: /^Use address/ })).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: `Use address ${MATEO} as recipient` }),
    );
    expect(onUseAddress).toHaveBeenCalledWith(MATEO);
  });

  it('a suspected lookalike stays hidden behind an explanation with a specific button name', async () => {
    const look = lookalikeOf(SISTER, 5, 5);
    const planted = dustFrom(look);
    const classifications = new Map<string, HistoryClassification>([
      [
        planted.id,
        {
          kind: 'suspected-poisoning',
          technique: 'dust',
          anchor: { kind: 'contact', address: SISTER, contact: contact('Lucía', SISTER) },
          comparison: compareAddresses(look, SISTER),
        },
      ],
    ]);
    renderWithTheme(
      <HistoryList
        history={page([planted])}
        classifications={classifications}
        onUseAddress={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Suspected lookalike')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Use address/ })).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Show details of the suspected lookalike of Lucía' }),
    );
    expect(screen.getByRole('button', { name: `Use address ${look} as recipient` })).toBeVisible();
  });

  it('names a known person and never shows a lookalike with the same label (D24)', async () => {
    const look = lookalikeOf(SISTER, 4, 4);
    const real = entry({ counterparty: SISTER, direction: 'out' });
    const planted = dustFrom(look);
    const classifications = new Map<string, HistoryClassification>([
      [
        planted.id,
        {
          kind: 'suspected-poisoning',
          technique: 'dust',
          anchor: { kind: 'contact', address: SISTER, contact: contact('Lucía (sister)', SISTER) },
          comparison: compareAddresses(look, SISTER),
        },
      ],
    ]);
    renderWithTheme(
      <HistoryList
        history={page([real, planted])}
        classifications={classifications}
        names={buildNameBook([contact('Lucía (sister)', SISTER)])}
        onUseAddress={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^Sent to Lucía \(sister\)/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Show details of the suspected/ }));
    // The planted entry shows hex with its middle, never the name and never the short form.
    const suspicious = screen
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Suspected lookalike'));
    if (!suspicious) throw new Error('suspected row missing');
    // As the counterparty and as "Signed by" (a dust sender signs its own transfer).
    expect(within(suspicious).getAllByText(displayAddress(look))[0]).toBeVisible();
    expect(suspicious.textContent).not.toContain('Received from Lucía');
    expect(displayAddress(look)).not.toBe(displayAddress(SISTER));
  });
});
