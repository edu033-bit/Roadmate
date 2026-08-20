import { HttpAdapter, unavailable } from './base.mjs'

export class ExVmsAdapter extends HttpAdapter {
  getMessages(query = {}) {
    if (!this.endpoint) return unavailable(this.provider, 'EX VMS endpoint is not configured')
    return this.request(this.endpoint, {
      cacheKey: `vms:${JSON.stringify(query)}`,
      apiKeyQueryParam: this.apiKeyParam,
      query,
    })
  }
}