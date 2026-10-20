# ai-service

Einziger Zugang zur KI (BRIEFING 8). Kein anderer Teil des Codes ruft die Claude API oder den Adapter `AiProvider` direkt auf.
Hier entstehen in Phase 3: Aufruf mit Prompt-Version und Modell, Zod-Schemas je Funktion, ein Wiederholungsversuch bei ungültiger Ausgabe,
Sperre bei `aiAllowed = false` und Filter, der Telefonnummern und Mailadressen nie an die KI schickt.
