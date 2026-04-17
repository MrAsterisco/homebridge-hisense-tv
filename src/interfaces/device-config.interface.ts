import { SSLMode } from '../types/ssl-mode.type.js';

export interface DeviceConfig {
  id: string;
  tvType: 'default' | 'fakeSleep' | 'pictureSettings';
  pictureSettings?: {
    menuId: number;
    menuFlag: number;
  };
  broadcast?: string;
  name: string;
  pollingInterval: number;
  wolInterval: number;
  wolRetries: number;
  ipaddress: string;
  macaddress: string;
  sslmode: SSLMode;
  sslcertificate: string;
  sslprivatekey: string;
  showApps: boolean;
  apps?: Array<string>;
}