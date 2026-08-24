import { PageHeader } from "@/components/ui/card";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function CalendarPage() {
  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Calendar" subtitle="Daily totals and completed days" />
      <PhaseNotice
        phase={5}
        items={[
          "Month grid with calories, protein and a status dot per day",
          "Weekly summary row",
          "Copy an entire day to today",
        ]}
      />
    </main>
  );
}
