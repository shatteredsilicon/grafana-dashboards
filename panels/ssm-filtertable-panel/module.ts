import { PanelPlugin } from '@grafana/data';
import { FilterTableOptions } from './types';
import { FilterTablePanel } from './components/FilterTable';

export const plugin = new PanelPlugin<FilterTableOptions>(FilterTablePanel).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      path: 'key',
      name: 'The key used to filter rows',
      description: 'The key used to filter rows',
      defaultValue: 'schema',
    });
});
