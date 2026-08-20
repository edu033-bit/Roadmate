import { providers } from '../server/providers.mjs'

const nowIso = () => new Date().toISOString()

const source = (provider, sourceType, reliability, detail) => ({
  provider,
  observedAt: nowIso(),
  sourceType,
  reliability,
  detail,
})

const insufficient = (message) => ({
  status: 'insufficient',
  reason: 'insufficient_evidence',
  message,
  sources: [source('ORS HGV', 'estimated', 'insufficient', 'No route duration was produced')],
})

const defaultSources = [
  source('ORS HGV', 'estimated', 'sufficient', 'HGV candidate route estimate'),
  source('KMA', 'realtime', 'sufficient', 'Weather observation and forecast'),
  source('EX travel time', 'realtime', 'partial', 'Highway segment coverage only'),
  source('EX toll', 'static', 'partial', 'Some private-road sections require confirmation'),
  source('EX VMS', 'realtime', 'partial', 'Guidance only; not a traffic-control decision'),
  source('YGPA pattern', 'static', 'partial', 'Historical pattern, not real-time gate wait'),
]

const defaultOrigin = [127.7188, 34.8806]
const defaultDestination = [127.7161, 34.789]

const isUnavailable = (value) => value?.available === false
const providerSource = (value, sourceType, reliability, detail) =>
  isUnavailable(value)
    ? source(value.provider, sourceType, 'insufficient', value.reason)
    : source(detail.provider, sourceType, reliability, detail.message)

const parsePoint = (query, name, fallback) => {
  const value = query.get(name)
  if (!value) return fallback
  const point = value.split(',').map(Number)
  return point.length === 2 && point.every(Number.isFinite) ? point : fallback
}

const kmaGrid = ([longitude, latitude]) => {
  const rad = Math.PI / 180
  const earthRadius = 6371.00877 / 5
  const standardLat1 = 30 * rad
  const standardLat2 = 60 * rad
  const originLon = 126 * rad
  const originLat = 38 * rad
  const scale = Math.tan(Math.PI * 0.25 + standardLat2 * 0.5) / Math.tan(Math.PI * 0.25 + standardLat1 * 0.5)
  const sn = Math.log(Math.cos(standardLat1) / Math.cos(standardLat2)) / Math.log(scale)
  const sf = Math.pow(Math.tan(Math.PI * 0.25 + standardLat1 * 0.5), sn) * Math.cos(standardLat1) / sn
  const ro = earthRadius * sf / Math.pow(Math.tan(Math.PI * 0.25 + originLat * 0.5), sn)
  const ra = earthRadius * sf / Math.pow(Math.tan(Math.PI * 0.25 + latitude * rad * 0.5), sn)
  let theta = longitude * rad - originLon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return { nx: Math.floor(ra * Math.sin(theta) + 43.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136.5) }
}

const latestKmaBase = () => {
  const now = new Date()
  const refTime = new Date(now.getTime() - (now.getMinutes() < 45 ? 60 * 60 * 1000 : 0))
  const pad = (n) => String(n).padStart(2, '0')
  const baseDate = '' + refTime.getFullYear() + pad(refTime.getMonth() + 1) + pad(refTime.getDate())
  const baseTime = pad(refTime.getHours()) + '00'
  return { baseDate, baseTime }
}

const weatherFrom = (payload) => {
  const items = payload?.response?.body?.items?.item
  if (!Array.isArray(items)) return { state: 'normal', weatherReason: undefined }
  const values = Object.fromEntries(items.map((item) => [item.category, Number(item.obsrValue)]))
  const wind = values.WSD
  const rain = values.RN1
  const pty = values.PTY
  if (!Number.isFinite(wind) && !Number.isFinite(rain)) return { state: 'insufficient', weatherReason: '기상 데이터 확인 필요' }
  if (wind >= 14 || rain >= 35) return { state: 'high', weatherReason: `기상청 강풍/호우 특보 기준 (${wind ? `풍속 ${wind}m/s` : ''} ${rain ? `강수 ${rain}mm` : ''})` }
  if (wind >= 7 || rain > 0 || (pty && pty > 0)) return { state: 'caution', weatherReason: `기상 주의 구간 (${wind ? `풍속 ${wind}m/s` : ''} ${rain ? `강수 ${rain}mm` : ''})` }
  return { state: 'normal' }
}

const timeToMinutes = (value) => {
  if (!value || typeof value !== 'string') return 15 * 60 + 30
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : 15 * 60 + 30
}

