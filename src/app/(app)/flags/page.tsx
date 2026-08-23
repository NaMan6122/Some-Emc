import { FlagsClient } from "./FlagsClient";

// spec-015 tab 6: read-only Data Flags queue (FR-9 triage lands in M3).
export default function FlagsPage() {
  return <FlagsClient />;
}
