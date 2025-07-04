import React, { useEffect, useRef, useState } from 'react';
import { DataFrame, Field, FieldConfig, FieldType, PanelProps } from '@grafana/data';
import { IconButton, Switch, Table, TableCellDisplayMode, TableCustomCellOptions, TableFieldOptions } from '@grafana/ui';
import { MonitoredInstancesOptions, NodeInstance } from '../types';
import { setDynamicPanelHeight } from 'panels/utils';
import { cloneDeep } from "lodash";

interface Props extends PanelProps<MonitoredInstancesOptions> { }

export const MonitoredInstancesPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const domRef = useRef<HTMLDivElement | null>(null);

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
          instances![index].health_alerts_enabled = enabled;
          setInstances([...(instances || [])]);
        }
      });
  }

  const healthAlertCellOpts: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: props => {
      return <Switch value={props.value as boolean} onChange={e=>switchHealthAlerts(props.rowIndex, e.currentTarget.checked)} />;
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
      type: FieldType.string,
      config: {},
      values: [],
      display: (value) => ({
        text: value,
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
      type: FieldType.string,
      config: {},
      values: [],
      display: (value) => ({
        text: value,
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
          acc.fields.find(f => f.name === 'Name')?.values.push(instance.name);
          acc.fields.find(f => f.name === 'Services')?.values.push(instance.services.length);
          acc.fields.find(f => f.name === 'Health Alerts')?.values.push(instance.health_alerts_enabled);
          acc.fields.find(f => f.name === 'Remove')?.values.push(null);
          const serviceFrame: DataFrame = cloneDeep(defaultServiceFrame);
          for (let i = 0; i < instance.services.length; i++) {
            serviceFrame.fields.find(f => f.name === 'Name')?.values.push(instance.services[i].type);
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
