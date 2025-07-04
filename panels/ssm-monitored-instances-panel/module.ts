import { PanelPlugin } from '@grafana/data';
import { MonitoredInstancesOptions } from './types';
import { MonitoredInstancesPanel } from './components/MonitoredInstances';

export const plugin = new PanelPlugin<MonitoredInstancesOptions>(MonitoredInstancesPanel).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      path: 'key',
      name: 'The key used to filter rows',
      description: 'The key used to filter rows',
      defaultValue: 'schema',
    });
});
