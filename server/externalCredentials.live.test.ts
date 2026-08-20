import { describe, expect, it } from "vitest";

const orsKey = process.env.OPENROUTESERVICE_API_KEY;

describe("external provider credentials", () => {
  it("authenticates a lightweight HGV directions request", async () => {
    expect(orsKey, "OPENROUTESERVICE_API_KEY must be configured").toBeTruthy();

    const params = new URLSearchParams({
      start: "127.7188,34.8806",
      end: "127.7161,34.7890",
    });
    const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-hgv?${params}`, {
      headers: { Authorization: orsKey! },
    });

    const body = await response.text();
    expect(response.status, `ORS rejected the configured API key: ${body.slice(0, 240)}`).not.toBe(401);
    expect(response.status, `ORS rejected the configured API key: ${body.slice(0, 240)}`).not.toBe(403);
    expect(body.length).toBeGreaterThan(0);
  }, 20_000);
});
