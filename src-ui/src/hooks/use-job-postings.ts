import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  JobPostingCreate,
  JobPostingUpdate,
  ScrapeRequest,
  ParseRequest,
} from '@/types/api';
import * as api from '@/services/api';

export function useJobPostings() {
  return useQuery({
    queryKey: ['job-postings'],
    queryFn: () => api.getJobPostings(),
  });
}

export function useJobPosting(id: string) {
  return useQuery({
    queryKey: ['job-postings', id],
    queryFn: () => api.getJobPosting(id),
    enabled: !!id,
  });
}

export function useCreateJobPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JobPostingCreate) => api.createJobPosting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

export function useUpdateJobPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobPostingUpdate }) =>
      api.updateJobPosting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

export function useDeleteJobPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJobPosting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

export function useScrapeJobPosting() {
  return useMutation({
    mutationFn: (data: ScrapeRequest) => api.scrapeJobPosting(data),
  });
}

export function useParseJobPosting() {
  return useMutation({
    mutationFn: (data: ParseRequest) => api.parseJobPosting(data),
  });
}
