import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { formattedValueToString, getValueFormat, PanelProps } from '@grafana/data';
import { Alert, Box, Button, Checkbox, Collapse, Combobox, IconButton, InlineLabel, Input, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';
import { AgentDefaults, AgentLog, AgentStatus, QanSettingsOptions } from '../types';
import { useInstance } from '../../useInstance';
import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import { useRDS } from 'panels/useRDS';

interface Props extends PanelProps<QanSettingsOptions> { }

const DEFAULT_LOG_PERIOD = 12 * 60 * 60; // 12 hours in seconds
const LOG_PERIODS = [{
  label: '1h',
  value: 1 * 60 * 60
}, {
  label: '2h',
  value: 2 * 60 * 60
}, {
  label: '6h',
  value: 6 * 60 * 60
}, {
  label: '12h',
  value: DEFAULT_LOG_PERIOD
}, {
  label: '1d',
  value: 24 * 60 * 60
}, {
  label: '5d',
  value: 5 * 24 * 60 * 60
}]

const getStyles = () => {
  return {
    td: css`
      padding: 4px 8px;
    `,
    th: css`
      padding: 4px 8px;
    `
  }
}

export const QanSettingsPanel: React.FC<Props> = ({ replaceVariables }) => {
  const styles = useStyles2(getStyles);
  const domRef = useRef<HTMLDivElement | null>(null);

  const [settings, setSettings] = useState<AgentDefaults>();
  const [status, setStatus] = useState<Partial<AgentStatus>>();
  const [logs, setLogs] = useState<AgentLog[]>();
  const [logPeriod, setLogPeriod] = useState<number>(DEFAULT_LOG_PERIOD);

  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isSettingsApplying, setisSettingsApplying] = useState(false);
  const [statusLoadedAt, setStatusLoadedAt] = useState<Date>();
  const [statusIntervalID, setStatusIntervalID] = useState<NodeJS.Timeout>();
  const [statusLoadedStr, setStatusLoadedStr] = useState<string>();
  const [logLoadedAt, setLogLoadedAt] = useState<Date>();
  const [logIntervalID, setLogIntervalID] = useState<NodeJS.Timeout>();
  const [logLoadedStr, setLogLoadedStr] = useState<string>();

  const [settingsError, setSettingsError] = useState('');
  const [applySettingsAlert, setApplySettingsAlert] = useState<ReactNode>();
  const [statusError, setStatusError] = useState('');
  const [logError, setLogError] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isLogOpen, setIsLogOpen] = useState(true);

  const [collectInterval, setCollectInterval] = useState<number>(1);
  const [showQueryExample, setShowQueryExample] = useState<boolean>();
  const [collectFrom, setCollectFrom] = useState<string>();
  const [filterOmit, setFilterOmit] = useState<string>();

  const instanceData = useInstance(replaceVariables);
  const rdsData = useRDS();

  function calculatePanelHeight() {
    const panel = domRef.current?.closest('[class$="panel-container"]') as HTMLElement;
    const h = domRef.current?.scrollHeight || 346;
    const panelHeight = h + 64;

    if (panel?.offsetHeight === panelHeight) { return; }

    if (panel) { panel!.style.height = `${panelHeight}px`; }
  };

  function getAgentDefaults(agentUUID: string, instanceUUID: string) {
    fetch(`/qan-api/agents/${agentUUID}/cmd`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AgentUUID: agentUUID,
        Service: 'agent',
        Cmd: 'GetDefaults',
        Data: btoa(JSON.stringify({ UUID: instanceUUID }))
      })
    })
      .then(res => res.json())
      .then(res => {
        if (res.Error) { throw res.Error; }
        return JSON.parse(atob(res['Data']));
      })
      .then((res: AgentDefaults) => {
        setSettings(res);
        setCollectFrom(res.qan?.CollectFrom  === 'rds-slowlog' ? 'slowlog' : res.qan?.CollectFrom);
        res.qan?.Interval !== undefined && setCollectInterval(res.qan.Interval / 60);
        setShowQueryExample(res.qan?.ExampleQueries);
        res.qan?.FilterOmit !== undefined && setFilterOmit(res.qan?.FilterOmit?.join(','));
      })
      .catch(err=>{
        setSettingsError(err);
      })
      .finally(()=>{
        setIsSettingsLoaded(true);
      })
  }

  function getAgentStatus(agentUUID: string) {
    fetch(`/qan-api/agents/${agentUUID}/status`)
      .then(res => res.json())
      .then((res: AgentStatus) => {
        if (res.Error) {
          setStatusError(res.Error);
        } else {
          setStatus(res);
        }
      })
      .catch(err=>{
        setStatusError(err);
      })
      .finally(()=>{
        setStatusLoadedAt(new Date());
      })
  }

  function getAgentLog(agentUUID: string, begin: string, end: string) {
      fetch(`/qan-api/agents/${agentUUID}/log?begin=${begin}&end=${end}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then((res: AgentLog[]) => {
          setLogs(res);
        })
        .catch(err=>{
          setLogError(err);
        })
        .finally(()=>{
          setLogLoadedAt(new Date());
        })
  }

  function getLogTimeRange(): [string, string] {
    const end = new Date();
    const begin = new Date(end);
    begin.setUTCSeconds(begin.getUTCSeconds() - logPeriod);
    return [begin.toISOString().split('.')[0], end.toISOString().split('.')[0]];
  }

  useEffect(() => {
    if (instanceData?.instance === undefined) { return; }

    const agentUUID = instanceData?.instance?.Agent?.UUID;
    const instanceUUID = instanceData?.instance?.UUID;
    if (agentUUID !== undefined && instanceUUID !== undefined){
      setIsSettingsLoaded(true);
      setSettings(undefined);
      setSettingsError('');
      getAgentDefaults(agentUUID, instanceUUID);
    }
    reloadStatus();
    reloadLog();
  }, [instanceData?.instance]);

  useEffect(() => {
    calculatePanelHeight();
  }, [isSettingsLoaded, statusLoadedAt, logLoadedAt, isSettingsOpen, isStatusOpen, isLogOpen]);

  useEffect(()=>{
    statusIntervalID && clearInterval(statusIntervalID);
    setStatusIntervalID(setInterval(()=>{
      statusLoadedAt && setStatusLoadedStr(formatDistanceToNow(statusLoadedAt, {addSuffix: true}));
    }, 60000));
  }, [statusLoadedAt]);

  useEffect(()=>{
    logIntervalID && clearInterval(logIntervalID);
    setLogIntervalID(setInterval(()=>{
      logLoadedAt && setLogLoadedStr(formatDistanceToNow(logLoadedAt, {addSuffix: true}));
    }, 60000));
  }, [statusLoadedAt]);

  function reloadStatus() {
    const agentUUID = instanceData?.instance?.Agent?.UUID;
    if (agentUUID === undefined) { return; }
    setStatusLoadedAt(undefined);
    setStatus(undefined);
    setStatusError('');
    getAgentStatus(agentUUID);
  }

  function reloadLog() {
    const agentUUID = instanceData?.instance?.Agent?.UUID;
    if (agentUUID === undefined) { return; }
    const [begin, end] = getLogTimeRange();
    setLogLoadedAt(undefined);
    setLogs(undefined);
    getAgentLog(agentUUID, begin, end);
  }

  function applySettings() {
    const agentUUID = instanceData?.instance?.Agent?.UUID;
    const instanceUUID = instanceData?.instance?.UUID;
    if (agentUUID === undefined || instanceUUID === undefined) { return; }
    setisSettingsApplying(true);
    setApplySettingsAlert(undefined);
    fetch(`/qan-api/agents/${agentUUID}/cmd`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AgentUUID: agentUUID,
        Service: 'qan',
        Cmd: 'RestartTool',
        Data: btoa(JSON.stringify({
          UUID: instanceUUID,
          Interval: collectInterval * 60,
          ExampleQueries: showQueryExample,
          CollectFrom: collectFrom === 'slowlog' && isRDS() ? 'rds-slowlog' : collectFrom,
          FilterOmit: filterOmit?.trim().split(',') || []
        }))
      })
    })
      .then(res => {
        if (!res.ok) { throw new Error(); }
        return res.json();
      })
      .then(()=>{
        setApplySettingsAlert(<Text element='p' color='success'>Your settings have been applied</Text>);
      })
      .catch(()=>{
        setApplySettingsAlert(<Text color='error' element='p'>Failed to apply settings</Text>);
      })
      .finally(()=>setisSettingsApplying(false));
  }

  function isRDS(): boolean {
    return rdsData?.instances?.some(inst => inst.agent.qan_db_instance_uuid === instanceData?.instance?.UUID) || false;
  }

  useEffect(()=>{
    setApplySettingsAlert(undefined);
  }, [collectInterval, collectFrom, showQueryExample, filterOmit])

  useEffect(()=>{
    reloadLog();
  }, [logPeriod])

  return (
    <div ref={domRef}>
      {instanceData?.instance &&
        <Collapse
          collapsible
          label={<Text element='h4'>Settings</Text>}
          isOpen={isSettingsOpen}
          onToggle={isOpen => setIsSettingsOpen(isOpen)}
          loading={!isSettingsLoaded}
        >
          {isSettingsLoaded &&
            (
              settingsError
                ? <Stack direction='row' justifyContent='center'>
                    <Stack minWidth='40%' maxWidth='80%'><Alert title='' security='error'>{ settingsError }</Alert></Stack>
                  </Stack>
                : (
                    <Stack direction='row' gap={3} wrap>
                      <Stack grow={1} direction='column'>
                        <Stack direction='row'>
                          <Box flex='0 0 30%'><Text element='p' textAlignment='right'>DSN:</Text></Box>
                          <Box flex='0 0 70%'><Text element='p'>{instanceData?.instance.DSN.split('/?')[0]}</Text></Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 30%'><Text element='p' textAlignment='right'>Version:</Text></Box>
                          <Box flex='0 0 70%'><Text element='p'>{instanceData?.instance.Version + ' ' + instanceData?.instance.Distro}</Text></Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 30%'><Text element='p' textAlignment='right'>Collect interval:</Text></Box>
                          <Stack direction='column' flex='0 0 70%'>
                            <Stack>
                              <Input type='number' min={1} max={60} value={collectInterval} onChange={e=>setCollectInterval(parseInt(e.currentTarget.value))} />
                              <InlineLabel width='auto'>minutes (from 1 to 60)</InlineLabel>
                            </Stack>
                            <Stack>
                              <Checkbox label='Send real query examples' value={showQueryExample} onChange={e=>setShowQueryExample(e.currentTarget.checked)} />
                            </Stack>
                          </Stack>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 30%'><Text element='p' textAlignment='right'>Collect from:</Text></Box>
                          <Box flex='0 0 70%'>
                            <Combobox
                              value={collectFrom}
                              options={[
                                {
                                  label: 'Slow log',
                                  value: 'slowlog'
                                },
                                {
                                  label: 'Performance Schema',
                                  value: 'perfschema'
                                }
                              ]}
                              onChange={option=>setCollectFrom(option.value)}
                            />
                          </Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 30%'><Text element='p' textAlignment='right'>Filter omit:</Text></Box>
                          <Box flex='0 0 70%'><Input type='text' placeholder='Queries to omit, split by comma' value={filterOmit} /></Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 30%'></Box>
                          <Box flex='0 0 70%'>
                            <Stack direction='row' justifyContent='space-between' alignItems='center'>
                              <Button variant='secondary' icon={isSettingsApplying ? 'spinner' : 'check'} disabled={isSettingsApplying} onClick={()=>applySettings()}>{isSettingsApplying ? '' : 'Apply'}</Button>
                              {applySettingsAlert}
                            </Stack>
                          </Box>
                        </Stack>
                      </Stack>
                      <Stack grow={1} direction='column' rowGap={2}>
                        <Text element='h1'>Slow Log Configuration</Text>
                        <Stack direction='row'>
                          <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Long query time:</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.LongQueryTime !== undefined ? settings.qan.LongQueryTime.toString() : ''}</Text></Box>
                          <Box flex='0 0 30%'><Text variant='bodySmall'>seconds</Text></Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Max slow log size:</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.MaxSlowLogSize !== undefined ? formattedValueToString(getValueFormat('bytes')(settings.qan.MaxSlowLogSize)) : ''}</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>0 = no max</Text></Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Slow log rotation:</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.SlowLogRotation ? 'ON' : 'OFF'}</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>{''}</Text></Box>
                        </Stack>
                        <Stack direction='row'>
                          <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Slow logs to retain on disk:</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.RetainSlowLogs !== undefined ? settings.qan.RetainSlowLogs : 'N/A'}</Text></Box>
                          <Box flex='0 0 30%'><Text element='p'>{''}</Text></Box>
                        </Stack>
                        {(instanceData?.instance.Distro.toLowerCase().indexOf('percona') !== -1
                          || !instanceData?.instance.Version.startsWith('5.5'))
                          && (
                            <>
                              <Stack direction='row'>
                                <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Slow log verbosity:</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.LogSlowVerbosity !== undefined ? settings.qan.LogSlowVerbosity : ''}</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{''}</Text></Box>
                              </Stack>
                              <Stack direction='row'>
                                <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Rate limit:</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.LogSlowRateLimit !== undefined ? settings.qan.LogSlowRateLimit : ''}</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>0 and 1 = disabled</Text></Box>
                              </Stack>
                              <Stack direction='row'>
                                <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Log slow admin statements:</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.LogSlowAdminStatements ? 'ON' : 'OFF'}</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{''}</Text></Box>
                              </Stack>
                              <Stack direction='row'>
                                <Box flex='0 0 40%'><Text element='p' textAlignment='right'>Log slow slave statements:</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{settings?.qan?.LogSlowSlaveStatements ? 'ON' : 'OFF'}</Text></Box>
                                <Box flex='0 0 30%'><Text element='p'>{''}</Text></Box>
                              </Stack>
                            </>
                          )
                        }
                      </Stack>
                    </Stack>
                  )
            )
          }
        </Collapse>
      }
      <Collapse
        collapsible
        label={
          <Stack direction='row'>
            <Text element='h4'>Status</Text>
            {statusLoadedAt && <Text element='p'>{' (Updated ' + (statusLoadedStr !== undefined ? statusLoadedStr : formatDistanceToNow(statusLoadedAt, {addSuffix: true})) + ')'}</Text>}
            <IconButton hidden={statusLoadedAt === undefined} name='sync' tooltip='Reload status' onClickCapture={e=>{e.preventDefault(); e.stopPropagation(); reloadStatus();}} />
          </Stack>
        }
        isOpen={isStatusOpen}
        onToggle={isOpen => setIsStatusOpen(isOpen)}
        loading={statusLoadedAt === undefined}
      >
        {statusLoadedAt &&
          (
            statusError
              ? <Stack direction='row' justifyContent='center'>
                  <Stack minWidth='40%' maxWidth='80%'><Alert title='' security='error'>{ statusError }</Alert></Stack>
                </Stack>
              : <table border={1}>
                  {status && Object.keys(status).map((k)=>(
                    <tr>
                      <td className={styles.td}>{k}</td>
                      <td className={styles.td}>{status[k as keyof AgentStatus]}</td>
                    </tr>
                  ))}
                </table>
          )
        }
      </Collapse>
      <Collapse
        collapsible
        label={
          <Stack direction='row'>
            <Text element='h4'>Log</Text>
            {logLoadedAt && <Text element='p'>{' (Updated ' + (logLoadedStr !== undefined ? logLoadedStr : formatDistanceToNow(logLoadedAt, {addSuffix: true})) + ')'}</Text>}
            {logLoadedAt &&
              <RadioButtonGroup size='sm' value={logPeriod} options={LOG_PERIODS} onChange={v=>{setLogPeriod(v); setIsLogOpen(true);}} />
            }
            <IconButton hidden={logLoadedAt === undefined} name='sync' size='md' tooltip='Reload logs' onClick={e=>{e.preventDefault(); e.stopPropagation(); reloadLog()}} />
          </Stack>
        }
        isOpen={isLogOpen}
        onToggle={isOpen => setIsLogOpen(isOpen)}
        loading={logLoadedAt === undefined}
      >
        {logLoadedAt &&
          (logError
            ? <Stack direction='row' justifyContent='center'>
                <Stack minWidth='40%' maxWidth='80%'><Alert title='' security='error'>{ logError }</Alert></Stack>
              </Stack>
            : <table border={1} cellPadding={1} style={{minWidth: '100%'}}>
                <thead className={styles.th}>
                  <tr>
                    <th className={styles.th}>Timestamp</th>
                    <th className={styles.th}>Service</th>
                    <th className={styles.th}>Level</th>
                    <th className={styles.th}>Msg</th>
                  </tr>
                </thead>
                <tbody>
                  {logs && logs.map(log=>(
                    <tr>
                      <td className={styles.td}>{log.Ts}</td>
                      <td className={styles.td}>{log.Service}</td>
                      <td className={styles.td}>{log.Level}</td>
                      <td className={styles.td}>{log.Msg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          )
        }
      </Collapse>
    </div>
  );
}
