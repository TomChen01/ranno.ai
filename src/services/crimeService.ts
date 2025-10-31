// src/services/crimeService.ts

export type CrimePoint = {
  id: string;
  latitude: number;
  longitude: number;
  category?: string;
  occurredAt?: string;
};

const SF_CRIME_ENDPOINT = 'https://data.sfgov.org/resource/wg3w-h783.json';

export type CrimeQueryOptions = {
  limit?: number;
  since?: string;
};

const DEFAULT_LIMIT = 800;

export async function fetchCrimePoints(options: CrimeQueryOptions = {}): Promise<CrimePoint[]> {
  const { limit = DEFAULT_LIMIT, since } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $order: 'incident_datetime DESC',
  });

  if (since) {
    params.set('incident_datetime', since);
  }

  const token = import.meta.env.VITE_SFGOV_APP_TOKEN;

  const response = await fetch(`${SF_CRIME_ENDPOINT}?${params.toString()}`, {
    headers: token ? { 'X-App-Token': token } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch crime data: ${response.status}`);
  }

  const raw = (await response.json()) as Array<{
    incident_id?: string;
    incident_category?: string;
    incident_datetime?: string;
    latitude?: string;
    longitude?: string;
  }>;

  return raw
    .filter((item) => item.latitude && item.longitude)
    .map((item, index) => ({
      id: item.incident_id ?? `crime-${index}`,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      category: item.incident_category,
      occurredAt: item.incident_datetime,
    }));
}

