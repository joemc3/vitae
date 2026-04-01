import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfileData } from '@/types/api';
import * as api from '@/services/api';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(),
    retry: (failureCount, error) => {
      if ((error as { response?: { status: number } })?.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function usePatchProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProfileData>) => api.patchProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useReplaceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileData) => api.replaceProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
