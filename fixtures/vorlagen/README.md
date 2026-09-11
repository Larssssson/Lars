# Captured fixtures — 25-Mio-Vorlagen

Real records, captured by hand from published reporting because this
development environment has no outbound network access (the gateway denies
CONNECT to every source host).

Each record carries `verified`, `retrieved` and `source_url`. Coverage here is
**three of the sixteen** Vorlagen approved on 8 July 2026 — the ones the
reviewed sources named individually. The session totalled approximately
EUR 9.5bn. The other thirteen are not captured, and nothing in this repository
should imply otherwise.

For context on volume: 55 Vorlagen in 2023, 97 in 2024, 103 in 2025.

Replacing this with a real feed means implementing `fetch_raw("vorlagen", ...)`
against the Bundestag's published documents and the defence trade press, on a
machine with egress.
