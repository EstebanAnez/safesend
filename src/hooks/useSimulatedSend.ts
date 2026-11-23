'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';

export type SimulatedSendState =
  | { status: 'idle' }
  | { status: 'sending'; recipient: Address; amount: bigint }
  | { status: 'sent'; recipient: Address; amount: bigint };

/**
 * Demo mode only. Nothing is signed or broadcast. The UI must label the
 * result as simulated.
 */
export function useSimulatedSend(delayMs = 900) {
  const [state, setState] = useState<SimulatedSendState>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const send = useCallback(
    (recipient: Address, amount: bigint) => {
      setState({ status: 'sending', recipient, amount });
      timer.current = setTimeout(() => setState({ status: 'sent', recipient, amount }), delayMs);
    },
    [delayMs],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, send, reset };
}
