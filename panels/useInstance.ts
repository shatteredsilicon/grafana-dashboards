import { useState, useEffect } from "react";
import { useQueryParam } from './useQueryParam';

export interface Instance {
  Created: string;
  DSN: string;
  Deleted: string;
  Distro: string;
  Id: number;
  Name: string;
  ParentUUID: string;
  Subsystem: string;
  UUID: string;
  Version: string;
  Agent?: Instance | null;
}

export interface Data {
  instance: Instance | undefined
  instances: Instance[]
  instanceMap: { [key: string]: Instance }
  isAllSelected: boolean
  isNotExistSelected: boolean
}

export function useInstance() {
  const [data, setData] = useState<Data>();

  const instancesURL = '/qan-api/instances?deleted=no';
  const queryParams = useQueryParam();

  useEffect(() => {
    if (queryParams?.hosts === undefined) { return; }

    fetch(instancesURL)
      .then(res => res.json())
      .then((response: any) => {
        const agents = response.filter(
          (i: Instance) => i.Subsystem === 'agent'
        ) as Instance[];

        const instances = (response.filter(
          (i: Instance) => i.Subsystem === 'mysql' || i.Subsystem === 'mongo'
        ) as Instance[]);

        const agentsByParentUUID: { [key: string]: Instance } = {};
        for (const agent of agents) {
          agentsByParentUUID[agent.ParentUUID] = agent;
        }

        const instanceMap: { [key: string]: Instance } = {};
        for (const inst of instances) {
          instanceMap[inst.Name] = inst;
          instanceMap[inst.Name].Agent = agentsByParentUUID[inst.ParentUUID];
        }

        setData({
          instance: queryParams?.hosts.map(host => instanceMap[host])?.[0],
          instances,
          instanceMap,
          isAllSelected: queryParams?.hosts.includes('All') || false,
          isNotExistSelected: queryParams?.hosts.map(host => instanceMap[host])?.[0] === undefined && queryParams?.hosts.length !== undefined && queryParams?.hosts.length > 0
        });
      })
      .catch(err => console.log(err));
  }, [queryParams?.hosts])

  return data;
}
