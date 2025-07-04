import { PanelPlugin } from '@grafana/data';
import { QanSettingsOptions } from './types';
import { QanSettingsPanel } from './components/QanSettings';

export const plugin = new PanelPlugin<QanSettingsOptions>(QanSettingsPanel);
