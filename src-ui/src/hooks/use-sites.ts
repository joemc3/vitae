import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PortfolioGenerateRequest, TargetedGenerateRequest } from '@/types/api';
import * as api from '@/services/api';

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: () => api.getSites(),
  });
}

export function useSitesPolling() {
  const query = useSites();
  const hasActiveJobs = query.data?.some(
    (s) => s.status === 'queued' || s.status === 'processing'
  );

  return useQuery({
    queryKey: ['sites'],
    queryFn: () => api.getSites(),
    refetchInterval: hasActiveJobs ? 3000 : false,
  });
}

export function useGeneratePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PortfolioGenerateRequest) => api.generatePortfolio(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useGenerateTargeted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TargetedGenerateRequest) => api.generateTargeted(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}
