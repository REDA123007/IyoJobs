import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createApi, type Api } from "./client";

const ApiContext = createContext<Api | null>(null);

/** Lets tests (and later staging builds) inject a specific API client. */
export function ApiProvider({ api, children }: { api?: Api; children: ReactNode }) {
  const value = useMemo(() => api ?? createApi(), [api]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used inside <ApiProvider>");
  return api;
}
