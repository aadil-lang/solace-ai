import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { BackendHealthResponse } from '@/types';

export const BACKEND_HEALTH_QUERY_KEY = ['backend', 'health'];

/**
 * Custom TanStack Query hook for monitoring backend connectivity
 */
export function useBackendHealth() {
  const storeHealth = useAppStore((state) => state.checkBackendHealth);
  const status = useAppStore((state) => state.connectionStatus);
  const healthData = useAppStore((state) => state.healthData);
  const errorMessage = useAppStore((state) => state.errorMessage);

  const query = useQuery<BackendHealthResponse, Error>({
    queryKey: BACKEND_HEALTH_QUERY_KEY,
    queryFn: () => apiService.checkHealth(),
    enabled: false, // Triggered manually or by user action
    retry: 1,
  });

  return {
    ...query,
    storeStatus: status,
    storeHealthData: healthData,
    storeErrorMessage: errorMessage,
    checkHealth: storeHealth,
  };
}

