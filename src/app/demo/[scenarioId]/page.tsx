import { notFound } from 'next/navigation';
import { DemoJourney } from '@/components/DemoJourney/DemoJourney';
import { DemoShell } from '@/components/DemoShell/DemoShell';
import { SCENARIO_LIST, SCENARIOS } from '@/fixtures/scenarios';

export const dynamicParams = false;

export function generateStaticParams() {
  return SCENARIO_LIST.map((s) => ({ scenarioId: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  return { title: `${SCENARIOS[scenarioId]?.title ?? 'Scenario'} · SafeSend demo` };
}

export default async function ScenarioPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  if (!SCENARIOS[scenarioId]) notFound();
  return (
    <DemoShell>
      <DemoJourney key={scenarioId} scenarioId={scenarioId} />
    </DemoShell>
  );
}
