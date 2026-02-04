import { computed, reactive, type ComputedRef, type Ref } from 'vue';
import { TextMatcher } from '../utils/textMatcher';

export type QsoSortOrder = 'asc' | 'desc';

export interface QsoFilterState {
  searchText: string;
  selectedBand: string;
  selectedMode: string;
  selectedQslStatus: string;
  dateFrom: string;
  dateTo: string;
  useRegex: boolean;
  useWildcard: boolean;
  caseSensitive: boolean;
}

export interface QsoListOptions<T> {
  items: Ref<T[]> | ComputedRef<T[]>;
  getCallsign: (item: T) => string;
  getBand: (item: T) => string | undefined;
  getMode: (item: T) => string | undefined;
  getDateTime: (item: T) => string | Date | undefined;
  getSequence?: (item: T) => number | string | undefined;
  getQslStatus?: (item: T) => string | undefined;
  getSearchText?: (item: T) => string[];
  defaultSortKey?: string;
}

export const createDefaultQsoFilters = (): QsoFilterState => ({
  searchText: '',
  selectedBand: '',
  selectedMode: '',
  selectedQslStatus: '',
  dateFrom: '',
  dateTo: '',
  useRegex: false,
  useWildcard: false,
  caseSensitive: false,
});

export const useQsoListFilters = <T>(options: QsoListOptions<T>) => {
  const filters = reactive<QsoFilterState>(createDefaultQsoFilters());
  const sortKey = reactive({ value: options.defaultSortKey || 'datetime' });
  const sortOrder = reactive<{ value: QsoSortOrder }>({ value: 'desc' });

  const regexError = computed(() => {
    return filters.useRegex && !TextMatcher.isValidRegex(filters.searchText);
  });

  const filteredItems = computed(() => {
    let filtered = [...options.items.value].filter(Boolean);

    if (filters.searchText.trim()) {
      const matchOptions = {
        useRegex: filters.useRegex,
        useWildcard: filters.useWildcard,
        caseSensitive: filters.caseSensitive,
      };

      if (filters.useRegex && regexError.value) {
        return filtered;
      }

      filtered = filtered.filter(item => {
        const searchValues = [
          options.getCallsign(item),
          ...(options.getSearchText ? options.getSearchText(item) : []),
        ];
        return searchValues.some(value =>
          TextMatcher.matches(value || '', filters.searchText, matchOptions)
        );
      });
    }

    if (filters.selectedBand) {
      filtered = filtered.filter(item => options.getBand(item) === filters.selectedBand);
    }

    if (filters.selectedMode) {
      filtered = filtered.filter(item => options.getMode(item) === filters.selectedMode);
    }

    if (filters.selectedQslStatus && options.getQslStatus) {
      filtered = filtered.filter(
        item => (options.getQslStatus?.(item) || 'N') === filters.selectedQslStatus
      );
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(item => {
        const dateVal = options.getDateTime(item);
        if (!dateVal) return false;
        return new Date(dateVal) >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const dateVal = options.getDateTime(item);
        if (!dateVal) return false;
        return new Date(dateVal) <= toDate;
      });
    }

    return filtered;
  });

  const sortedItems = computed(() => {
    const key = sortKey.value;
    const order = sortOrder.value === 'asc' ? 1 : -1;
    const getValue = (item: T) => {
      switch (key) {
        case 'sequence': {
          const seq = options.getSequence ? options.getSequence(item) : undefined;
          const numeric = Number(seq);
          return Number.isFinite(numeric) ? numeric : 0;
        }
        case 'callsign':
          return options.getCallsign(item) || '';
        case 'band':
          return options.getBand(item) || '';
        case 'mode':
          return options.getMode(item) || '';
        case 'qslStatus':
          return options.getQslStatus ? options.getQslStatus(item) || 'N' : 'N';
        case 'datetime':
        default: {
          const dateVal = options.getDateTime(item);
          if (!dateVal) return 0;
          return new Date(dateVal).getTime();
        }
      }
    };

    return [...filteredItems.value].sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      if (aVal === bVal) return 0;
      return aVal > bVal ? order : -order;
    });
  });

  const bands = computed(() => {
    const set = new Set<string>();
    options.items.value.forEach(item => {
      const band = options.getBand(item);
      if (band) set.add(band);
    });
    return Array.from(set).sort();
  });

  const modes = computed(() => {
    const set = new Set<string>();
    options.items.value.forEach(item => {
      const mode = options.getMode(item);
      if (mode) set.add(mode);
    });
    return Array.from(set).sort();
  });

  const sortBy = (key: string) => {
    if (sortKey.value === key) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey.value = key;
      sortOrder.value = 'asc';
    }
  };

  return {
    filters,
    sortKey,
    sortOrder,
    regexError,
    filteredItems,
    sortedItems,
    bands,
    modes,
    sortBy,
  };
};
