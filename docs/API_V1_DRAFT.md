# RistoApp public API v1 — draft contract

This repository contains public ecosystem contracts, not the private RistoApp-Core implementation.

## Guest flow

- `POST /v1/public/qr/{qrPublicId}/session` — open a table session from a QR code.
- `GET /v1/public/sessions/{sessionId}/menu` — retrieve the restaurant menu, allergens and modifier choices.
- `POST /v1/public/sessions/{sessionId}/quote` — request a server-authoritative cart quote.
- `GET /v1/public/sessions/{sessionId}/payment-methods` — retrieve payment methods enabled for that restaurant.
- `POST /v1/public/sessions/{sessionId}/checkout` — create an order and start the selected RistoApp payment flow.
- `GET /v1/public/sessions/{sessionId}/checkouts/{checkoutKey}` — read-only recovery of an already-created checkout after refresh, timeout or uncertain network outcome.
- `GET /v1/public/sessions/{sessionId}/orders/{orderId}` — retrieve order/payment/kitchen status.
- `GET /v1/public/restaurants/{slug}` — retrieve public restaurant storefront metadata.

The client submits menu/modifier IDs and quantities. Prices are never authoritative client inputs.

### Checkout idempotency and recovery

`checkoutKey` is an idempotency key scoped to the guest session. Clients should generate it once immediately before the first checkout attempt and retain the same key while recovering that attempt.

The server binds the key to the material checkout intent: payment method, saved payment instrument if present, menu items, quantities, notes and selected modifiers. Harmless ordering differences in cart lines/modifier IDs do not change the intent; the return URL is not part of the intent.

- same key + same intent -> return the existing order;
- same key + materially different intent -> `409 Conflict`;
- uncertain client outcome -> call the read-only checkout lookup before any retry;
- the lookup endpoint never creates an order and never retries a payment.

A client must not silently generate a second checkout key merely because the first HTTP response was lost. If the outcome cannot be established safely, it should surface an uncertain state instead of risking duplicate payment/order creation.

## Customer profile contract

Authenticated customer APIs expose:

- profile and preferences
- table-session attachment after login
- order history
- safe/tokenized payment-instrument metadata
- payment-instrument removal
- session logout/revocation

Raw card PAN and CVV/CVC are outside the RistoApp application data model.

## Restaurant / back-office integration concepts

RistoApp supports:

- restaurant/location/table configuration
- menu/category/item configuration
- EU allergens
- modifier groups/options
- preparation stations
- KDS device credentials
- printer-agent credentials
- payment-provider connections
- storefront branding/content

## Kitchen contract

Paid orders are routed by preparation station. A restaurant may operate separate screens or workflows for examples such as:

- `kitchen`
- `bar`
- `pizza`
- `dessert`

Station states advance independently and are aggregated into the customer-visible order state.

## Fulfillment / printer contract

Each station can use `KDS`, `PRINT`, or `BOTH` mode. Printer agents consume durable jobs using a lease/acknowledgement model so temporary device/network failure does not silently lose an order.

The public printer-agent SDK/protocol will be specified separately; the hosted queue implementation remains private.

## Payments

The RistoApp checkout is provider-agnostic. Public integrations should not assume a specific PSP. Planned adapter families include cards/wallet PSPs, PayPal, Satispay, Klarna, Amazon Pay and Italian acquiring/payment providers.

Payment success must be established by an authoritative server/provider event; a browser redirect is not sufficient evidence of payment.

## Versioning

This is a design-stage v1 draft. Fields and routes may change before the first public compatibility release.
