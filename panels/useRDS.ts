import { useState, useEffect } from "react";

export interface RDSNode {
  name: string;
  region: string;
}

export interface RDSService {
  address: string;
  port: number;
  engine: string;
  engine_version: string;
}

export interface RDSAgent {
  qan_db_instance_uuid: string;
}
export interface RDSInstance {
  node: RDSNode;
  service: RDSService;
  agent: RDSAgent;
}

export interface Data {
  instances?: RDSInstance[];
}

export function useRDS() {
  const [data, setData] = useState<Data>();

  const rdsURL = '/managed/v0/rds';

  useEffect(() => {
    fetch(rdsURL)
      .then(res => res.json())
      .then((data: Data) => {
        setData(data);
      })
      .catch(err => console.log(err));
  }, [])

  return data;
}
