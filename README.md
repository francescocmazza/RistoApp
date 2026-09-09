# RistoApp

RistoApp is a restaurant ordering ecosystem built around a simple flow:

**scan the table QR -> browse the restaurant menu -> order -> pay inside RistoApp -> send the confirmed order to the kitchen.**

This repository contains the public, integration-facing parts of the project. Security-sensitive hosted backend implementation lives in a separate private repository.

## Public components

- `apps/guest-web` — dependency-free mobile-first PWA for guests at the table.
- `apps/kds-web` — dependency-free PWA for the kitchen display system.
- `openapi/ristoapp-v1.yaml` — public HTTP contract for the first vertical slice.
- `docs/PAYMENTS.md` — payment architecture.
- `docs/OPEN_SOURCE_VS_CLOSED_SOURCE_ASSESSMENT.md` — accepted hybrid source strategy.

## Development status

The current vertical slice covers QR sessions, menus, cart/checkout, provider-neutral payment state, kitchen dispatch and KDS status progression. Real payment-provider adapters and production customer authentication are still under development.

## Run the static clients locally

Any static web server works. For example from the repository root:

```bash
python -m http.server 8080
```

Then open:

- guest: `http://localhost:8080/apps/guest-web/?api=http://localhost:3000&qr=<QR_PUBLIC_ID>`
- KDS: `http://localhost:8080/apps/kds-web/?api=http://localhost:3000&location=<LOCATION_ID>`

The Core API must allow the static-client origin through CORS.

## Public/private boundary

Public code is intended to make RistoApp interoperable and easy to integrate. Identity internals, payment orchestration implementation, fraud/risk logic, privileged administration and production infrastructure remain private.
