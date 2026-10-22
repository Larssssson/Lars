import { describe, expect, it } from "vitest";
import { compareVersions } from "@/lib/domain/documents/compare";
import { buildFilledContent } from "@/lib/domain/documents/template";
import type { JSONNode } from "@/lib/editor/content";

const blocks = [{ key: "headline", label: "Headline", required: true }, { key: "lead", label: "Lead", required: true }];

describe("Versionsvergleich (BRIEFING 7.3)", () => {
  it("markiert entfernte und hinzugefügte Wörter je Baustein", () => {
    const a = buildFilledContent(blocks, { headline: "Covenant baut in Sachsen", lead: "Gleich" }) as JSONNode;
    const b = buildFilledContent(blocks, { headline: "Covenant baut in Leipzig", lead: "Gleich" }) as JSONNode;
    const [headline, lead] = compareVersions(a, b);
    expect(headline?.changed).toBe(true);
    expect(headline?.left.filter((p) => p.kind === "removed").map((p) => p.text.trim())).toEqual(["Sachsen"]);
    expect(headline?.right.filter((p) => p.kind === "added").map((p) => p.text.trim())).toEqual(["Leipzig"]);
    expect(lead?.changed).toBe(false);
  });
});
