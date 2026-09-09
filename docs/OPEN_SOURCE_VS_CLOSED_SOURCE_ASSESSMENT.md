# RistoApp — Open Source vs Closed Source Assessment

Status: **ACCEPTED**
Decision date: 2026-09-09

## Decision

RistoApp adopts a **hybrid source model**.

The public/open part exists to make the ecosystem easy to integrate with and transparent where transparency has practical value. The application and infrastructure core do **not** need to be open source merely for the sake of openness.

The operating rule is:

> **Open what third parties need in order to integrate with RistoApp. Keep the sensitive application and infrastructure core private.**

This replaces the earlier idea of making the whole platform open source.

## Why

RistoApp's public value is not primarily the availability of its server source code. Its value is the customer experience, restaurant ecosystem, menu/shop model, ordering flow, payment orchestration, integrations and operational network.

Opening the internal source of identity, payments, administration, multi-tenant services, fraud controls or infrastructure provides limited ecosystem benefit while increasing exposure of implementation detail and making commercial replication easier.

The project should still be designed securely: private source is a secondary protection and never a substitute for authorization, isolation, cryptography, validation, secure payment handling or independent security testing.

## Public repository: `RistoApp`

The existing public repository remains the canonical **ecosystem and integration repository**.

It should contain only components that benefit from being public, including:

- product and architecture documentation appropriate for publication;
- public API contracts / OpenAPI definitions;
- event/webhook contracts intended for integrators;
- SDKs for third-party integrations;
- POS/KDS/printer connector interfaces;
- selected reference connectors where publication helps adoption;
- local Print Agent if we decide transparency/interoperability is valuable;
- selected local/KDS components if there is a practical integration reason;
- sample applications and integration examples;
- public security policy and vulnerability-reporting instructions.

## Private core

The following stay private by default:

- customer identity and profile backend;
- authentication and account recovery internals;
- multi-tenant application core;
- menu/shop backend implementation;
- checkout orchestration implementation;
- payment orchestration backend;
- payment-provider credential/token mappings;
- saved-payment-instrument orchestration;
- merchant onboarding internals;
- refunds and privileged financial operations;
- fraud/risk/abuse detection logic;
- restaurant/admin privileged control plane;
- kitchen/order dispatch internals where no public integration benefit exists;
- fiscalization core and sensitive fiscal integrations;
- proprietary analytics, ranking or recommendation logic;
- production infrastructure and deployment topology;
- internal monitoring and incident-response systems;
- secrets, credentials, keys and production configuration (never public under any model).

## Frontend note

Any JavaScript delivered to a customer's browser is observable in practice even if its source repository is private. Therefore sensitive authorization, price calculation, payment decisions and privilege checks must always be enforced server-side.

The public restaurant/menu experience may be built from private source while exposing only the browser bundle required to run it.

## Payment and identity rule

RistoApp owns the customer identity and checkout experience, but must not store raw card PAN or CVV/CVC in its own application database.

Saved payment methods are represented through provider/vault tokens or references plus safe display metadata. RistoApp may maintain customer history, preferences, receipts, loyalty state and reusable wallet references while the sensitive card credential remains with an appropriate payment provider/token vault.

## Security posture

Private source must never be treated as the main security boundary. The system must remain secure against an attacker who understands the overall architecture.

Mandatory principles include:

- strong tenant isolation;
- authorization on every protected operation;
- server-side price/order validation;
- verified payment webhooks/callbacks;
- idempotent payment/order/refund state transitions;
- signed/revocable QR and session mechanisms where applicable;
- least privilege;
- secret management outside Git;
- immutable financial/audit events;
- SAST/dependency/secret scanning;
- external penetration testing before meaningful production payment volume;
- rapid patching and incident-response procedures.

## Repository boundary

The public `RistoApp` repository is **not** the repository for the private production core.

When core implementation begins, it should live in a separate private repository (working name: `RistoApp-Core`), while the public repository continues to hold public contracts, SDKs, documentation and open integration components.

Whenever a private-core change affects an external contract, the corresponding public API/SDK/documentation change must also be committed to `RistoApp` so that third parties can integrate without seeing the internal implementation.

## Re-evaluation

Components may be opened later when there is a clear benefit. Publication is a one-way disclosure, so the default for uncertain or sensitive core components is private until an explicit decision says otherwise.
