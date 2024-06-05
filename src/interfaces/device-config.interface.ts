export interface DeviceConfig {
  id: string;
  tvType: 'default' | 'fakeSleep' | 'pictureSettings';
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