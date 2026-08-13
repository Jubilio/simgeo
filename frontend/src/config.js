const configuredApiUrl =
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';

export const API_BASE_URL = configuredApiUrl.endsWith('/')
  ? configuredApiUrl
  : `${configuredApiUrl}/`;
