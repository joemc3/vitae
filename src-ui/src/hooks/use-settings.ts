import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  APIKeySaveRequest,
  ModelSelectRequest,
  TestConnectionRequest,
} from '@/types/api';
import * as api from '@/services/api';

const PROVIDERS = ['anthropic', 'openai', 'gemini', 'openrouter'] as const;

export function useApiKeyStatuses() {
  return useQuery({
    queryKey: ['api-key-statuses'],
    queryFn: async () => {
      const results = await Promise.all(
        PROVIDERS.map((p) =>
          api.getApiKeyStatus(p).catch(() => ({
            provider: p,
            is_set: false,
            selected_model: null,
          }))
        )
      );
      return results;
    },
  });
}

export function useModels(provider: string) {
  return useQuery({
    queryKey: ['models', provider],
    queryFn: () => api.getModels(provider),
    enabled: !!provider,
  });
}

export function useSaveApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: APIKeySaveRequest) => api.saveApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-key-statuses'] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.deleteApiKey(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-key-statuses'] });
    },
  });
}

export function useSelectModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      data,
    }: {
      provider: string;
      data: ModelSelectRequest;
    }) => api.selectModel(provider, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-key-statuses'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (data: TestConnectionRequest) => api.testConnection(data),
  });
}
