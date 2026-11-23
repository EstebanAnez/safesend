import { DemoShell } from '@/components/DemoShell/DemoShell';
import { ScenarioPicker } from '@/components/DemoShell/ScenarioPicker';

export const metadata = { title: 'SafeSend demo scenarios' };

export default function DemoIndexPage() {
  return (
    <DemoShell maxWidth={720}>
      <ScenarioPicker />
    </DemoShell>
  );
}
