import { VendorsTab } from "./VendorPareto";
import { PageHeader } from "@/components/ui/primitives";

// spec-015 tab 5: vendors Pareto + spec-010 LPO log beneath.
export default function VendorsPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Analytics"
        title="Vendors & LPO Log"
        context="Local purchase orders incl. 5% VAT · server-computed totals"
      />
      <VendorsTab />
    </div>
  );
}
