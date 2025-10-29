import { PanelPlugin } from '@grafana/data';
import { SystemSummaryOptions } from './types';
import { SystemSummaryPanel } from './components/SystemSummary';

export const plugin = new PanelPlugin<SystemSummaryOptions>(SystemSummaryPanel);
