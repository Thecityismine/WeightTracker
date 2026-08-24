import { PageHeader } from "@/components/ui/card";
import { PhaseNotice } from "@/components/ui/phase-notice";

/**
 * Reached from Settings > Nutrition database and from the My Foods tab of
 * the Add Food sheet. It has no bottom-nav slot — the center + button holds
 * that position in the design.
 */
export default function FoodsPage() {
  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Foods" subtitle="Your personal database" />
      <PhaseNotice
        phase={3}
        items={[
          "Search, filter by category and sort by most used",
          "Manual food creation from a nutrition label",
          "Verification badges and source dots",
          "Label photos stored in Firebase Storage",
        ]}
      />
    </main>
  );
}
