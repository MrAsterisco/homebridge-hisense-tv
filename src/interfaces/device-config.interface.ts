export interface DeviceConfig {
  id: string;
  alwaysOn: 'default' | 'fakeSleep' | 'pictureSettings';
  pictureSettings?: {
    menuId: number;
    menuFlag: number;
  };
  name: string;
  pollingInterval: number;
  ipaddress: string;
  macaddress: string;
  sslmode: 'disabled' | 'custom';
  sslcertificate: string;
  sslprivatekey: string;
}