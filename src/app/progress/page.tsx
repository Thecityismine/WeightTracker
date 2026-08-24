import { PageHeader } from "@/components/ui/card";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function ProgressPage() {
  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Progress" subtitle="144 to 149" />
      <PhaseNotice
        phase={6}
        items={[
          "Weight progress line from starting weight to goal",
          "Daily weight with the seven-day average overlaid",
          "Daily calories and protein against their targets",
          "Weekly summary in plain language",
        ]}
      />
    </main>
  );
}
