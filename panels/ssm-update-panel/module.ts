import { PanelPlugin } from '@grafana/data';
import { UpdateOptions } from './types';
import { UpdatePanel } from './components/Update';

export const plugin = new PanelPlugin<UpdateOptions>(UpdatePanel);
