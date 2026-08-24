import { Card, SectionLabel } from "./card";

/** Placeholder for screens whose build phase has not landed yet. */
export function PhaseNotice({
  phase,
  items,
}: {
  phase: number;
  items: string[];
}) {
  return (
    <div className="px-4">
      <Card className="px-5 py-5">
        <SectionLabel>Phase {phase}</SectionLabel>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-[14px] text-secondary">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
