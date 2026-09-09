# RistoApp — Open Source vs Closed Source Assessment

Status: architectural decision under review
Date: 2026-09-09

## Executive conclusion

RistoApp should not choose closed source *because* closed source is assumed to be secure. Security must not depend on source secrecy. However, RistoApp has an unusually sensitive backend surface: identity, multi-tenant restaurant accounts, payment orchestration, saved payment instruments, refunds, webhook processing, kitchen dispatch, fiscal integrations, fraud controls and administrative recovery.

For that reason, the recommended starting model is **hybrid**:

- keep the ecosystem interfaces, SDKs, selected clients and integration components open;
- keep the hosted security-sensitive control plane closed initially;
- never publish secrets, credentials, production configuration or private infrastructure data;
- design all security controls so that disclosure of the architecture or code would not itself break security.

This provides most of the ecosystem/adoption benefits of openness without forcing the most security- and business-sensitive server components to be public on day one.

## Important distinction

Three concepts must not be confused:

1. **Free to use** — restaurants can use RistoApp without paying a software licence.
2. **Open source** — source code is distributed under a licence that grants the freedoms required by the Open Source Definition, including redistribution.
3. **Public source / source available** — source can be inspected, but the licence may restrict redistribution, SaaS use or commercial use; this is not necessarily open source.

RistoApp can therefore remain free for restaurants without making every backend component open source.

## Security assessment

### What closed source genuinely helps with

Closed backend source increases the effort required for an attacker to inspect implementation details, locate weak authorization paths, understand internal payment state transitions, identify obscure administrative endpoints or study anti-fraud rules. This is a useful secondary defensive layer.

It also reduces accidental disclosure of internal operational logic, proprietary abuse detection, incident response tooling, deployment details and infrastructure topology.

For a young project with a small security team, reducing immediately visible implementation detail can lower opportunistic attack pressure while the product matures.

### What closed source does NOT solve

A public web application still exposes its network endpoints, browser code, API traffic, authentication flows and observable behaviour. Serious attackers can enumerate and test these without the backend source.

RistoApp cannot therefore rely on hidden code for:

- tenant isolation;
- authorization;
- payment integrity;
- webhook authenticity;
- QR/session integrity;
- order price validation;
- refund permissions;
- protection against replay/double processing;
- protection of customer identity;
- rate limiting or abuse prevention.

These must remain secure even if an attacker understands the system design.

### What open source genuinely helps with

Open code can be independently reviewed by security researchers, integration partners and restaurant technology vendors. It can make defects easier to identify before exploitation, improve trust in local agents/KDS software and accelerate integrations.

For components installed inside a restaurant, openness is particularly valuable because operators can inspect what the software does and avoid dependence on one vendor.

### Open-source-specific risks

Open repositories require disciplined governance. Contributors and dependencies create software supply-chain risk. Malicious or vulnerable contributions, dependency compromise and exposed secrets can affect the project.

Public code also allows attackers to inspect new patches immediately. A security patch may effectively describe the prior vulnerability, making rapid deployment essential.

Self-hosting creates another risk: vulnerable old RistoApp installations may remain online after the official hosted service has already been patched.

## Payment and identity implications

The open/closed decision does not remove PCI DSS, privacy, authentication or payment-security obligations.

RistoApp should not store raw card PAN or CVV/CVC. Saved cards must be represented by PSP/token-vault references and safe metadata. CVV must never be retained after authorization.

The recommended browser/payment architecture should keep raw card data out of the RistoApp backend wherever possible by using PCI-compliant hosted fields, secure provider components or equivalent tokenization. Exact PCI scope must be evaluated for each integration and deployment model.

The most sensitive payment operations must be server-authoritative:

- totals recalculated server-side;
- payment amount bound to an immutable order/cart version;
- signed and verified provider callbacks/webhooks;
- idempotency on payment and order transitions;
- separate states for payment authorized/paid, kitchen dispatched and kitchen acknowledged;
- strict refund authorization;
- immutable audit events for financially relevant state changes.

These controls are required whether the code is public or private.

## Business assessment

### Fully open source

Advantages:

- strongest credibility around openness and vendor independence;
- easiest community contribution model;
- attractive for self-hosting;
- POS, printer and KDS integrations can grow faster;
- restaurants and integrators can customize deployments;
- public review can improve quality and trust.

Disadvantages:

- competitors can study and reuse the architecture within the licence terms;
- commercial differentiation must come mainly from hosted operations, brand, network, support and data/services rather than code;
- public patches reveal security fixes immediately;
- self-hosted forks create fragmentation and support burden;
- security response must be extremely mature from the beginning.

