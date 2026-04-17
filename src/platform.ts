import {
  API,
  PlatformConfig,
  Service,
  Characteristic,
  Categories,
  Logging,
  IndependentPlatformPlugin,
} from 'homebridge';

import { PLUGIN_NAME } from './settings.js';
import { HiSenseTVAccessory } from './platformAccessory.js';
import { DeviceConfig } from './interfaces/device-config.interface.js';
import { validateHomeKitName } from './utils/validateHomeKitName.function.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HiSenseTVPlatform implements IndependentPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  constructor(
      public readonly log: Logging,
      public readonly config: PlatformConfig,
      public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.platform);

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to log success messages
    // For users that are on a version prior to 1.8.0, we need a 'polyfill' for this method
    if (!log.success) {
      log.success = log.info;
    }

    // comment from homebridge-team
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.

    // comment from maintainer
    // We don't have a DynamicPlatformPlugin, so we don't necessarily have to wait for this event,
    // but we will do it anyway to be safe.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  discoverDevices() {
    const configDevices = this.config.devices as DeviceConfig[] || [];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of configDevices) {

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(`homebridge-hisense-tv:${device.id}:${device.macaddress}`);

      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', device.name);

      // create a new accessory
      const accessory = new this.api.platformAccessory(validateHomeKitName(device.name), uuid, Categories.TELEVISION);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;
      accessory.context.macaddress = this.config.macaddress;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.log.info(`Waiting for TV data before publishing: ${device.name}`);
      try {
        new HiSenseTVAccessory(this, accessory, () => {
          this.log.info(`TV data ready, publishing to HomeKit: ${device.name}`);
          this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
        });
      } catch (e: unknown) {
        this.log.error(`Failed to initialize TV "${device.name}": ${(e as Error).message}`);
      }
    }
  }
}