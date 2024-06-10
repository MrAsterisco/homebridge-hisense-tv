import {DeviceConfig} from '../interfaces/device-config.interface.js';

export function validateDeviceConfig(deviceConfig: DeviceConfig){
  deviceConfig.showApps = deviceConfig.showApps ?? false;

  deviceConfig.tvType = deviceConfig.tvType ?? 'default';

  deviceConfig.pollingInterval = deviceConfig.pollingInterval ?? 4;
  deviceConfig.wolInterval = deviceConfig.wolInterval ?? 400;
  deviceConfig.wolRetries = deviceConfig.wolRetries ?? 3;

  return deviceConfig;
}