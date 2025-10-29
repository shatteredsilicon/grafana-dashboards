import { PanelPlugin } from '@grafana/data';
import { QANOptions } from './types';
import { QANPanel } from './components/QAN';

export const plugin = new PanelPlugin<QANOptions>(QANPanel);
