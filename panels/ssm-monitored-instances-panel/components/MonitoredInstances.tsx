import React, { useEffect, useRef, useState } from 'react';
import { DataFrame, Field, FieldConfig, FieldType, PanelProps } from '@grafana/data';
import { IconButton, Icon, Stack, Table, TableCellDisplayMode, TableCustomCellOptions, TableFieldOptions, Tooltip, useTheme2, Text, TextLink } from '@grafana/ui';
import { HealthAlertsState, InstanceServiceState, MonitoredInstancesOptions, NodeInstance } from '../types';
import { setDynamicPanelHeight } from 'panels/utils';
import { cloneDeep } from "lodash";

import { Switch } from './Switch';

interface Props extends PanelProps<MonitoredInstancesOptions> { }

export const MonitoredInstancesPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const domRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme2();

  const [instances, setInstances] = useState<NodeInstance[]>();

  function removeInstance(index: number) {
    const nodeName = instances?.[index].name;
    const text = `Are you sure you want to delete ${nodeName}? This will delete all services and data of ${nodeName}?`;
    if (confirm(text)) {
      fetch(`/managed/v0/nodes/${nodeName}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })
        .then(res => res.ok && instances?.splice(index, 1) && setInstances([...instances]));
    }
  }

  function removeService(index: number, node: string) {
    const instance = instances?.find(f => f.name === node);
    const service = instance?.services[index];
    const text = `Are you sure you want to delete ${service?.type} of ${node}?`;
    if (confirm(text)) {
      fetch(`/managed/v0/nodes/${node}/services`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: service?.id,
          type: service?.type
        })
      })
        .then(res => res.ok && instance?.services.splice(index, 1) && setInstances([...(instances || [])]));
    }
  }

  function switchHealthAlerts(index: number, enabled: boolean) {
    const text = `Deleting the health alerts will also delete any changes that may have been manually made to it. Aure you sure?`;
    if (!enabled && !confirm(text)) {
      return;
    }

    fetch(`/managed/v0/nodes/${instances?.[index].name}/health-alerts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enabled: enabled
      })
    })
      .then(res => {
        if (res.ok) {
          instances![index].health_alerts_state = enabled ? HealthAlertsState.Enabled : HealthAlertsState.NotEnabled;
          setInstances([...(instances || [])]);
        }
      });
  }

  const nameCellOpts: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: props => {
      const value = props.value as { name: string; link?: string; state?: number };
      return (
        <Stack direction='row' alignItems='center' height='100%'>
          {value.link
            ? <TextLink href={value.link} inline>{value.name}</TextLink>
            : <Text element='h6'>{value.name}</Text>
          }
          <Tooltip content={value.state === InstanceServiceState.Active ? 'active' : 'inactive'}>
            <div style={{
              minWidth: '8px',
              minHeight: '8px',
              borderRadius: '50%',
              backgroundColor:  value.state === InstanceServiceState.Active ? theme.colors.success.shade : theme.colors.warning.shade
            }}></div>
          </Tooltip>
        </Stack>
      );
    }
  }

  const healthAlertCellOpts: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: props => {
      return (
        <Stack direction='row' alignItems='center' height='100%'>
          {props.value === HealthAlertsState.PartiallyEnabled
              ? <>
                  <Switch
                    value={!!props.value}
                    onChange={e=>switchHealthAlerts(props.rowIndex, e.currentTarget.checked)}
                    color={theme.colors.warning}
                  />
                  <Tooltip placement='top' content='One or more health alerts are not enabled, consider re-trigger the switch to enable them'>
                    <Icon name='question-circle' />
                  </Tooltip>
                </>
              : <Switch
                  value={!!props.value}
                  onChange={e=>switchHealthAlerts(props.rowIndex, e.currentTarget.checked)}
                />
          }
        </Stack>
      );
    }
  }

  const removeInstanceCellOpts: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: props => {
      return (
        <IconButton
          name='trash-alt'
          size='md'
          tooltip='remove this instance'
          onClick={()=>removeInstance(props.rowIndex)}
        />
      );
    }
  }

  interface ServiceRemoveCellValue {
    node: string;
  }

  const removeServiceCellOpts: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: props => {
      return (
        <IconButton
          name='trash-alt'
          size='md'
          tooltip='remove this service'
          onClick={()=>removeService(props.rowIndex, (props.value as ServiceRemoveCellValue).node)}
        />
      );
    }
  }

  const defaultInstanceFrame: DataFrame = {
    fields: [{
      name: 'Name',
      type: FieldType.other,
      config: {
        custom: {
          cellOptions: nameCellOpts
        }
      } as FieldConfig<TableFieldOptions>,
      values: [],
      display: () => ({
        text: '',
        numeric: 0
      })
    } as Field<string>, {
      name: 'Services',
      type: FieldType.number,
      config: {},
      values: [],
      display: (value) => ({
        text: String(value),
        numeric: value
      })
    } as Field<number>, {
      name: 'Health Alerts',
      type: FieldType.other,
      config: {
        custom: {
          cellOptions: healthAlertCellOpts
        }
      } as FieldConfig<TableFieldOptions>,
      values: [],
      display: () => ({
        text: '',
        numeric: 0
      })
    } as Field<boolean>, {
      name: 'Remove',
      type: FieldType.other,
      config: {
        custom: {
          cellOptions: removeInstanceCellOpts
        }
      } as FieldConfig<TableFieldOptions>,
      values: [],
      display: () => ({
        text: '',
        numeric: 0
      })
    }, {
      name: 'nested',
      type: FieldType.nestedFrames,
      config: {},
      values: [],
    } as Field<DataFrame[]>],
    length: 0
  }

  const defaultServiceFrame: DataFrame = {
    fields: [{
      name: 'Name',
      type: FieldType.other,
      config: {
        custom: {
          cellOptions: nameCellOpts
        }
      } as FieldConfig<TableFieldOptions>,
      values: [],
      display: () => ({
        text: '',
        numeric: 0
      })
    } as Field<string>, {
      name: 'Endpoint',
      type: FieldType.string,
      config: {},
      values: [],
      display: (value) => ({
        text: value,
        numeric: 0
      })
    } as Field<string>, {
      name: 'Region',
      type: FieldType.string,
      config: {},
      values: [],
      display: (value) => ({
        text: value,
        numeric: 0
      })
    } as Field<string>, {
      name: 'Engine',
      type: FieldType.string,
      config: {},
      values: [],
      display: (value) => ({
        text: value,
        numeric: 0
      })
    } as Field<string>, {
      name: 'Remove',
      type: FieldType.other,
      config: {
        custom: {
          cellOptions: removeServiceCellOpts
        }
      } as FieldConfig<TableFieldOptions>,
      values: [],
      display: () => ({
        text: '',
        numeric: 0
      })
    } as Field<ServiceRemoveCellValue>],
    length: 0
  }
  
  useEffect(()=>{
    fetch(`/managed/v0/nodes`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then(res => {
        setInstances(res['instances'] as NodeInstance[] || []);
      });
  }, [])

  useEffect(() => {
    setDynamicPanelHeight(domRef);
  }, [instances]);

  return (
    <div ref={domRef} style={{width: width, height: height, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'space-between'}}>
      <Table
        width={width}
        height={height}
        data={instances?.reduce((acc, instance) => {
          acc.fields.find(f => f.name === 'Name')?.values.push({ name: instance.name, state: instance.services.findIndex(s => s.state === InstanceServiceState.Active) !== -1 ? InstanceServiceState.Active : InstanceServiceState.Inactive });
          acc.fields.find(f => f.name === 'Services')?.values.push(instance.services.length);
          acc.fields.find(f => f.name === 'Health Alerts')?.values.push(instance.health_alerts_state);
          acc.fields.find(f => f.name === 'Remove')?.values.push(null);
          const serviceFrame: DataFrame = cloneDeep(defaultServiceFrame);
          for (let i = 0; i < instance.services.length; i++) {
            serviceFrame.fields.find(f => f.name === 'Name')?.values.push({
              name: instance.services[i].type,
              state: instance.services[i].state,
              link: ((instanceName: string, typ: string)=>{
                const query = `var-host=${instanceName}&$__url_time_range`;
                const qanURL = `/graph/d/ssm-qan/ssm-query-analytics?${query}`;
                switch (typ) {
                  case 'linux:metrics':
                  case 'node_exporter':
                  case 'rds_exporter':
                    return `/graph/d/ssm-system-overview/system-overview?${query}`
                  case 'mysql:metrics':
                  case 'mysqld_exporter':
                    return `/graph/d/ssm-mysql-overview/mysql-overview?${query}`
                  case 'mongodb:metrics':
                  case 'mongodb_exporter':
                    return `/graph/d/ssm-mongodb-overview/mongodb-overview?${query}`
                  case 'postgresql:metrics':
                  case 'postgres_exporter':
                    return `/graph/d/ssm-postgresql-overview/postgresql-overview?${query}`
                  case 'proxysql:metrics':
                    return `/graph/d/ssm-proxysql-overview/proxysql-overview?${query}`
                  case 'mysql:queries':
                  case 'mongodb:queries':
                  case 'postgresql:queries':
                    return qanURL
                }
                if (typ.includes('qan-agent')) {
                  return qanURL
                }
                return undefined
              })(instance.name, instance.services[i].type)
            });
            serviceFrame.fields.find(f => f.name === 'Endpoint')?.values.push(instance.services[i].address + (instance.services[i].port ? ':' + instance.services[i].port : ''));
            serviceFrame.fields.find(f => f.name === 'Region')?.values.push(instance.services[i].region);
            serviceFrame.fields.find(f => f.name === 'Engine')?.values.push(instance.services[i].engine + ' ' + instance.services[i].engine_version);
            serviceFrame.fields.find(f => f.name === 'Remove')?.values.push({node: instance.name});
            serviceFrame.length += 1;
          }
          acc.fields.find(f => f.name === 'nested')?.values.push([serviceFrame]);
          acc.length += 1;
          return acc;
        }, cloneDeep(defaultInstanceFrame)) || defaultInstanceFrame}
      />
    </div>
  );
}
