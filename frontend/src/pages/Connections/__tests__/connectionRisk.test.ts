import { expect, describe, it } from "vitest";
import { getConnectionHealthLevel, describeRiskCode } from "../connectionRisk";

describe("getConnectionHealthLevel", () => {
  it("returns ok when there is no risk signal", () => {
    expect(getConnectionHealthLevel({})).toBe("ok");
    expect(getConnectionHealthLevel({ code: 463 })).toBe("ok");
    expect(getConnectionHealthLevel({ at: new Date().toISOString() })).toBe("ok");
  });

  it("returns critical for 463/429 within the last hour", () => {
    const at = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(getConnectionHealthLevel({ code: 463, at })).toBe("critical");
    expect(getConnectionHealthLevel({ code: 429, at })).toBe("critical");
  });

  it("returns warning for 463/429 older than an hour but within a day", () => {
    const at = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(getConnectionHealthLevel({ code: 463, at })).toBe("warning");
  });

  it("returns warning for non-critical codes (401/403) within a day", () => {
    const at = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(getConnectionHealthLevel({ code: 401, at })).toBe("warning");
    expect(getConnectionHealthLevel({ code: 403, at })).toBe("warning");
  });

  it("returns ok once the signal is older than 24h", () => {
    const at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(getConnectionHealthLevel({ code: 463, at })).toBe("ok");
  });

  it("returns ok for an invalid date string", () => {
    expect(getConnectionHealthLevel({ code: 463, at: "not-a-date" })).toBe("ok");
  });
});

describe("describeRiskCode", () => {
  it("returns a specific explanation for known codes", () => {
    expect(describeRiskCode(463)).toMatch(/reach-out|alcance/i);
    expect(describeRiskCode(429)).toMatch(/volume|rate-overlimit/i);
  });

  it("returns empty string when no code is given", () => {
    expect(describeRiskCode(undefined)).toBe("");
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(describeRiskCode(999)).toContain("999");
  });
});
