import { HttpAdapter, unavailable } from './base.mjs'

export class OrsHgvAdapter extends HttpAdapter {
  async getRoutes({ coordinates, vehicle, alternativeCount = 3 }) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return unavailable(this.provider, 'Origin and destination coordinates are required')
    }

    const restrictions = {
      length: vehicle?.length,
      width: vehicle?.width,
      height: vehicle?.height,
      axleload: vehicle?.axleload,
      weight: vehicle?.weight,
      hazmat: vehicle?.hazmat ?? false,
    }
    const filteredRestrictions = Object.fromEntries(
      Object.entries(restrictions).filter(([, value]) => value !== undefined),
    )

    const requestBody = {
      coordinates,
      radiuses: coordinates.map(() => 3000),
      alternative_routes: alternativeCount > 1 ? {
        target_count: alternativeCount,
        share_factor: 0.9,
        weight_factor: 1.8,
      } : undefined,
      options: {
        vehicle_type: vehicle?.vehicleType ?? 'hgv',
        ...(Object.keys(filteredRestrictions).length > 0 ? {
          profile_params: {
            restrictions: filteredRestrictions,
          },
        } : {}),
      },
    }

    return this.request('/v2/directions/driving-hgv/geojson', {
      method: 'POST',
      body: requestBody,
      cacheKey: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    })
  }
}