import { HttpAdapter, unavailable } from './base.mjs'

export class ExTravelTimeAdapter extends HttpAdapter {
  getSegmentTimes(query = {}) {
    if (!this.endpoint) return unavailable(this.provider, 'EX traffic-time endpoint is not configured')
    return this.request(this.endpoint, {
      cacheKey: `travel-time:${JSON.stringify(query)}`,
      apiKeyQueryParam: this.apiKeyParam,
      query,
    })
  }
}