# Stripe App — self-hosted infra spec (Track A)

> **Poznámka (6. 7. 2026):** Pôvodný infra spec pre Track A žil mimo tohto repa
> (plánovací dokument). Tento súbor vzniká ako jeho záznam v repo — zachytáva
> **skutočný stav po dokončení Track A** (DoD actuals). Súvisiace:
> `checkout-v2-migration-inventory.md`, `feat-stripe-checkout-spec.md` (SUPERSEDED),
> pripravovaný Spec B.

## DoD — skutočný stav (6. 7. 2026)

maky-apps i-0118172f2ace853fd · EIP 35.156.24.97 · m9g.large (tracked: downsize
t4g.medium) · /opt/saleor-stripe-app pin saleor-app-payment-stripe@2.6.9 ·
PM2 maky-stripe-app :3011 (startup enabled) · nginx + Let's Encrypt (renewal dry-run OK) ·
DNS stripe-app = DNS-only (grey), NIE proxied — finálny stav, §6 specu prekonaná ·
DynamoDB maky-saleor-stripe-app-main (PK/SK, PITR) · SSM stripe_app_secret_key ·
IAM maky-apps-role/-profile/maky-apps-dynamodb-ssm · Saleor: app installed (QXBwOjY=),
config test-sk-eur → sk-eur, markAsPaidStrategy=TRANSACTION_FLOW, webhook Active ·
smoke OK (availablePaymentGateways + stripePublishableKey) ·
Tracked hardening: APL=file → presun na dynamodb APL · „Automatically complete
checkouts when fully paid" = OFF, rozhodne sa v Spec B test matici.
