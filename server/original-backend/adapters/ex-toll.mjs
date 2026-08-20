import { HttpAdapter, unavailable } from './base.mjs'

export class ExTollAdapter extends HttpAdapter {
  getToll(query = {}) {
    if (!this.endpoint) return unavailable(this.provider, 'EX toll endpoint is not configured')
    return this.request(this.endpoint, {
      cacheKey: `toll:${JSON.stringify(query)}`,
      apiKeyQueryParam: this.apiKeyParam,
      query,
    })
  }
}