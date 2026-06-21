import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreText, scoreTextDetails, tokenize } from "../dist/lib/text.js";

test("tokenize normalizes words and drops short tokens", () => {
  assert.deepEqual(tokenize("Auth token UI: ok, x, API"), ["auth", "token", "api"]);
});

test("scoreTextDetails scores exact task tokens and path tokens", () => {
  const details = scoreTextDetails(
    "auth token logging",
    ".pmg/memory/current-auth.md",
    "Auth token logging must stay disabled."
  );

  assert.equal(details.score, 8);
  assert.deepEqual(details.matchedTerms, ["auth", "token", "logging"]);
  assert.equal(scoreText("auth token logging", ".pmg/memory/current-auth.md", "Auth token logging must stay disabled."), details.score);
});

test("scoreTextDetails caps repeated content matches per term", () => {
  const details = scoreTextDetails(
    "token",
    ".pmg/memory/general.md",
    "token token token token token token token token"
  );

  assert.equal(details.score, 6);
  assert.deepEqual(details.matchedTerms, ["token"]);
});

test("scoreTextDetails applies category boosts from file path categories", () => {
  const details = scoreTextDetails(
    "auth token",
    ".pmg/memory/security.md",
    "Security guidance."
  );

  assert.equal(details.score, 16);
  assert.deepEqual(details.matchedTerms, ["auth", "token"]);
});

test("scoreTextDetails does not match task terms inside unrelated longer words", () => {
  const details = scoreTextDetails(
    "auth",
    "docs/authoring.md",
    "Authoring guidelines mention authors and authority."
  );

  assert.equal(details.score, 0);
  assert.deepEqual(details.matchedTerms, []);
});
