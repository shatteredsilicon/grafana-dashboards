import React, { useState, useEffect } from 'react';
import { PanelProps } from '@grafana/data';
import { Badge, Text, Stack, Spinner, IconButton } from '@grafana/ui';
import { UpdateOptions } from '../types';

interface Props extends PanelProps<UpdateOptions> { }

export const UpdatePanel: React.FC<Props> = ({ options, data, width, height }) => {
  const [isCurrentVersionLoaded, setIsCurrentVersionLoaded] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>();
  const [currentReleaseDate, setCurrentReleaseDate] = useState<Date>();
  const [isLatestVersionLoaded, setIsLatestVersionLoaded] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string>();
  const [latestReleaseDate, setLatestReleaseDate] = useState<Date>();
  const [latestCheckDate, setLatestCheckDate] = useState<Date>();
  const [updateNeeded, setUpdateNeeded] = useState<boolean>();

  useEffect(() => {
    loadCurrentVersion();
    loadLatestVersion();
  }, []);

  async function loadCurrentVersion() {
    fetch('/configurator/v1/version')
      .then(res => res.json())
      .then(res => {
        setCurrentVersion(res['version']);
        res['release_date'] && setCurrentReleaseDate((new Date(res['release_date'])));
      })
      .catch()
      .finally(()=>{setIsCurrentVersionLoaded(true)});
  }

  async function loadLatestVersion() {
    fetch('/configurator/v1/check-update')
      .then(res => res.json())
      .then(res => {
        setLatestVersion(res['version']);
        res['release_date'] && setLatestReleaseDate((new Date(res['release_date'])));
        setUpdateNeeded(res['update_needed'] || false);
      })
      .catch()
      .finally(()=>{
        setLatestCheckDate(new Date());
        setIsLatestVersionLoaded(true);
      });
  }

  function syncLatestVersion() {
    setIsLatestVersionLoaded(false);
    loadLatestVersion();
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%', gap: '4px'}}>
      <Text element='h2'>Updates</Text>
      {isCurrentVersionLoaded &&
        <Stack direction='row' alignItems='center'>
          <Text element='span'>Current version:&nbsp;</Text>
          <Badge text={`${currentVersion}` + (currentReleaseDate !== undefined ? ' ' + currentReleaseDate.toLocaleString('en-US', {year: 'numeric', month: 'long', day: 'numeric' }) : '') } color='blue' />
        </Stack>
      }
      {isCurrentVersionLoaded && isLatestVersionLoaded
        ? <Stack direction='column' justifyContent='space-between' grow={1}>
            {latestVersion
              ? <Stack direction='column'>
                  {
                    updateNeeded
                      ? <Stack direction='row' alignItems='center'>
                          <Text element='span'>Available version:&nbsp;</Text>
                          <Badge text={`${latestVersion}` + (latestReleaseDate !== undefined ? ' ' + latestReleaseDate.toLocaleString('en-US', {year: 'numeric', month: 'long', day: 'numeric' }) : '') } color='green' />
                        </Stack>
                      : <Stack direction='row' alignItems='center' justifyContent='center' grow={1}>
                          <div style={{boxSizing: 'border-box', border: '2px solid #292929'}}>
                            You are up to date
                          </div>
                        </Stack>
                  }
                </Stack>
              : <div style={{boxSizing: 'border-box', border: '2px solid #292929', display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center'}}>
                  {`Couldn't confirm what the latest version is`}
                </div>
            }
            <Stack direction='row' justifyContent='space-between'>
              <Text element='span'>Last check:&nbsp;{latestCheckDate?.toLocaleString('en-US', {hour12: true, hour: 'numeric', minute: '2-digit', year: undefined, month: 'long', day: 'numeric'})}</Text>
              <IconButton name='sync' tooltip='Check latest version' size='md' onClick={syncLatestVersion} />
            </Stack>
          </Stack>
        : <Stack direction='row' justifyContent='center' alignItems='center' grow={1}>
            <Spinner size='xl' />
          </Stack>
      }
    </div>
  );
}