const formatMinutes = (value) => {
  const normalized = ((value % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

const formatDuration = (minutes) => `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`

const fuelEfficiencyForPreset = (preset) => {
  if (preset === 'two-axle') return 3.8
  if (preset === 'special') return 2.6
  return 3.2
}

const liveSources = async (origin, query) => {
  const grid = kmaGrid(origin)
  const kmaQuery = { ...latestKmaBase(), ...grid }
  const exQuery = { originCode: query.get('exOriginCode'), destinationCode: query.get('exDestinationCode'), type: 'json' }
  const [weather, portPattern, vms, travelTime, toll] = await Promise.all([
    providers.kma.getObservation(kmaQuery),
    providers.ygpa.getHistoricalPattern(),
    providers.exVms.getMessages(exQuery),
    providers.exTravelTime.getSegmentTimes(exQuery),
    providers.exToll.getToll(exQuery),
  ])

  return {
    weather,
    vms,
    sources: [
      providerSource(weather, 'realtime', 'sufficient', { provider: 'KMA', message: '기상청 초단기실황' }),
      providerSource(travelTime, 'realtime', 'partial', { provider: 'EX travel time', message: '영업소 구간 통행시간' }),
      providerSource(toll, 'static', 'partial', { provider: 'EX toll', message: '차종별 통행요금 조회' }),
      providerSource(vms, 'realtime', 'partial', { provider: 'EX VMS', message: '고속도로 VMS 안내' }),
      providerSource(portPattern, 'static', 'partial', { provider: 'YGPA pattern', message: '항만 과거 시간대 패턴' }),
    ],
  }
}

export const getPlanSummary = async (query) => {
  if (query.get('simulate') === 'ors_failure') {
    return { statusCode: 503, body: insufficient('후보 경로를 가져오지 못했습니다. 외부 내비게이션에서 경로를 확인하세요.') }
  }

  if (query.get('live') === 'true') {
    const origin = parsePoint(query, 'origin', defaultOrigin)
    const arrivalTime = query.get('arrivalTime') ?? '15:30'
    const workload = query.get('workload') ?? 'busy'
    const live = await liveSources(origin, query)
    const weather = weatherFrom(live.weather)
    const vmsReason = isUnavailable(live.vms) ? undefined : '고속도로 VMS 표출 안내'

    const safetySlack = workload === 'busy' ? 24 : 36
    const arrivalMinutes = timeToMinutes(arrivalTime)
    const estimatedTravel = 35
    const startM = arrivalMinutes - estimatedTravel - safetySlack
    const startAtStr = formatMinutes(startM)
    const endAtStr = formatMinutes(startM + 20)

    return {
      statusCode: 200,
      body: {
        status: weather.state === 'insufficient' ? 'insufficient' : 'ready',
        planId: 'live-jeonnam-001',
        risk: { ...weather, vmsReason, advisory: '실제 표지·통제기관 안내 우선' },
        departureWindow: {
          startAt: startAtStr,
          endAt: endAtStr,
          reliability: weather.state === 'insufficient' ? 'insufficient' : 'sufficient',
        },
        recommendation: {
          optionId: 'balanced',
          label: '기본 추천',
          reason: '실시간 경로 및 기상 실황 반영',
        },
        sources: live.sources,
      },
    }
  }

  return {
    statusCode: 200,
    body: {
      status: 'ready',
      planId: 'mock-jeonnam-001',
      risk: {
        state: 'caution',
        weatherReason: '오후 강풍 예보',
        vmsReason: 'VMS 안내 표출',
        advisory: '실제 표지·통제기관 안내 우선',
      },
      departureWindow: {
        startAt: '13:10',
        endAt: '13:30',
        reliability: 'partial',
      },
      recommendation: {
        optionId: 'balanced',
        label: '기본 추천',
        reason: '납기 여유와 예상 직접비를 균형 있게 반영',
      },
      sources: defaultSources,
    },
  }
}

export const getPlanOptions = async (query) => {
  if (query.get('simulate') === 'ors_failure') {
    return { statusCode: 503, body: insufficient('후보 경로를 가져오지 못했습니다. 0분 또는 0원으로 대체하지 않았습니다.') }
  }

  if (query.get('live') === 'true') {
    const origin = parsePoint(query, 'origin', defaultOrigin)
    const destination = parsePoint(query, 'destination', defaultDestination)
    const destinationName = query.get('destinationName') ?? ''
    const isGwangyangPort = destinationName.includes('광양항') || destinationName.includes('GWCT') || destinationName.includes('KIT') || destinationName.includes('터미널')
    const portBuffer = isGwangyangPort ? 15 : 0

    const arrivalTime = query.get('arrivalTime') ?? '15:30'
    const workload = query.get('workload') ?? 'busy'
    const vehiclePreset = query.get('vehiclePreset') ?? 'three-axle'
    const customFuelEff = Number(query.get('fuelEfficiency'))
    const fuelEff = Number.isFinite(customFuelEff) && customFuelEff > 0 ? customFuelEff : fuelEfficiencyForPreset(vehiclePreset)
    const dieselPrice = 1550

    const vehicle = {
      length: Number(query.get('length')) || (vehiclePreset === 'two-axle' ? 12 : vehiclePreset === 'special' ? 19 : 16.7),
      width: Number(query.get('width')) || 2.5,
      height: Number(query.get('height')) || 4,
      weight: Number(query.get('weight')) || (vehiclePreset === 'two-axle' ? 25 : vehiclePreset === 'special' ? 44 : 40),
      axleload: Number(query.get('axleload')) || 10,
      hazmat: query.get('hazmat') === 'true',
    }

    const [routePayload, live] = await Promise.all([
      providers.ors.getRoutes({ coordinates: [origin, destination], vehicle, alternativeCount: 3 }),
      liveSources(origin, query),
    ])

    if (isUnavailable(routePayload)) {
      return { statusCode: 503, body: insufficient('후보 경로를 가져오지 못했습니다. 외부 내비게이션에서 경로를 확인하세요.') }
    }

    const features = routePayload?.features ?? []
    if (!features.length) {
      return { statusCode: 503, body: insufficient('ORS 응답에 사용할 수 있는 경로가 없습니다.') }
    }

    const weather = weatherFrom(live.weather)
    const kinds = ['balanced', 'fastest', 'lowest-cost']
    const kindIds = ['base', 'time', 'cost']
    const labels = ['기본 추천', '시간 우선', '비용 우선']
    const arrivalMinutes = timeToMinutes(arrivalTime)
    const safetySlack = workload === 'busy' ? 24 : 36

    const options = features.map((feature, index) => {
      const summary = feature.properties.summary
      const durationMinutes = Math.ceil(summary.duration / 60)
      const distanceKm = Number((summary.distance / 1000).toFixed(1))
      const fuelCost = Math.round((distanceKm / fuelEff) * dieselPrice)
      const departureTime = formatMinutes(arrivalMinutes - durationMinutes - safetySlack - portBuffer)
      const isBase = index === 0

      return {
        id: kinds[index] ?? `route-${index + 1}`,
        routeKind: kindIds[index] ?? 'base',
        kind: kinds[index] ?? 'balanced',
        label: labels[index] ?? `후보 경로 ${index + 1}`,
        title: labels[index] ?? `후보 경로 ${index + 1}`,
        shortTitle: labels[index] ?? `후보 ${index + 1}`,
        departure: departureTime,
        duration: formatDuration(durationMinutes),
        durationMinutes,
        distanceKm,
        cost: `${fuelCost.toLocaleString('ko-KR')}원`,
        directCost: { amountKrw: fuelCost, reliability: 'partial', note: '유류비 추정치 · 통행료 확인 필요' },
        delta: isBase ? (isGwangyangPort ? '항만 패턴 반영' : '균형 선택') : index === 1 ? '시간 단축' : '비용 절감',
        reason: isBase ? (isGwangyangPort ? '시간·직접비 균형 + 광양항 과거 패턴 반영 (+15분)' : '시간과 직접비를 균형 있게 반영') : index === 1 ? '최단 시간 경로' : '최소 비용 경로',
        statusText: weather.state === 'caution' ? '주의' : weather.state === 'high' ? '보류' : '정상',
        riskState: weather.state,
        portPatternApplied: isGwangyangPort,
        geometryCoordinates: feature.geometry?.coordinates ?? [],
        sources: [
          providerSource(routePayload, 'estimated', 'sufficient', { provider: 'ORS HGV', message: 'HGV 제약 실시간 경로' }),
          ...live.sources,
        ],
      }
    })

    return {
      statusCode: 200,
      body: {
        status: 'ready',
        planId: 'live-jeonnam-001',
        options,
      },
    }
  }

  return {
    statusCode: 200,
    body: {
      status: 'ready',
      planId: 'mock-jeonnam-001',
      options: [
        {
          id: 'balanced',
          kind: 'balanced',
          label: '기본 추천',
          durationMinutes: 118,
          distanceKm: 126.4,
          directCost: { amountKrw: 28700, reliability: 'partial', note: '일부 구간 통행료 확인 필요' },
          riskState: 'caution',
          sources: defaultSources,
        },
        {
          id: 'fastest',
          kind: 'fastest',
          label: '시간 우선',
          durationMinutes: 106,
          distanceKm: 132.8,
          directCost: { amountKrw: 32100, reliability: 'partial', note: '일부 구간 통행료 확인 필요' },
          riskState: 'caution',
          sources: defaultSources,
        },
        {
          id: 'lowest-cost',
          kind: 'lowest-cost',
          label: '비용 우선',
          durationMinutes: 127,
          distanceKm: 119.2,
          directCost: { amountKrw: 24500, reliability: 'partial', note: '일부 구간 통행료 확인 필요' },
          riskState: 'normal',
          sources: defaultSources,
        },
      ],
    },
  }
}