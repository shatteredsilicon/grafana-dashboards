import { PanelPlugin } from '@grafana/data';
import { AddInstanceOptions } from './types';
import { AddInstancePanel } from './components/AddInstance';

export const plugin = new PanelPlugin<AddInstanceOptions>(AddInstancePanel);
