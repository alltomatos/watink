import { describe, it, expect } from "vitest";
import {
    normalizeVariantContent,
    validateVariant,
    defaultVariant,
    estimateCampaignDuration,
    buildVariantInput,
} from "../campaignHelpers";

describe("campaignHelpers", () => {
    describe("normalizeVariantContent", () => {
        it("maps canonical `button` into the editor's `button_text` for list", () => {
            const out = normalizeVariantContent("list", { body: "oi", button: "Ver opções" });
            expect(out.button_text).toBe("Ver opções");
            expect(out.button).toBeUndefined();
        });

        it("maps canonical `mediaType` into the editor's `media_type` for media", () => {
            const out = normalizeVariantContent("media", { url: "https://x/y.jpg", mediaType: "image" });
            expect(out.media_type).toBe("image");
            expect(out.mediaType).toBeUndefined();
        });

        it("maps canonical `maxSelections` into the editor's `max_selections` for poll", () => {
            const out = normalizeVariantContent("poll", { question: "?", maxSelections: 2 });
            expect(out.max_selections).toBe(2);
            expect(out.maxSelections).toBeUndefined();
        });

        it("never overwrites an already-present legacy key", () => {
            const out = normalizeVariantContent("media", { media_type: "video", mediaType: "image" });
            expect(out.media_type).toBe("video");
        });

        it("leaves unrelated types untouched", () => {
            const out = normalizeVariantContent("text", { body: "oi" });
            expect(out).toEqual({ body: "oi" });
        });

        it("returns an empty object for null/undefined input", () => {
            expect(normalizeVariantContent("text", null)).toEqual({});
            expect(normalizeVariantContent("text", undefined)).toEqual({});
        });
    });

    describe("validateVariant", () => {
        it("requires a non-empty body for text", () => {
            const v = defaultVariant(0);
            expect(validateVariant(v)).toBe("Mensagem obrigatória");
            v.textBody = "oi";
            expect(validateVariant(v)).toBeUndefined();
        });

        it("requires a URL for media", () => {
            const v = { ...defaultVariant(0), type: "media" as const };
            expect(validateVariant(v)).toBe("URL obrigatória");
        });

        it("requires at least 2 options for poll", () => {
            const v = defaultVariant(0);
            v.type = "poll";
            v.pollContent = { ...v.pollContent, question: "?", options: ["só uma"] };
            expect(validateVariant(v)).toBe("Adicione ao menos 2 opções");
        });
    });

    describe("buildVariantInput", () => {
        it("serializes content to a JSON string and falls back to a positional label", () => {
            const v = defaultVariant(0);
            v.textBody = "olá {{group_name}}";
            const input = buildVariantInput(v, 1);
            expect(input.label).toBe("Variante 2");
            expect(input.message).toBe("olá {{group_name}}");
            expect(JSON.parse(input.content ?? "{}")).toEqual({ body: "olá {{group_name}}" });
        });
    });

    describe("estimateCampaignDuration", () => {
        it("reports zero groups distinctly", () => {
            expect(estimateCampaignDuration({ targetsCount: 0, intervalSeconds: 60, batchSize: 10, batchPauseSeconds: 300 })).toBe(
                "Nenhum grupo selecionado"
            );
        });

        it("accounts for both interval and batch pauses", () => {
            const now = new Date("2026-01-01T10:00:00");
            const label = estimateCampaignDuration(
                { targetsCount: 25, intervalSeconds: 60, batchSize: 10, batchPauseSeconds: 300 },
                now
            );
            // 24 intervals * 60s + 2 batch pauses * 300s = 1440 + 600 = 2040s = 34min
            expect(label).toContain("25 grupos");
            expect(label).toContain("34 min");
        });
    });
});
