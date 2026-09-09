# RistoApp Payments Architecture

Status: design draft

RistoApp uses a provider-agnostic payment orchestration layer. Each restaurant should receive funds directly through its own merchant account whenever possible; RistoApp should not hold merchant funds by default.

## Goals

- Multiple payment methods can be enabled per restaurant.
- Checkout shows only methods available for that merchant, country, currency and device.
- Payment success is confirmed server-side before an order is released to the kitchen.
- Refunds, cancellations, captures and asynchronous payment updates use a common internal interface.
- No single PSP is mandatory; open-source deployments can choose adapters.

## Priority providers for Italy

Tier 1:
- Cards via a PSP such as Stripe or Nexi XPay
- Apple Pay
- Google Pay
- PayPal Checkout
- Satispay

Tier 2:
- Klarna
- Amazon Pay
- MyBank / bank redirect
- Additional Italian and European methods as demand requires

## Adapter contract

A PaymentProvider adapter should expose at least:

- capabilities()
- createPayment()
- getPaymentStatus()
- capturePayment()
- cancelPayment()
- refundPayment()
- verifyWebhook()
- normalizeWebhookEvent()

Optional capabilities:

- partial capture
- partial refund
- delayed capture / funds lock
- recurring authorization
- marketplace / connected-account onboarding

## Core states

CREATED -> REQUIRES_ACTION -> PROCESSING -> PAID
                                 |-> FAILED
PAID -> PARTIALLY_REFUNDED -> REFUNDED
PAID -> CANCELLED only where the provider/payment lifecycle allows it.

RistoApp must never dispatch an order solely because the browser returned to a success URL. The authoritative transition to PAID must come from a verified server-side provider response or webhook/callback, with idempotency protection.

## Merchant settlement

Preferred model: merchant-direct settlement. Each restaurant connects its own payment account and receives payouts from the PSP directly. RistoApp stores only the connection/configuration needed to initiate and reconcile payments. This reduces platform custody of funds and avoids making RistoApp the default settlement intermediary.

## Integration strategy

Use two layers:

1. Aggregator adapters for fast coverage (for example Stripe can expose cards, wallets and supported local methods from one integration).
2. Direct adapters for strategic methods such as PayPal, Satispay or providers a restaurant already contracts with.

This keeps the project open, avoids PSP lock-in and allows restaurants to choose pricing/contracts.
