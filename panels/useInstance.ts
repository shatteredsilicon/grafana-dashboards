import { useState, useEffect } from "react";
import { InterpolateFunction } from "@grafana/data";
import _ from "lodash";

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

export function useInstance(replaceVariables: InterpolateFunction) {
  const [data, setData] = useState<Data>();
  const [prevHosts, setPrevHosts] = useState<string[] | string>();

  const instancesURL = '/qan-api/instances?deleted=no';
  const rawHosts = replaceVariables('$host', undefined, 'json');
  const hosts: string[] | string = JSON.parse(rawHosts.startsWith('"') || rawHosts.startsWith('[') ? rawHosts : `"${rawHosts}"`);

  useEffect(() => {
    if (_.isEqual(prevHosts, hosts)) { return; }

    fetch(instancesURL)
      .then(res => res.json())
      .then((response: any) => {
        const agents = response.filter(
          (i: Instance) => i.Subsystem === 'agent'
        ) as Instance[];

        const instances = (response.filter(
          (i: Instance) => i.Subsystem === 'mysql' || i.Subsystem === 'mongo' || i.Subsystem === 'postgresql'
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

        const filteredInstances = Array.isArray(hosts) ? hosts.map(host => instanceMap[host])?.filter(i => i !== undefined) : [instanceMap[hosts]].filter(i => i !== undefined);
        setData({
          instance: filteredInstances?.[0],
          instances: filteredInstances,
          instanceMap,
          isAllSelected: (Array.isArray(hosts) ? hosts.includes('All') : hosts === 'All') || false,
          isNotExistSelected: !filteredInstances.length && hosts.length > 0
        });
      })
      .catch(err => console.log(err))
      .finally(()=>{ setPrevHosts(hosts); });
  }, [hosts]);

  return data;
}
