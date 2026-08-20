import { ExTollAdapter } from '../adapters/ex-toll.mjs'
import { ExTravelTimeAdapter } from '../adapters/ex-travel-time.mjs'
import { ExVmsAdapter } from '../adapters/ex-vms.mjs'
import { KmaWeatherAdapter } from '../adapters/kma-weather.mjs'
import { OrsHgvAdapter } from '../adapters/ors-hgv.mjs'
import { YgpaPatternAdapter } from '../adapters/ygpa-pattern.mjs'
import { TtlCache } from './cache.mjs'
import { config } from './config.mjs'

const cache = new TtlCache(config.cacheTtlMs)
const exOptions = { baseUrl: config.ex.baseUrl, apiKey: config.ex.apiKey, cache, apiKeyParam: config.ex.apiKeyParam }

export const providers = {
  ors: new OrsHgvAdapter({ provider: 'ORS HGV', baseUrl: config.ors.baseUrl, apiKey: config.ors.apiKey, cache }),
  kma: new KmaWeatherAdapter({ provider: 'KMA', baseUrl: config.kma.baseUrl, apiKey: config.kma.apiKey, cache }),
  ygpa: new YgpaPatternAdapter({ provider: 'YGPA pattern', baseUrl: config.ygpa.baseUrl, apiKey: config.ygpa.apiKey, cache }),
  exTravelTime: new ExTravelTimeAdapter({ provider: 'EX travel time', endpoint: config.ex.travelTimeEndpoint, ...exOptions }),
  exToll: new ExTollAdapter({ provider: 'EX toll', endpoint: config.ex.tollEndpoint, ...exOptions }),
  exVms: new ExVmsAdapter({ provider: 'EX VMS', endpoint: config.ex.vmsEndpoint, ...exOptions }),
}