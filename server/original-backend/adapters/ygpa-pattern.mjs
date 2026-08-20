import { HttpAdapter } from './base.mjs'

export class YgpaPatternAdapter extends HttpAdapter {
  getHistoricalPattern(query = {}) {
    return this.request('/B552782/termProcessTime/getTimePerTime', {
      cacheKey: `pattern:${JSON.stringify(query)}`,
      apiKeyQueryParam: 'serviceKey',
      query,
      responseType: 'text',
    })
  }
}