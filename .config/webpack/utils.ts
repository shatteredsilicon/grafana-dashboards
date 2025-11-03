import fs from 'fs';
import process from 'process';
import os from 'os';
import path from 'path';
import { glob } from 'glob';

export function isWSL() {
  if (process.platform !== 'linux') {
    return false;
  }

  if (os.release().toLowerCase().includes('microsoft')) {
    return true;
  }

  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

export function getPluginJson(dir: string) {
  return require(`${dir}/plugin.json`);
}

// Support bundling nested plugins by finding all plugin.json files in src directory
// then checking for a sibling module.[jt]sx? file.
export async function getEntries(): Promise<Record<string, string>> {
  const pluginsJson = await glob('panels/**/plugin.json', { absolute: true });

  const plugins = await Promise.all(
    pluginsJson.map((pluginJson) => {
      const folder = path.dirname(pluginJson);
      return glob(`${folder}/module.{ts,tsx,js,jsx}`, { absolute: true });
    })
  );

  return plugins.reduce((result, modules) => {
    return modules.reduce((result, module) => {
      const pluginPath = path.dirname(module);
      const entryName = path.relative(process.cwd(), pluginPath).slice('panels/'.length);

      result[entryName] = module;
      return result;
    }, result);
  }, {} as { [key: string]: string });
}
