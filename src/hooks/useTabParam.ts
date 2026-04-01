'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Syncs a tab/state value with a URL search parameter.
 * On mount, reads from URL; on change, updates URL without scroll.
 */
export function useTabParam<T extends string>(
  key: string,
  defaultValue: T,
): [T, (val: T) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const raw = searchParams.get(key);
  const value = (raw as T) || defaultValue;

  const setValue = useCallback(
    (val: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    },
    [searchParams, pathname, router, key, defaultValue],
  );

  return [value, setValue];
}
