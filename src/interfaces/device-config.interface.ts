export interface DeviceConfig {
  id: string;
  name: string;
  pollingInterval: number;
  ipaddress: string;
  macaddress: string;
  sslmode: 'disabled' | 'custom';
  sslcertificate: string;
  sslprivatekey: string;
}