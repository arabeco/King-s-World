import { PremiumPaywallCard } from "@/components/premium-paywall-card";
import { MarketingShell } from "@/components/marketing-shell";

export default function PremiumPage() {
  return (
    <MarketingShell
      title="Premium da Coroa"
      subtitle="Assinatura Android nativa, validada pela Play Store e sincronizada no backend do KingsWorld."
    >
      <PremiumPaywallCard />
    </MarketingShell>
  );
}
