import React, { useState, useEffect, useRef } from 'react';
import { PanelProps } from '@grafana/data';
import { Alert, Button, Collapse, Icon, Stack, TextLink } from '@grafana/ui';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { SystemSummaryOptions } from '../types';
import { Subsystem, useInstance } from '../../useInstance';

interface Props extends PanelProps<SystemSummaryOptions> { }

export const SystemSummaryPanel: React.FC<Props> = ({ replaceVariables }) => {
  const domRef = useRef<HTMLDivElement | null>(null);

  const [isMySQLSummaryLoaded, setIsMySQLSummaryLoaded] = useState(false);
  const [isMongoSummaryLoaded, setIsMongoSummaryLoaded] = useState(false);
  const [isServerSummaryLoaded, setIsServerSummaryLoaded] = useState(false);

  const [serverSummary, setServerSummary] = useState('');
  const [mysqlSummary, setMySQLSummary] = useState('');
  const [mongoSummary, setMongoSummary] = useState('');

  const [serverSummaryError, setServerSummaryError] = useState('');
  const [mysqlSummaryError, setMySQLSummaryError] = useState('');
  const [mongoSummaryError, setMongoSummaryError] = useState('');

  const [isServerSummaryOpen, setIsServerSummaryOpen] = useState(true);
  const [isMySQLSummaryOpen, setIsMySQLSummaryOpen] = useState(true);
  const [isMongoSummaryOpen, setIsMongoSummaryOpen] = useState(true);

  const instanceData = useInstance(replaceVariables);

  function downloadSummary() {
    const date = (new Date()).toISOString().split('.')[0];
    const filename = `ssm-${instanceData?.instances?.[0].Name}-${date}-summary.zip`;
    const zip = new JSZip();
    zip.file('system_summary.txt', serverSummary);
    if (mysqlSummary.length > 0) {
      zip.file('mysql_server_summary.txt', mysqlSummary);
    }
    if (mongoSummary.length > 0) {
      zip.file('mongodb_server_summary.txt', mongoSummary);
    }
    zip.generateAsync({ type: 'blob' })
      .then(function (content: Blob) {
        // see FileSaver.js
        saveAs(content, filename);
      });
  }

  function toggleServerSummaryOpen(isOpen: boolean) {
    setIsServerSummaryOpen(isOpen);
  }

  function toggleMySQLSummaryOpen(isOpen: boolean) {
    setIsMySQLSummaryOpen(isOpen);
  }

  function toggleMongoSummaryOpen(isOpen: boolean) {
    setIsMongoSummaryOpen(isOpen);
  }

  function calculatePanelHeight() {
    const panel = domRef.current?.closest('[class$="panel-container"]') as HTMLElement;
    const h = domRef.current?.scrollHeight || 346;
    const panelHeight = h + 64;

    if (panel?.offsetHeight === panelHeight) { return; }

    if (panel) { panel!.style.height = `${panelHeight}px`; }
  };

  useEffect(() => {
    if (!instanceData?.instances.length) { return; }

    setIsServerSummaryLoaded(false);
    setIsMySQLSummaryLoaded(false);
    setIsMongoSummaryLoaded(false);

    for (let i = 0; i < instanceData.instances.length; i++) {
      if (i == 0) {
        fetch(`/qan-api/agents/${instanceData?.instances[i].Agent?.UUID}/cmd`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            AgentUUID: instanceData?.instances[i].Agent?.UUID,
            Service: 'query',
            Cmd: 'Summary',
            Data: btoa(JSON.stringify({ UUID: instanceData.instances[i].ParentUUID }))
          })
        })
          .then(res => res.json())
          .then(res => {
            if (!res['Error']) {
              return res;
            }
            let err = res['Error'];
            if (res['Error']?.includes('Executable file not found in $PATH')) {
              err = ' - Please install `pt-summary`.';
            }

            throw new Error(err);
          })
          .then(res => {
            let str = window.atob(res['Data']);
            str = str.replace(/\\n/g, '\n');
            str = str.replace(/\\t/g, '\t');
            return str.slice(1, -1);
          })
          .then(res => setServerSummary(res))
          .catch(err => setServerSummaryError(err.message))
          .finally(() => {
            setIsServerSummaryLoaded(true);
          });
      }

      if (![Subsystem.MySQL as string, Subsystem.MongoDB as string].includes(instanceData.instances[i].Subsystem)) {
        continue;
      }

      fetch(`/qan-api/agents/${instanceData?.instances[i].Agent?.UUID}/cmd`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          AgentUUID: instanceData?.instances[i].Agent?.UUID,
          Service: 'query',
          Cmd: 'Summary',
          Data: btoa(JSON.stringify({ UUID: instanceData.instances[i].UUID }))
        })
      })
        .then(res => res.json())
        .then(res => {
          if (!res['Error']) {
            return res;
          }
          let err = res['Error'];
          if (res['Error']?.includes('Executable file not found in $PATH')) {
              err = ` - Please install ${instanceData.instances[i].Subsystem === Subsystem.MySQL ? '`pt-mysql-summary`' : '`pt-mongodb-summary`'}.`;
          }
          if (res['Error'] === 'Unknown command: Summary') {
              err = ' - Please update your `ssm-client`.';
          }

          throw new Error(err);
        })
        .then(res => {
          let str = window.atob(res['Data']);
          str = str.replace(/\\n/g, '\n');
          str = str.replace(/\\t/g, '\t');
          return str.slice(1, -1);
        })
        .then(res => instanceData.instances[i].Subsystem === Subsystem.MySQL ? setMySQLSummary(res) : setMongoSummary(res))
        .catch(err => instanceData.instances[i].Subsystem === Subsystem.MySQL ? setMySQLSummaryError(err) : setMongoSummaryError(err.message))
        .finally(() => {
          instanceData.instances[i].Subsystem === Subsystem.MySQL ? setIsMySQLSummaryLoaded(true) : setIsMongoSummaryLoaded(true);
        });
    }
  }, [instanceData?.instances]);

  useEffect(() => {
    calculatePanelHeight();
  }, [isServerSummaryLoaded, isMySQLSummaryLoaded, isMongoSummaryLoaded, isServerSummaryOpen, isMySQLSummaryOpen, isMongoSummaryOpen]);

  return (
    <div ref={domRef}>
      {
        (isMySQLSummaryLoaded || isMongoSummaryLoaded || isServerSummaryLoaded) &&
        <div style={{marginBottom: '8px'}}>
          <Stack direction='row' justifyContent='center'>
            <Button onClick={downloadSummary} size='md' fill='solid' icon='file-download' variant='secondary'>
              Download Summary
            </Button>
          </Stack>
        </div>
      }
      {
        instanceData?.isAllSelected &&
        <Alert title='' severity='error'>Host name of All is not valid, please click the Host dropdown and select a valid host.</Alert>
      }
      {
        !instanceData?.isAllSelected && instanceData?.isNotExistSelected &&
        <Alert title='' severity='error'>Host name is not valid, please click the Host dropdown and select a valid host. If the Host list is empty, use
          <code>ssm-admin add</code> to add a monitoring service and check again. For more information on how to add a monitoring service,
          consult&nbsp;
          <TextLink href="https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/ssm-admin.md#adding-monitoring-services" inline external>
            SSM documentation.
          </TextLink>
        </Alert>
      }
        {instanceData?.instances.length &&
          <Collapse collapsible label='System Summary' isOpen={isServerSummaryOpen} onToggle={toggleServerSummaryOpen}>
            {isServerSummaryLoaded
              ? (
                  serverSummaryError
                    ? <Alert title='' security='error'>{ serverSummaryError }</Alert>
                    : <pre>{ serverSummary }</pre>
                )
              : <Icon name="fa fa-spinner" />
            }
          </Collapse>
        }
        {instanceData?.instances.findIndex(inst => inst.Subsystem === Subsystem.MySQL) !== -1 &&
          <Collapse collapsible label='MySQL Summary' isOpen={isMySQLSummaryOpen} onToggle={toggleMySQLSummaryOpen}>
            {isMySQLSummaryLoaded
              ? (
                  mysqlSummaryError
                    ? <Alert title='' security='error'>{ mysqlSummaryError }</Alert>
                    : <pre>{ mysqlSummary }</pre>
                )
              : <Icon name="fa fa-spinner" />
            }
          </Collapse>
        }
        {instanceData?.instances.findIndex(inst => inst.Subsystem === Subsystem.MongoDB) !== -1 &&
          <Collapse collapsible label='MongoDB Summary' isOpen={isMongoSummaryOpen} onToggle={toggleMongoSummaryOpen}>
            {isMongoSummaryLoaded
              ? (
                  mongoSummaryError
                    ? <Alert title='' security='error'>{ mongoSummaryError }</Alert>
                    : <pre>{ mongoSummary }</pre>
                )
              : <Icon name="fa fa-spinner" />
            }
          </Collapse>
        }
    </div>
  );
}
