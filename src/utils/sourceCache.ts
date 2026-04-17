import fs from 'node:fs';
import path from 'node:path';
import { InputSource } from '../interfaces/input-source.interface.js';
import { TVApp } from '../interfaces/tv-app.interface.js';

const CACHE_VERSION = 1;

interface SourceCache {
  version: number;
  deviceId: string;
  inputSources: InputSource[];
  availableApps: Omit<TVApp, 'service'>[];
}

export function writeSourceCache(
  storagePath: string,
  deviceId: string,
  inputSources: InputSource[],
  availableApps: TVApp[],
): void {
  const cachePath = path.join(storagePath, `hisense-tv-cache-${deviceId}.json`);
  const data: SourceCache = {
    version: CACHE_VERSION,
    deviceId,
    inputSources,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    availableApps: availableApps.map(({ service, ...rest }) => rest),
  };
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function readSourceCache(
  storagePath: string,
  deviceId: string,
): { inputSources: InputSource[]; availableApps: Omit<TVApp, 'service'>[] } | null {
  const cachePath = path.join(storagePath, `hisense-tv-cache-${deviceId}.json`);
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const data: SourceCache = JSON.parse(raw);
    if (data.version !== CACHE_VERSION || data.deviceId !== deviceId) {
      return null;
    }
    return {
      inputSources: data.inputSources,
      availableApps: data.availableApps,
    };
  } catch {
    return null;
  }
}
