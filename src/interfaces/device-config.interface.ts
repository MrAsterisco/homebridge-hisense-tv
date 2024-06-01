export interface DeviceConfig {
  id: string;
  name: string;
  ipaddress: string;
  macaddress: string;
  sslmode: 'disabled' | 'custom';
  sslcertificate: string;
  sslprivatekey: string;
}