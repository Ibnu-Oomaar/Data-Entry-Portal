import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/services/api';

/** Class → section classification with student counts (drives every class/section filter). */
export function useStructure() {
  return useQuery({ queryKey: ['structure'], queryFn: studentsApi.structure, staleTime: 60_000 });
}
