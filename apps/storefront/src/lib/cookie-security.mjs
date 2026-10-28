export function shouldSecureCookies(publicUrl, nodeEnv) {
  if (publicUrl) {
    try {
      const protocol = new URL(publicUrl).protocol
      if (protocol === "https:") return true
      if (protocol === "http:") return false
    } catch {
      // Invalid or missing deployment configuration must not weaken production.
    }
  }
  return nodeEnv === "production"
}
