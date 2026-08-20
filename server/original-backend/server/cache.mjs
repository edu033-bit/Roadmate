export class TtlCache {
  #entries = new Map()

  constructor(ttlMs) {
    this.ttlMs = ttlMs
  }

  get(key) {
    const entry = this.#entries.get(key)
    if (!entry || entry.expiresAt <= Date.now()) {
      this.#entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key, value, ttlMs = this.ttlMs) {
    this.#entries.set(key, { value, expiresAt: Date.now() + ttlMs })
    return value
  }

  async getOrLoad(key, load, ttlMs) {
    const cached = this.get(key)
    return cached === undefined ? this.set(key, await load(), ttlMs) : cached
  }
}