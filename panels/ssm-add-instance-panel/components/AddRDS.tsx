import React, { useEffect, useState } from "react";
import { Stack, InlineFieldRow, InlineField, Input, Button, TextLink, Switch, Text, Spinner } from "@grafana/ui";
import { ElementProps } from "panels/types";

interface RDSCredentials {
  accessKeyID: string;
  secretAccessKey: string;
}

interface MySQLCredentials {
  username?: string;
  password?: string;
}

interface RDSNode {
  name: string;
  region: string;
}

interface RDSService {
  address: string;
  port: number;
  engine: string;
  engine_version: string;
}

interface RDSInstance {
  node: RDSNode;
  service: RDSService;
}

export const AddRDS: React.FC<ElementProps> = () => {
  const [rdsCredentials, setRDSCredentials] = useState<RDSCredentials>({ accessKeyID: '', secretAccessKey: '' });
  const [rdsInstances, setRDSInstances] = useState<RDSInstance[]>();
  const [mysqlCredentials, setMySQLCredentials] = useState<MySQLCredentials>({});
  const [isDiscoving, setIsDiscoving] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [registeredNames, setRegisteredNames] = useState<string[]>();
  const [activeInstance, setActiveInstance] = useState<number>();

  useEffect(() => {
    discover();
    getRegistered();
  }, [])

  function discover() {
    setIsDiscoving(true);
    setRDSInstances(undefined);
    const data = {
      aws_access_key_id: rdsCredentials.accessKeyID,
      aws_secret_access_key: rdsCredentials.secretAccessKey
    };
    fetch(`/managed/v0/rds/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(res => {
        setRDSInstances(res['instances'] as RDSInstance[]);
      })
      .finally(()=>setIsDiscoving(false));
  }

  function getRegistered() {
    fetch(`/managed/v0/rds`)
      .then(res => res.json())
      .then(res => {
        setRegisteredNames((res['instances'] as RDSInstance[] || []).map(instance=>instance.node.name+':'+instance.node.region));
      })
  }

  async function onConnect(instance: RDSInstance) {
    const data = {
      aws_access_key_id: rdsCredentials.accessKeyID,
      aws_secret_access_key: rdsCredentials.secretAccessKey,
      id: { name: instance.node.name, region: instance.node.region },
      password: mysqlCredentials.password || '',
      username: mysqlCredentials.username || ''
    };
    setIsConnecting(true);
    let ok = false;
    await fetch(`/managed/v0/rds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })
      .then(res => {
        if (!res.ok) {
          throw res;
        }
        return res.json();
      })
      .then(res => {
        ok = true;
      })
      .finally(()=>setIsConnecting(false));
    if (ok) { await getRegistered(); changeActiveInstance(-1); }
  }

  function changeActiveInstance(index: number) {
    setActiveInstance(index);
    setMySQLCredentials({});
    setIsConnecting(false);
  }

  function isEnabled(rdsInstance: RDSInstance): boolean {
    return registeredNames !== undefined && registeredNames.indexOf(rdsInstance.node.name + ':' + rdsInstance.node.region) > -1;
  }

  async function disable(node: RDSNode): Promise<{}> {
    const body = {id: {name: node.name, region: node.region}};
    return await fetch(`/managed/v0/rds`, {
      method: 'DELETE',
      body: JSON.stringify(body)
    });
  }

  async function disableInstanceMonitoring(node: RDSNode) {
    const text = `Are you sure want to disable monitoring of '${node.name}:${node.region}' node?`;
    if (confirm(text)) {
      await disable(node);
      await getRegistered();
    }
  }

  return (
    <Stack width='100%' maxWidth='900px' direction='column' alignItems='center'>
      <Text element='h1'>Amazon RDS Credentials</Text>
      <div style={{width: '100%'}}>
        <InlineFieldRow width='100%'>
          <InlineField grow>
            <Input
              value={rdsCredentials.accessKeyID}
              required
              placeholder='AMAZON_RDS_ACCESS_KEY_ID'
              onChange={e => {
                setRDSCredentials({ ...rdsCredentials, accessKeyID: e.currentTarget.value });
              }}
            />
          </InlineField>
          <InlineField grow>
            <Input
              value={rdsCredentials.secretAccessKey}
              required
              placeholder='AMAZON_RDS_SECRET_ACCESS_KEY'
              onChange={e => {
                setRDSCredentials({ ...rdsCredentials, secretAccessKey: e.currentTarget.value });
              }}
              type='password'
            />
          </InlineField>
          <InlineField><Button onClick={()=>discover()}>Discover</Button></InlineField>
        </InlineFieldRow>
      </div>
      <Stack width='100%' justifyContent='end'>
        <TextLink href="https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/amazon-rds.md#creating-an-iam-user-with-permission-to-access-amazon-rds-db-instances" external>
          Where do I get the security credentials for my Amazon RDS DB instance?
        </TextLink>
      </Stack>
      {isDiscoving
        ? <Stack width='100%' justifyContent='center'>
            <Spinner size='xxl' />
          </Stack>
        : rdsInstances && registeredNames &&
          <Stack direction='column' width='100%' alignItems='center' gap={1}>
            <Text element='h1'>Amazon RDS Instances</Text>
            <table width='100%'>
              <thead>
                <tr style={{height: '49px', borderBottom: '1px solid'}}>
                  <th>Name</th>
                  <th>Region</th>
                  <th>Endpoint</th>
                  <th>Engine</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rdsInstances.map((rdsInstance, i) => <>
                  <tr style={{height: '49px', borderBottom: '1px solid'}}>
                    <td scope="row">{rdsInstance.node.name}</td>
                    <td>{rdsInstance.node.region}</td>
                    <td>{rdsInstance.service.address}:{rdsInstance.service.port}</td>
                    <td>{rdsInstance.service.engine} v{rdsInstance.service.engine_version}</td>
                    <td align="center">
                      <Switch value={isEnabled(rdsInstance)} onChange={e=> e.currentTarget.checked ? changeActiveInstance(i) : disableInstanceMonitoring(rdsInstance.node)} />
                    </td>
                  </tr>
                  {activeInstance === i &&
                    <tr style={{height: '72px'}}>
                      <td colSpan={5}>
                        <InlineFieldRow>
                          <InlineField grow>
                            <Input
                              value={mysqlCredentials.username}
                              type="text" placeholder="MySQL Username"
                              onChange={e => { setMySQLCredentials({...mysqlCredentials, username: e.currentTarget.value}) }}
                            />
                          </InlineField>
                          <InlineField grow>
                            <Input
                              value={mysqlCredentials.password}
                              type="password" placeholder="MySQL Password"
                              onChange={e => { setMySQLCredentials({...mysqlCredentials, password: e.currentTarget.value}) }}
                            />
                          </InlineField>
                          <InlineField><Button variant='primary' disabled={isConnecting} icon={isConnecting ? 'spinner' : undefined} onClick={() => {onConnect(rdsInstance)}}>{isConnecting ? '' : 'Connect'}</Button></InlineField>
                          <InlineField><Button variant='secondary' onClick={() => changeActiveInstance(-1)}>Cancel</Button></InlineField>
                        </InlineFieldRow>
                      </td>
                    </tr>
                  }
                </>)}
              </tbody>
            </table>
          </Stack>
      }
    </Stack>
  );
}