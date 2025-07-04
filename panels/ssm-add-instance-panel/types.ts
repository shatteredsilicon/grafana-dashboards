export interface AddInstanceOptions { }

export enum InstanceType {
  rds = 'rds',
  mysql = 'mysql',
  postgresql = 'postgresql',
  snmp = 'snmp'
}

export interface Instance {
  address: string;
  name?: string;
  port?: number;
}

export interface RemoteInstance extends Instance {
  username: string;
  password: string;
}
