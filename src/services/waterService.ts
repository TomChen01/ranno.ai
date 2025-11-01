// src/services/waterService.ts

export type PublicAmenityPoint = {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

type FetchOptions = {
  limit?: number;
};

const WATER_ENDPOINT = 'https://data.sfgov.org/resource/wfq4-upmv.json';
const RESTROOM_ENDPOINT = 'https://data.sfgov.org/resource/wfq4-upmv.json';
const DEFAULT_LIMIT = 500;

async function fetchAmenity(resourceType: 'drinking_water' | 'restroom', options: FetchOptions = {}): Promise<PublicAmenityPoint[]> {
  const { limit = DEFAULT_LIMIT } = options;
  const token = import.meta.env.VITE_SFGOV_APP_TOKEN;

  const params = new URLSearchParams({
    resource_type: resourceType,
    $limit: limit.toString(),
  });

  const performFetch = async (withToken: boolean) => {
    const headers = withToken && token ? { 'X-App-Token': token } : undefined;
    const endpoint = resourceType === 'drinking_water' ? WATER_ENDPOINT : RESTROOM_ENDPOINT;
    return fetch(`${endpoint}?${params.toString()}`, { headers });
  };

  let response = await performFetch(Boolean(token));

  if (response.status === 403 && token) {
    console.warn(`${resourceType} API returned 403 with provided token, retrying without token.`);
    response = await performFetch(false);
  }

  if (!response.ok) {
    const detail = response.status === 403
      ? 'Access denied. Confirm the SFGov App Token has access to this dataset or remove the token for public access.'
      : `HTTP ${response.status}`;
    throw new Error(`Failed to fetch ${resourceType === 'drinking_water' ? 'water fountains' : 'restrooms'}: ${detail}`);
  }

  const raw = (await response.json()) as Array<{
    objectid?: string;
    name?: string;
    location_name?: string;
    location?: { latitude?: string; longitude?: string; human_address?: string };
    latitude?: string;
    longitude?: string;
    address?: string;
  }>;

  const amenities: PublicAmenityPoint[] = [];

  raw.forEach((item, index) => {
    const lat = Number(item.latitude ?? item.location?.latitude);
    const lng = Number(item.longitude ?? item.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }
    amenities.push({
      id: item.objectid ?? `${resourceType}-${index}`,
      latitude: lat,
      longitude: lng,
      name: item.name ?? item.location_name ?? undefined,
      address: item.address ?? item.location?.human_address ?? undefined,
    });
  });

  return amenities;
}

export async function fetchWaterPoints(options: FetchOptions = {}): Promise<PublicAmenityPoint[]> {
  return fetchAmenity('drinking_water', options);
}

export async function fetchRestroomPoints(options: FetchOptions = {}): Promise<PublicAmenityPoint[]> {
  return fetchAmenity('restroom', options);
}


