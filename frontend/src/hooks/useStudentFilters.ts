import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListStatus, StudentQuery, StudentSortField } from '@/types/api';

export interface StudentFilters {
  classLevel?: number;
  section?: string;
  status?: ListStatus;
  search: string;
  sortBy: StudentSortField;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface FilterDefaults {
  sortBy: StudentSortField;
  sortDir: 'asc' | 'desc';
  pageSize: number;
}

const SORTS: StudentSortField[] = ['classSection', 'studentId', 'name', 'classLevel', 'section', 'totalMarks', 'status', 'updatedAt'];
const STATUSES: ListStatus[] = ['pending', 'draft', 'submitted'];

/**
 * Filter / sort / page state lives in the URL, so it survives reloads, the back button and sharing a link
 * ("Class 1, section B, not started" is just a URL).
 */
export function useStudentFilters(defaults: FilterDefaults) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<StudentFilters>(() => {
    const cls = Number(params.get('class'));
    const sec = (params.get('section') ?? '').toUpperCase();
    const status = params.get('status') as ListStatus | null;
    const sort = params.get('sort') as StudentSortField | null;
    const dir = params.get('dir');
    const page = Number(params.get('page'));
    const size = Number(params.get('size'));
    return {
      classLevel: Number.isInteger(cls) && cls > 0 ? cls : undefined,
      section: /^[A-Z]$/.test(sec) ? sec : undefined,
      status: status && STATUSES.includes(status) ? status : undefined,
      search: params.get('q') ?? '',
      sortBy: sort && SORTS.includes(sort) ? sort : defaults.sortBy,
      sortDir: dir === 'asc' || dir === 'desc' ? dir : defaults.sortDir,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: [25, 50, 100, 200].includes(size) ? size : defaults.pageSize,
    };
  }, [params, defaults.sortBy, defaults.sortDir, defaults.pageSize]);

  const update = useCallback(
    (patch: Partial<StudentFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const set = (key: string, value: string | number | undefined, fallback?: string | number) => {
            if (value === undefined || value === '' || value === fallback) next.delete(key);
            else next.set(key, String(value));
          };
          if ('classLevel' in patch) set('class', patch.classLevel);
          if ('section' in patch) set('section', patch.section);
          if ('status' in patch) set('status', patch.status);
          if ('search' in patch) set('q', patch.search?.trim());
          if ('sortBy' in patch) set('sort', patch.sortBy, defaults.sortBy);
          if ('sortDir' in patch) set('dir', patch.sortDir, defaults.sortDir);
          if ('pageSize' in patch) set('size', patch.pageSize, defaults.pageSize);
          if ('classLevel' in patch || 'section' in patch) next.delete('student');
          // Changing anything except the page itself starts again from page 1.
          if ('page' in patch) set('page', patch.page, 1);
          else next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults.sortBy, defaults.sortDir, defaults.pageSize],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams();
        const student = prev.get('student');
        if (student) next.set('student', student);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const query: StudentQuery = useMemo(
    () => ({
      classLevel: filters.classLevel,
      section: filters.section,
      status: filters.status,
      search: filters.search.trim() || undefined,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    [filters],
  );

  const isFiltered = !!(filters.classLevel || filters.section || filters.status || filters.search.trim());
  return { filters, query, update, reset, isFiltered };
}
