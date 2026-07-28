import { useEffect, useState } from "react";
import type { Observable } from "@nozbe/watermelondb/utils/rx";

/** Subscribes to a WatermelonDB (rxjs) Observable and re-renders on each emission. */
export function useObservable<T>(factory: () => Observable<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const subscription = factory().subscribe((v: T) => setValue(v));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
