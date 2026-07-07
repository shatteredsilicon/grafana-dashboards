import { useState, useEffect } from "react";
import { InterpolateFunction } from "@grafana/data";
import _ from "lodash";

export enum Subsystem {
  MySQL = "mysql",
  MongoDB = "mongo",
  PostgreSQL = "postgresql"
}

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
  Disconnected: boolean;
  Agent?: Instance | null;
}

export interface Data {
  instances: Instance[]
  mysqlInstances: Instance[]
  mongodbInstances: Instance[]
  postgresqlInstances: Instance[]
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
          (i: Instance) => i.Subsystem === Subsystem.MySQL || i.Subsystem === Subsystem.MongoDB || i.Subsystem === Subsystem.PostgreSQL
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

        const filteredInstances = instances.filter(inst => Array.isArray(hosts) ? hosts.includes(inst.Name) : inst.Name === hosts).map(inst => { return { ...inst, Agent: agentsByParentUUID[inst.ParentUUID] } })
        setData({
          instances: filteredInstances,
          mysqlInstances: filteredInstances.filter(inst => inst.Subsystem === Subsystem.MySQL),
          mongodbInstances: filteredInstances.filter(inst => inst.Subsystem === Subsystem.MongoDB),
          postgresqlInstances: filteredInstances.filter(inst => inst.Subsystem === Subsystem.PostgreSQL),
          isAllSelected: (Array.isArray(hosts) ? hosts.includes('All') : hosts === 'All') || false,
          isNotExistSelected: !filteredInstances.length && hosts.length > 0
        });
      })
      .catch(err => console.log(err))
      .finally(()=>{ setPrevHosts(hosts); });
  }, [hosts]);

  return data;
}
