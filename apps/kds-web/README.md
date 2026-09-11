# RistoApp KDS web

This is the public/reference browser KDS for the RistoApp integration contract.

## Current behavior

The KDS connects with:

- RistoApp Core/API base URL;
- location UUID;
- optional preparation-station code (`kitchen`, `bar`, `pizza`, ...);
- location/restaurant-scoped KDS bearer token.

The token is kept in `sessionStorage`, not in the URL.

The current Core contract returns station tickets rather than one aggregate kitchen card per order. A multi-station order can therefore appear independently on kitchen, bar or pizza screens and each station advances only its own ticket.

## Realtime

The client opens:

```text
GET /v1/kds/locations/{locationId}/orders/events?station={stationCode}
Authorization: Bearer <token>
Accept: text/event-stream
```

A browser-native `EventSource` is intentionally **not** used because it cannot attach the Authorization header. The KDS parses SSE from a streaming `fetch` request instead.

If the stream fails for a network/server reason, the client falls back to the ordinary REST queue endpoint and retries the stream. `401`/`403` return the UI to setup instead of retrying with an invalid credential.

## State transitions

Each ticket advances through:

`DISPATCHED -> ACKNOWLEDGED -> PREPARING -> READY -> SERVED`

using the station-specific route:

```text
PATCH /v1/kds/orders/{orderId}/stations/{stationCode}/status
```

The Core derives the aggregate customer-visible kitchen state from all station tickets.
