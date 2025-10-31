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

  const endpoint = `${SF_CRIME_ENDPOINT}?${params.toString()}`;

  const performFetch = async (withToken: boolean) => {
    const headers = withToken && token ? { 'X-App-Token': token } : undefined;
    return fetch(endpoint, { headers });
  };

  let response = await performFetch(Boolean(token));

  if (response.status === 403 && token) {
    console.warn('SFGov responded 403 with provided token, retrying without token to confirm.');
    response = await performFetch(false);
  }

  if (!response.ok) {
    const detail = response.status === 403
      ? 'Access denied. Check whether the Socrata App Token is valid and has not been revoked.'
      : `HTTP ${response.status}`;
    throw new Error(`Failed to fetch crime data: ${detail}`);
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

