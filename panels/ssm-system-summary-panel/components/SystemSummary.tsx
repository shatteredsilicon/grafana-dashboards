import React, { useState, useEffect, useRef } from 'react';
import { PanelProps } from '@grafana/data';
import { Alert, Button, Collapse, Icon, Stack, TextLink } from '@grafana/ui';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { SystemSummaryOptions } from '../types';
import { ToolReport } from 'panels/types';
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
        fetch(`/managed/v0/nodes/${instanceData?.instances[i].Name}/tool-report?type=pt-summary`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        })
          .then(res => {
            if (res.ok) return res.json();
            throw new Error(res.statusText);
          })
          .then((res: ToolReport) => {
            if (res === undefined || Object.keys(res).length === 0) throw new Error("There is no system summary for this instance");

            let report = res.payload.replace(/\\n/g, '\n');
            report = report.replace(/\\t/g, '\t');
            return report.slice(1, -1);
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

      fetch(`/managed/v0/nodes/${instanceData?.instances[i].Name}/tool-report?type=${instanceData.instances[i].Subsystem === Subsystem.MySQL ? 'pt-mysql-summary' : 'pt-mongodb-summary'}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error(res.statusText)
        })
        .then((res: ToolReport) => {
          if (res === undefined || Object.keys(res).length === 0) throw new Error(`There is no ${instanceData.instances[i].Subsystem} summary for this instance`);

          let report = res.payload.replace(/\\n/g, '\n');
          report = report.replace(/\\t/g, '\t');
          return report.slice(1, -1);
        })
        .then(res => instanceData.instances[i].Subsystem === Subsystem.MySQL ? setMySQLSummary(res) : setMongoSummary(res))
        .catch(err => instanceData.instances[i].Subsystem === Subsystem.MySQL ? setMySQLSummaryError(err.message) : setMongoSummaryError(err.message))
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
        {instanceData?.instances.length
          ? <Collapse collapsible label='System Summary' isOpen={isServerSummaryOpen} onToggle={toggleServerSummaryOpen}>
              {isServerSummaryLoaded
                ? (
                    serverSummaryError
                      ? <Alert title='' security='error'>{ serverSummaryError }</Alert>
                      : <pre>{ serverSummary }</pre>
                  )
                : <Icon name="fa fa-spinner" />
              }
            </Collapse>
          : <></>
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
