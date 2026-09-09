# RistoApp Payments Architecture

Status: design draft

## Core principle

RistoApp owns the customer checkout experience. Payment service providers are interchangeable processing engines behind RistoApp APIs/adapters. A customer should browse, order, choose a payment method, confirm payment and receive order status inside the RistoApp ecosystem. Provider-hosted authentication, bank SCA/3DS challenges, wallet approval windows or redirects are allowed only when required by the underlying payment method.

RistoApp must support both anonymous checkout and authenticated customers with reusable payment methods.

## Security and card storage

RistoApp MUST NOT store raw PAN/card number, CVV/CVC or equivalent sensitive authentication data in its application database.

When a customer chooses "save this card", RistoApp stores a provider/vault token or payment-method reference plus safe display metadata such as brand, last four digits and expiry. Sensitive card data remains in a PCI-compliant vault operated by the selected PSP/tokenization provider.

This allows the RistoApp UI to show, for example, `Visa •••• 4242`, while future payments are initiated using the saved token.

Explicit consent to save/reuse a payment method must be recorded.

## Customer experience

### Guest

QR -> menu -> cart -> RistoApp checkout -> payment -> kitchen -> receipt/status

No registration required.

### Registered customer

QR -> identified RistoApp session -> menu -> cart -> select saved payment method -> confirm -> kitchen

The account may retain:

- customer identity/profile
- order history across restaurants
- receipts
- favourite restaurants/items
- dietary preferences and other user-controlled preferences
- loyalty data
- saved delivery/contact data when relevant
- tokenized payment methods
- payment preferences

## Platform wallet model

RistoApp should maintain its own logical `Wallet` abstraction. A wallet item is not a card record: it is a reference to a payment credential held by a compliant payment provider or wallet provider.

Suggested model:

- `Customer`
- `Wallet`
- `PaymentInstrument`
- `ProviderCredentialRef`
- `MerchantPaymentConnection`
- `PaymentAttempt`
- `Payment`
- `Refund`

A `PaymentInstrument` can represent card, PayPal, Satispay, Amazon Pay or another supported instrument. Provider-specific tokens stay behind the adapter boundary.

## Cross-restaurant reuse

Where a PSP and the merchant/platform agreement allow it, a customer payment credential should be saved at platform level and reused across participating restaurants. Where provider rules require merchant-level storage, the adapter must hide that detail and maintain the mapping between the RistoApp wallet instrument and merchant-specific provider token(s).

The application must not assume that every payment method can be reused identically across every merchant/provider.

## Payment methods for Italy

Priority A:

- Cards
- Apple Pay
- Google Pay
- PayPal
- Satispay

Priority B:

- Klarna
- Amazon Pay
- Nexi / XPay and other common Italian acquiring options
- MyBank / bank redirect and additional European methods where useful

## Provider-agnostic checkout

The RistoApp checkout UI calls only RistoApp APIs. It does not encode provider-specific business logic.

Example internal flow:

1. `POST /checkout/sessions`
2. RistoApp resolves restaurant, amount, customer/guest and available methods.
3. `GET /checkout/sessions/{id}/payment-methods`
4. Customer chooses card/wallet/payment method in RistoApp UI.
5. `POST /checkout/sessions/{id}/confirm`
6. Payment Orchestrator selects the provider adapter and creates/confirms the provider-side payment.
7. Required customer actions (3DS, PayPal approval, Satispay flow, Klarna UI, Amazon Pay approval) are surfaced inside or on top of the RistoApp checkout whenever the provider supports it.
8. Provider server-side event is verified.
9. RistoApp marks payment `PAID`.
10. Only then is the order released to KDS/kitchen.

## Adapter contract

A `PaymentProvider` adapter should expose at least:

- `capabilities()`
- `createCustomerBinding()`
- `createPayment()`
- `confirmPayment()`
- `getPaymentStatus()`
- `capturePayment()`
- `cancelPayment()`
- `refundPayment()`
- `createSetup()` / `saveInstrument()` where supported
- `deleteSavedInstrument()`
- `verifyWebhook()`
- `normalizeWebhookEvent()`

Optional capabilities:

- partial capture
- partial refund
- delayed capture / funds lock
- recurring/off-session authorization
- platform-level vaulting
- merchant-level vaulting
- connected-account onboarding

## Core states

`CREATED -> REQUIRES_ACTION -> PROCESSING -> PAID`

Failure paths include `FAILED`, `CANCELLED`, `EXPIRED`.

Refund paths include `PARTIALLY_REFUNDED` and `REFUNDED`.

RistoApp must never dispatch an order solely because the browser returned to a success URL. The authoritative transition to `PAID` must come from a verified server-side provider response or webhook/callback, protected by idempotency.

## Merchant settlement

The customer experience being owned by RistoApp does NOT require RistoApp to custody restaurant funds.

Preferred baseline: merchant-direct settlement where technically and contractually available. Each restaurant connects/creates an eligible merchant account and the PSP pays that restaurant directly. RistoApp orchestrates the checkout and can potentially collect a platform/application fee where the provider supports that model.

Alternative settlement models may be supported later, but they require separate legal, regulatory, tax, chargeback and risk analysis.

## Integration strategy

Use both:

1. PSP/aggregator adapters for broad card/wallet coverage.
2. Direct adapters for strategic payment methods such as PayPal, Satispay, Klarna, Amazon Pay, Nexi or others.

This preserves a single RistoApp checkout while avoiding lock-in to one processor.
