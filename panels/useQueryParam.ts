import { useState, useEffect } from "react";

export interface Data {
  hosts: string[];
  search?: string;
  queryID: string | null;
  tz?: string;
  firstSeen?: boolean;
  sortBy?: string;
}

export function useQueryParam() {
  const [data, setData] = useState<Data>();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setData({
      hosts: searchParams.getAll('var-host'),
      search: searchParams.has('search') ? searchParams.get('search')! : undefined,
      tz: searchParams.has('tz') ? searchParams.get('tz')! : undefined,
      firstSeen: searchParams.has('first_seen') ? Boolean(JSON.parse(searchParams.get('first_seen')!)) : undefined,
      sortBy: searchParams.has('sort_by') ? searchParams.get('sort_by')! : undefined,
      queryID: searchParams.get('queryID')
    })
  }, [])

  return data;
}

export function setQueryParam(kv: {[key: string]: string}) {
  const params = new URLSearchParams(window.location.search);
  for (const k in kv) {
    params.set(k, kv[k]);
  }
  window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
}
