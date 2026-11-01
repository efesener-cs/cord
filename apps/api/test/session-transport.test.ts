import { describe, expect, it } from "vite-plus/test";
import { cookieSettings } from "../src/modules/auth/transport.ts";
import { readConfig } from "../src/config/environment.ts";

describe("deployment cookie policy", () => {
  it("defaults production to Secure host-only cookies", () => {
    const config = readConfig({ NODE_ENV: "production", DATABASE_URL: "postgresql://db/cord" });
    expect(config.secureCookies).toBe(true);
    const cookie = cookieSettings(config.secureCookies);
    expect(cookie.name).toBe("__Host-cord_session");
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(cookie.options).not.toHaveProperty("domain");
  });
  it("permits an explicit loopback HTTP preview and rejects invalid configuration", () => {
    expect(
      readConfig({ DATABASE_URL: "postgresql://db/cord", COOKIE_SECURE: "false" }).secureCookies,
    ).toBe(false);
    expect(() =>
      readConfig({ DATABASE_URL: "postgresql://db/cord", COOKIE_SECURE: "invalid" }),
    ).toThrow();
    for (const origin of ["null", "*", "https://cord.example/with-path"]) {
      expect(() =>
        readConfig({ DATABASE_URL: "postgresql://db/cord", API_WEB_ORIGINS: origin }),
      ).toThrow();
    }
  });
});
