import { HttpAdapter } from './base.mjs'

export class KmaWeatherAdapter extends HttpAdapter {
  getObservation({ baseDate, baseTime, nx, ny }) {
    const query = { pageNo: 1, numOfRows: 1000, dataType: 'JSON', base_date: baseDate, base_time: baseTime, nx, ny }
    return this.request('/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', {
      cacheKey: `observation:${JSON.stringify(query)}`,
      apiKeyQueryParam: 'serviceKey',
      query,
    })
  }
}