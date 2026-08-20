export const unavailable = (provider, reason) => ({
  provider,
  observedAt: new Date().toISOString(),
  sourceType: 'estimated',
  reliability: 'insufficient',
  available: false,
  reason,
})

export class HttpAdapter {
  constructor({ provider, baseUrl, apiKey, cache, endpoint, apiKeyParam }) {
    this.provider = provider
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.cache = cache
    this.endpoint = endpoint
    this.apiKeyParam = apiKeyParam
  }

  async request(path, { headers = {}, cacheKey = path, apiKeyQueryParam, method = 'GET', body, query = {}, responseType = 'json' } = {}) {
    if (!this.apiKey) return unavailable(this.provider, 'API key is not configured')

    try {
      return await this.cache.getOrLoad(`${this.provider}:${cacheKey}`, async () => {
        const url = new URL(path, this.baseUrl)
        for (const [name, value] of Object.entries(query)) {
          if (value !== undefined && value !== null) url.searchParams.set(name, String(value))
        }
        if (apiKeyQueryParam) url.searchParams.set(apiKeyQueryParam, this.apiKey)

        const response = await fetch(url, {
          method,
          headers: apiKeyQueryParam ? headers : { ...headers, Authorization: this.apiKey },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        if (!response.ok) throw new Error(`upstream returned ${response.status}`)
        return responseType === 'text' ? response.text() : response.json()
      })
    } catch (error) {
      return unavailable(this.provider, error instanceof Error ? error.message : 'upstream request failed')
    }
  }
}