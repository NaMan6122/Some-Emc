import { LandingClient } from "./LandingClient";

// Landing is the public default. Authenticated users see a Dashboard CTA;
// the overview remains at /overview. No redirect here — middleware keeps
// /overview and other app routes protected.
export default function Home() {
  return <LandingClient />;
}