If full open source were selected for a network application, AGPLv3 should be evaluated because it is specifically designed to require operators of modified network-accessible versions to offer corresponding source to users. This still does not prevent commercial competitors from using the software under the licence terms.

### Fully closed source

Advantages:

- strongest control over proprietary implementation;
- easiest model for keeping fraud/risk logic and operational tooling private;
- less code-level information available to opportunistic attackers;
- easier to maintain one canonical hosted version;
- stronger software-code moat.

Disadvantages:

- loses a large part of the original RistoApp open-ecosystem proposition;
- integrations depend more heavily on the internal team;
- restaurant technology vendors may trust the platform less;
- self-hosting becomes difficult or impossible;
- users are more exposed to platform/vendor lock-in;
- closed source must still be audited and secured; secrecy is not a substitute for secure architecture.

### Hybrid model — recommended

Open/public components:

- architecture and protocol documentation;
- public REST/event API specifications;
- integration SDK;
- POS/KDS/printer connector SDK and selected reference connectors;
- restaurant print agent, if designed as a local open component;
- selected KDS/local components where transparency benefits deployment;
- client libraries and sample applications;
- security policy and vulnerability-reporting process.

Closed initially:

- production multi-tenant control plane;
- customer identity backend and account-recovery internals;
- payment orchestration backend;
- provider token mapping/vault orchestration;
- refund/risk/anti-fraud decision engines;
- merchant onboarding and privileged administration;
- production infrastructure/IaC and internal topology where publication provides no ecosystem benefit;
- secrets/key management and production configuration (always private regardless of licence);
- abuse detection, monitoring and incident-response tooling;
- proprietary commercial analytics or ranking logic.

The public browser frontend cannot be treated as secret: whatever JavaScript runs on customer devices is observable even when its source repository is private. Sensitive authorization and payment decisions must therefore remain in the backend.

## Comparative decision matrix

Scores are qualitative (1 = weak fit, 5 = strong fit) and intended to aid the architecture decision rather than claim objective measurement.

| Dimension | Fully open | Fully closed | Hybrid |
| --- | ---: | ---: | ---: |
| Secure operation for a small initial team | 3 | 4 | 5 |
| Security transparency/review | 5 | 2 | 4 |
| Commercial defensibility | 2 | 5 | 4 |
| Integration ecosystem | 5 | 2 | 5 |
| Self-hosting/vendor independence | 5 | 1 | 4 |
| Central patch/control capability | 2 | 5 | 4 |
| Community contribution | 5 | 1 | 4 |
| Ability to hide fraud/risk internals | 1 | 5 | 5 |
| Overall RistoApp fit at launch | 3 | 3 | **5** |

## Recommended repository strategy

Before substantial production backend code is written, decide the repository boundary.

Recommended structure:

- `RistoApp` — public: product documentation, API contracts, SDKs, integrations and explicitly open components.
- private production repository — hosted core/control plane, identity, payment orchestration and security-sensitive operational services.

The public repository can remain the canonical ecosystem/project repository. The fact that the hosted core is private must be documented transparently; the product should not claim that the entire platform is open source if it is not.

## Security controls required regardless of licensing model

- MFA/passkeys for privileged restaurant/admin accounts;
- strong tenant isolation and authorization checks on every request;
- short-lived sessions/tokens and secure cookie policies;
- signed QR/session tokens with rotation/revocation strategy;
- CSP and XSS protection for restaurant-generated menu content;
- CSRF protection where cookie authentication is used;
- webhook signature verification and replay protection;
- idempotent order/payment/refund processing;
- secrets manager, never credentials in Git;
- least-privilege service identities;
- encrypted data in transit and at rest;
- immutable financial/audit events;
- dependency/SBOM management;
- SAST, dependency scanning and secret scanning in CI;
- independent penetration testing before meaningful payment volume;
- documented vulnerability disclosure process;
- rapid security patch/update capability;
- backup, disaster recovery and incident-response procedures.

## Proposed decision

**Do not switch to a completely closed project solely for security.** Adopt a hybrid boundary and keep the security-sensitive hosted backend private during the initial development and validation phase.

Reassess after:

1. the MVP threat model is complete;
2. payment architecture and PCI scope are validated;
3. at least one independent security review/penetration test has been performed;
4. the commercial model (free SaaS, paid SaaS, self-hosting, support, transaction revenue, etc.) is known;
5. the expected external contributor/integrator ecosystem can be estimated.

At that point individual private components can still be opened later. The reverse is impossible: once sensitive source code and history have been made public, making the repository private does not reliably make the already published material secret again.
