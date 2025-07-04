import React, { useEffect, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { Text, Card, Icon } from '@grafana/ui';
import { AddInstanceOptions, InstanceType } from '../types';
import { AddRDS } from './AddRDS';
import { AddMySQL } from './AddMySQL';
import { AddPostgreSQL } from './AddPostgreSQL';
import { setDynamicPanelHeight } from 'panels/utils';
import { AddSNMP } from './AddSNMP';

interface Props extends PanelProps<AddInstanceOptions> { }

export const AddInstancePanel: React.FC<Props> = ({ options, data, width, height }) => {
  const domRef = useRef<HTMLDivElement | null>(null);

  const [activeID, setActiveID] = useState<InstanceType>();

  useEffect(() => {
    setDynamicPanelHeight(domRef);
  }, [activeID]);

  function renderForm(id: InstanceType) {
    switch (id) {
      case InstanceType.rds:
        return <AddRDS onSizeChange={()=>setDynamicPanelHeight(domRef)} />;
      case InstanceType.postgresql:
        return <AddPostgreSQL onSizeChange={()=>setDynamicPanelHeight(domRef)} />;
      case InstanceType.mysql:
        return <AddMySQL onSizeChange={()=>setDynamicPanelHeight(domRef)} />;
      case InstanceType.snmp:
        return <AddSNMP onSizeChange={()=>setDynamicPanelHeight(domRef)} />;
      default:
        return <></>
    }
  }

  return (
    <div ref={domRef} style={{ width: width, height: height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      {activeID
        ? renderForm(activeID)
        : <>
          <Text element='h1'>How to Add an Instance</Text>
          <ul style={{ display: 'grid', listStyle: 'none' }}>
            <li>
              <Card id={InstanceType.rds} onClick={e => setActiveID(InstanceType.rds)}>
                <Card.Description>
                  <Icon name='edit' />&nbsp;Add an Amazon RDS MySQL or Aurora MySQL Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card id={InstanceType.postgresql} onClick={e => setActiveID(InstanceType.postgresql)}>
                <Card.Description>
                  <Icon name='edit' />&nbsp;Add a Remote PostgreSQL Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card id={InstanceType.mysql} onClick={e => setActiveID(InstanceType.mysql)}>
                <Card.Description>
                  <Icon name='edit' />&nbsp;Add a Remote MySQL Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card id={InstanceType.snmp} onClick={e => setActiveID(InstanceType.snmp)}>
                <Card.Description>
                  <Icon name='edit' />&nbsp;Add a Remote SNMP Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card href='https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/ssm-admin.md#adding-mysql-query-analytics-service'>
                <Card.Description>
                  <Icon name='link' />&nbsp;How to add a MySQL Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card href='https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/ssm-admin.md#adding-mongodb-query-analytics-service'>
                <Card.Description>
                  <Icon name='link' />&nbsp;How to add a MongoDB Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card href='https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/ssm-admin.md#adding-general-system-metrics-service'>
                <Card.Description>
                  <Icon name='link' />&nbsp;How to add a Linux Instance
                </Card.Description>
              </Card>
            </li>
            <li>
              <Card href='https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/conf-postgres.md'>
                <Card.Description>
                  <Icon name='link' />&nbsp;How to add a PostgreSQL Instance
                </Card.Description>
              </Card>
            </li>
          </ul>
        </>
      }
    </div>
  );
}
