"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Serverda va gidratsiya paytida false, brauzerda keyin true. setState-in-effect'siz. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
