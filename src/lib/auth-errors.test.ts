import { describe, expect, it } from "vitest";
import { emailAuthErrorMessage, oauthErrorMessage } from "./auth-errors";

describe("oauthErrorMessage", () => {
  it("is silent without an error param", () => {
    expect(oauthErrorMessage(null)).toBeNull();
  });

  it("explains the 1Profile outage redirect from api/signin/1profile.ts", () => {
    expect(oauthErrorMessage("signin_unavailable")).toMatch(/unavailable/);
  });

  it("falls back to a generic message for other OAuth error codes", () => {
    expect(oauthErrorMessage("state_mismatch")).toMatch(/didn't complete/);
  });
});

describe("emailAuthErrorMessage", () => {
  it("points unknown emails at SSO and sign-up on the cloud", () => {
    const msg = emailAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, true);
    expect(msg).toMatch(/Google/);
    expect(msg).toMatch(/create an account/);
  });

  it("doesn't mention SSO buttons on self-hosted installs", () => {
    expect(emailAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, false)).not.toMatch(/Google/);
  });

  it("passes other server messages through", () => {
    expect(emailAuthErrorMessage({ code: "USER_ALREADY_EXISTS", message: "User already exists" }, true)).toBe(
      "User already exists",
    );
  });
});
