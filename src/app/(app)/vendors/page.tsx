import { LpoLogClient } from "./LpoLogClient";
import { PageHeader } from "@/components/ui/primitives";

// spec-010-v1: Vendors & LPO Log — the register screen.
export default function VendorsPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Analytics"
        title="Vendors & LPO Log"
        context="Local purchase orders incl. 5% VAT · server-computed totals"
      />
      <LpoLogClient />
    </div>
  );
}
