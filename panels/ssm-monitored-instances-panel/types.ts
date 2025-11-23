export interface MonitoredInstancesOptions {};

export interface RemoteInstanceCredentials {
  address: string;
  name: string;
  port: string;
  username: string;
  password: string;
  snmpVersion: string;
  snmpSecurityLevel: string;
  snmpAuthProtocol: string;
  snmpPrivProtocol: string;
  snmpPrivPassword: string;
  snmpContext: string;
  snmpCommunity: string;
}

export interface NodeInstanceService {
  id: number
  type: string;
  region: string;
  address?: string;
  port?: number;
  engine: string;
  engine_version: string;
}

export enum HealthAlertsState {
  NotEnabled,
  Enabled,
  PartiallyEnabled
}

export interface NodeInstance {
  name: string;
  services: NodeInstanceService[];
  health_alerts_state: number;
}
