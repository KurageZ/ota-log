import { useEffect, useState } from 'react';

/**
 * 返回 `value` 的防抖副本：仅在 `value` 停止变化 `delayMs` 毫秒后才更新。
 * 用于把高频输入（如搜索框逐键输入）与下游开销（DB 查询、URL 重写）解耦。
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
