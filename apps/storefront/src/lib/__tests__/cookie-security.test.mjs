import assert from "node:assert/strict"
import test from "node:test"
import { shouldSecureCookies } from "../cookie-security.mjs"

test("explicit HTTP demo URL permits cookies even in a production build", () => {
  assert.equal(shouldSecureCookies("http://192.0.2.1/outlet", "production"), false)
})

test("HTTPS deployment always uses Secure cookies", () => {
  for (const env of ["production", "development", undefined]) {
    assert.equal(shouldSecureCookies("https://shop.example.com/outlet", env), true)
  }
})

test("missing, invalid and unsupported URLs keep production cookies secure", () => {
  for (const url of [undefined, "", "invalid", "//shop.example.com", "ftp://example.com"]) {
    assert.equal(shouldSecureCookies(url, "production"), true)
  }
  assert.equal(shouldSecureCookies(undefined, "development"), false)
})
