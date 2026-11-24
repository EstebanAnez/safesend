'use client';

import { useEffect, useId, useRef } from 'react';
import { Box, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';

/**
 * The dust-poisoning journey as a short muted clip (a fraction of the GIF's size).
 * - Native controls, so it can always be paused (WCAG 2.2.2).
 * - Autoplays only when the user has not asked for reduced motion (WCAG 2.3.3).
 */
export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const captionId = useId();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void ref.current?.play().catch(() => undefined);
  }, []);

  return (
    <VStack as="figure" gap={1} aria-labelledby={captionId}>
      <Box bordered borderRadius={400} overflow="hidden">
        <video
          ref={ref}
          muted
          loop
          playsInline
          controls
          preload="metadata"
          poster="/demo-poster.webp"
          width={800}
          height={524}
          aria-describedby={captionId}
          // Only layout: scale to the column. No CDS component wraps <video>.
          style={{ display: 'block', width: '100%', height: 'auto' }}
        >
          {/* MP4 first: smaller than the WebM here (240 vs 290 KB), and plays everywhere. */}
          <source src="/demo.mp4" type="video/mp4" />
          <source src="/demo.webm" type="video/webm" />
        </video>
      </Box>
      <Text as="figcaption" font="label2" color="fgMuted" id={captionId}>
        Demo, no sound: a planted lookalike of Lucía is hidden in the history. Sending to it is
        blocked with a character comparison, and one click sends to the real Lucía instead.
      </Text>
    </VStack>
  );
}
