import {Characteristic, CharacteristicValue, Logger, PlatformAccessory, Service} from 'homebridge';

import {HiSenseTVPlatform} from './platform';
import net from 'net';

import {DeviceConfig} from './interfaces/device-config.interface';
import {TVState} from './interfaces/tv-state.interface';
import {InputSource} from './interfaces/input-source.interface';
import {MqttHelper} from './mqtt-helper';
import equal from 'fast-deep-equal/es6';
import {PictureSetting} from './interfaces/picturesetting.interface';
import {TVApp} from './interfaces/tv-app.interface';
import {WoL} from './wol';
import {sourcesAreEqual} from './utils/sourcesAreEqual.function';
import {InputSourceSubPlatformAccessory} from './inputSourceSubPlatformAccessory';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HiSenseTVAccessory {
  private Characteristic: typeof Characteristic;
  private Service: typeof Service;
  private log: Logger;

  private wol: WoL;
  private inputSourceSubPlatformAccessory: InputSourceSubPlatformAccessory;

  private service: Service;
  private speakerService: Service;

  private mqttHelper: MqttHelper;
  private deviceConfig: DeviceConfig;

  /**
   * Counter to keep track of how many times the TV state has been checked and its not yet correct.
   *
   * When turning off the TV offCounter is set to -1, it means the TV should be off.
   * at the same time onCounter is set to 0, and everytime the tv is still on in the polling phase, it will be incremented.
   * if onCounter reaches 8, the TV will be considered on. (means the TV didn't turn off)
   *
   * The same applies for turning on the TV, but with onCounter set to -1 and increasing offCounter.
   *
   * This is done to prevent false positives/negatives when checking the TV state.
   */
  private offCounter = 0;
  private onCounter = 0;

  // Counter threshold to determine if the TV is on or off.
  // 8 seconds seems reasonable, as the TV should respond faster.
  private counterThreshold = 8;

  private deviceState = {
    isConnected: false, hasFetchedInputs: false, currentSourceName: '',
  };

  private inputSources: InputSource[] = [];
  private availableApps: TVApp[] = [];

  constructor(private readonly platform: HiSenseTVPlatform, private readonly accessory: PlatformAccessory) {
    this.log = platform.log;

    if (accessory.context.macaddress == null || accessory.context.macaddress == '') {
      this.log.error('Homebridge MAC address is required for the TV accessory.');
      process.exit(1);
    }

    this.Characteristic = platform.Characteristic;
    this.Service = platform.Service;

    this.inputSourceSubPlatformAccessory = new InputSourceSubPlatformAccessory(this.Service, accessory, this.Characteristic);
    this.wol = new WoL(this.log, accessory.context.device.macaddress, accessory.context.device.wolRetries ?? 3, accessory.context.device.wolInterval ?? 400);

    this.deviceConfig = accessory.context.device;

    // Configure the TV details.
    this.accessory.getService(this.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'HiSense')
      .setCharacteristic(this.Characteristic.Model, 'TV')
      .setCharacteristic(this.Characteristic.SerialNumber, accessory.context.device.id);

    // Create the service.
    this.service = this.accessory.getService(this.Service.Television) || this.accessory.addService(this.Service.Television);

    // Configure the service.
    this.service
      .setCharacteristic(this.Characteristic.ConfiguredName, accessory.context.device.name)
      .setCharacteristic(this.Characteristic.SleepDiscoveryMode, this.Characteristic.SleepDiscoveryMode.NOT_DISCOVERABLE);

    // Bind to events.
    this.service.getCharacteristic(this.Characteristic.Active)
      .onSet(this.setOn.bind(this));

    this.service.getCharacteristic(this.Characteristic.RemoteKey)
      .onSet(this.setRemoteKey.bind(this));

    this.service.setCharacteristic(this.Characteristic.ActiveIdentifier, 0);

    this.service.getCharacteristic(this.Characteristic.ActiveIdentifier)
      .onSet(this.setCurrentApplication.bind(this));

    // Create the TV speaker service.
    this.speakerService = this.accessory.getService(this.Service.TelevisionSpeaker) || this.accessory.addService(this.Service.TelevisionSpeaker);

    // Configure the TV speaker service.
    this.speakerService
      .setCharacteristic(this.Characteristic.Active, 1)
      .setCharacteristic(this.Characteristic.VolumeControlType, this.Characteristic.VolumeControlType.RELATIVE);

    // Bind to TV speaker events.
    this.speakerService
      .getCharacteristic(this.Characteristic.VolumeSelector)
      .onSet(this.setVolume.bind(this));

    // Add the TV speaker to the TV.
    this.service.addLinkedService(this.speakerService);

    // Create "Unknown" source.
    this.createHomeSource();

    this.mqttHelper = new MqttHelper(this.deviceConfig, accessory.context.macaddress);
    this.setupMqtt();

    // set the counter threshold based on the polling interval
    this.counterThreshold = Math.round(8 / (this.deviceConfig.pollingInterval ?? 4));
    if (this.counterThreshold < 1) {
      this.counterThreshold = 1;
    }

    if (this.deviceConfig.tvType === 'default') {
      setInterval(() => {
        this.checkTVStatus();
      }, (this.deviceConfig.pollingInterval ?? 4) * 1000);
    }
  }

  public setupMqtt() {
    this.mqttHelper.mqttClient.on('connect', () => {
      this.log.debug('Connected to MQTT service on TV.');

      this.setTVPowerStateOn();

      this.mqttHelper.subscribe(this.mqttHelper._SOURCE_LIST_TOPIC);
      this.mqttHelper.subscribe(this.mqttHelper._APP_LIST_TOPIC);
      this.mqttHelper.subscribe(this.mqttHelper._STATE_TOPIC);
      if (this.deviceConfig.tvType === 'pictureSettings') {
        this.mqttHelper.subscribe(this.mqttHelper._PICTURE_SETTINGS_TOPIC);
      }

      this.mqttHelper.callService('ui_service', 'sourcelist');
      this.mqttHelper.callService('ui_service', 'gettvstate');
      this.mqttHelper.callService('ui_service', 'applist');
    });


    this.mqttHelper.mqttClient.on('message', (topic, message) => {
      this.log.debug(`Received message from TV (${topic}):` + message.toString());
      const parsedMessage = JSON.parse(message.toString());
      switch (topic) {
        case this.mqttHelper._STATE_TOPIC:
          if (this.deviceConfig.tvType === 'fakeSleep') {
            // setCurrentInput will be called in setAlwaysOnFakeSleepState
            this.setAlwaysOnFakeSleepState(parsedMessage);
          } else {
            this.setCurrentInput(parsedMessage);
          }
          break;
        case this.mqttHelper._SOURCE_LIST_TOPIC:
          this.setSources(parsedMessage, this.availableApps);
          break;
        case this.mqttHelper._PICTURE_SETTINGS_TOPIC:
          this.setAlwaysOnPictureSettingsPowerState(parsedMessage);
          break;
        case this.mqttHelper._APP_LIST_TOPIC:
          this.setSources(this.inputSources, parsedMessage);
          break;
        default:
          this.log.debug('Received unknown message from TV. Topic: ' + topic + ' Message: ' + message.toString());
          break;
      }
    });

    this.mqttHelper.mqttClient.on('close', () => {
      this.log.debug('Closed connection to MQTT service on TV.');
      this.setTVPowerStateOff();
    });

    this.mqttHelper.mqttClient.on('end', () => {
      this.log.debug('Connection to MQTT service on TV ended.');
      this.setTVPowerStateOff();
    });

    this.mqttHelper.mqttClient.on('disconnect', () => {
      this.log.debug('Disconnected from MQTT service on TV.');
      this.setTVPowerStateOff();
    });


    this.mqttHelper.mqttClient.on('error', (err) => {
      this.log.error('An error occurred while connecting to MQTT service: ' + JSON.stringify(err));
      this.setTVPowerStateOff();
    });
  }

  setTVPowerStateOff() {
    this.service.updateCharacteristic(this.Characteristic.Active, this.Characteristic.Active.INACTIVE);
    this.deviceState.isConnected = false;
  }

  setTVPowerStateOn() {
    this.service.updateCharacteristic(this.Characteristic.Active, this.Characteristic.Active.ACTIVE);
    this.deviceState.isConnected = true;
  }

  async setOn(value: CharacteristicValue) {
    this.log.debug('Set Characteristic On ->', value);

    // if its an always on TV we just send the power key to turn it on and off
    if (value === 1 && this.deviceConfig.tvType === 'default') {

      this.wol.sendMagicPacket();
      this.onCounter = -1;
      this.offCounter = 0;
    } else {
      this.offCounter = -1;
      this.onCounter = 0;
      this.mqttHelper.sendKey('KEY_POWER');
    }
  }

  setAlwaysOnPictureSettingsPowerState(settings: PictureSetting) {
    if (settings.menu_info) {
      const alwaysOnSetting = settings.menu_info.find((setting) => setting.menu_id === this.deviceConfig.pictureSettings?.menuId);
      if (alwaysOnSetting) {
        if (alwaysOnSetting.menu_flag === this.deviceConfig.pictureSettings?.menuFlag) {
          this.setTVPowerStateOff();
        } else {
          this.setTVPowerStateOn();
        }
      }
    }
  }

  async setRemoteKey(newValue: CharacteristicValue) {
    let keyName = '';

    // shorter than a switch statement
    const keyDict = {
      [this.Characteristic.RemoteKey.REWIND]: 'KEY_BACK',
      [this.Characteristic.RemoteKey.FAST_FORWARD]: 'KEY_FORWARDS',
      [this.Characteristic.RemoteKey.NEXT_TRACK]: null,
      [this.Characteristic.RemoteKey.PREVIOUS_TRACK]: null,
      [this.Characteristic.RemoteKey.ARROW_UP]: 'KEY_UP',
      [this.Characteristic.RemoteKey.ARROW_DOWN]: 'KEY_DOWN',
      [this.Characteristic.RemoteKey.ARROW_LEFT]: 'KEY_LEFT',
      [this.Characteristic.RemoteKey.ARROW_RIGHT]: 'KEY_RIGHT',
      [this.Characteristic.RemoteKey.SELECT]: 'KEY_OK',
      [this.Characteristic.RemoteKey.BACK]: 'KEY_BACK',
      [this.Characteristic.RemoteKey.EXIT]: 'KEY_EXIT',
      [this.Characteristic.RemoteKey.PLAY_PAUSE]: 'KEY_PLAY',
      [this.Characteristic.RemoteKey.INFORMATION]: 'KEY_HOME',
    };

    keyName = keyDict[newValue as number];

    if (keyName) {
      this.mqttHelper.sendKey(keyName);
    } else {
      this.log.debug(`Key ${newValue} not supported.`);
    }

  }

  async setVolume(value: CharacteristicValue) {
    this.log.debug('setVolume called with: ' + value);

    if (value === 0) {
      this.mqttHelper.sendKey('KEY_VOLUMEUP');
    } else {
      this.mqttHelper.sendKey('KEY_VOLUMEDOWN');
    }
  }

  async setCurrentApplication(value: CharacteristicValue) {
    this.log.debug('setCurrentApplication() invoked to ->', value);

    if (value === 0) {
      this.log.debug('Switching to the Other input is unsupported. This input is only used when the plugin is unable to identify the current input on the TV (i.e. you are using an app).');
    } else if (this.inputSources.length >= (value as number)) {
      if (!this.deviceState.hasFetchedInputs) {
        this.log.debug('Cannot switch input because the input list has not been fetched yet.');
        return;
      }

      // input is a source
      const inputSource = this.inputSources[(value as number) - 1];
      if (this.deviceState.currentSourceName === inputSource.sourcename) {
        this.log.debug(`Input ${inputSource.sourcename} is already selected.`);
      } else {
        this.mqttHelper.changeSource(inputSource.sourceid);
      }
    } else {
      // input is an app
      value = (value as number) - this.inputSources.length - 1;
      if (value >= this.availableApps.length) {
        this.log.debug('Cannot switch input as apps have not been fetched yet.');
        return;
      }

      const app = this.availableApps[value];
      if (this.deviceState.currentSourceName === app.name) {
        this.log.debug(`App ${app.name} is already selected.`);
      } else {
        this.mqttHelper.changeApp(app.name, app.id, app.url, app.urlType ?? '', app.storeType);
      }
    }
  }

  /**
   * Sets the list of inputs for the TV.
   *
   * This function takes the list of inputs from the TV and a list of apps and creates a HomeKit input.
   * It will automatically get the display name from each input and use that as name in HomeKit.
   */
  setSources(sources: InputSource[], apps: TVApp[]) {
    sources = sources.sort((a, b) => {
      return parseInt(a.sourceid, 10) - parseInt(b.sourceid, 10);
    });

    apps = this.getFilteredApps(apps).sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    const sourcesChanged = !sourcesAreEqual(sources, this.inputSources);
    const appsChanged = !equal(this.availableApps, apps);

    if (sourcesChanged) {
      this.inputSources = sources;

      this.inputSources.forEach((inputSource, index) => {
        this.log.debug('Adding input: ' + JSON.stringify(inputSource));

        const inputService = this.inputSourceSubPlatformAccessory.addTVInputSource(inputSource, index + 1);

        this.service.addLinkedService(inputService);
      });

      this.deviceState.hasFetchedInputs = true;
    }

    if (sourcesChanged || appsChanged) {
      // we always need to run both these snippets if source changed
      // as the app identifier is based on the input source length
      this.availableApps = apps;
      const startIndex = this.inputSources.length;
      this.availableApps.forEach((app, index) => {
        this.log.debug('Adding app: ' + JSON.stringify(app));

        const inputService = this.inputSourceSubPlatformAccessory.addAppInputSource(app, startIndex + index + 1);

        this.service.addLinkedService(inputService);
      });

      const displayOrder = [0].concat(this.inputSources.map((_, index) => index + 1)).concat(this.availableApps.map((_, index) => index + this.inputSources.length + 1));

      this.service.setCharacteristic(this.platform.api.hap.Characteristic.DisplayOrder, this.platform.api.hap.encode(1, displayOrder).toString('base64'));

      // run in case the current input is not set after fetching the sources
      this.service.setCharacteristic(this.Characteristic.ActiveIdentifier, this.getCurrentInputIndex());
    }
  }

  /**
   * Create the 'Other' source to support unknown sources being displayed on the TV.
   *
   * There are multiple cases where it is not possible to fetch the current source on the TV,
   * for example when running apps like Netflix. In this case, the plugin will select this input
   * and show that in HomeKit.
   *
   * Switching to this input is unsupported.
   */
  createHomeSource() {
    this.log.debug('Adding unknown source...');
    const inputService = this.inputSourceSubPlatformAccessory.createUnknownSource();
    this.service.addLinkedService(inputService);
  }

  /**
   * Check the current TV status by attempting to telnet the MQTT service directly.
   *
   * Instead of trying to send a command to the TV, it is way faster and lighter to just
   * try to connect to the MQTT service via telnet and then disconnect immediately.
   * If the telnet connection succeds, the TV will be displayed as Active, otherwise it will appear as turned off.
   *
   * After checking the status, if the inputs have not already been fetched, this function will invoke `getSources`.
   * Otherwise, it'll just check for the current visible input, by calling `getCurrentInput`.
   */
  checkTVStatus() {
    this.log.debug('Checking state for TV at IP: ' + this.deviceConfig.ipaddress);

    const socket = net.createConnection({host: this.deviceConfig.ipaddress, port: 36669, timeout: 500});
    socket.on('connect', () => {
      socket.destroy();
      this.log.debug('Connected to TV!');

      if (this.offCounter === -1) {
        this.onCounter++;
      } else {
        this.onCounter = 0;
      }

      if (this.onCounter === this.counterThreshold) {
        this.offCounter = 0;
        this.onCounter = 0;
        this.setTVPowerStateOn();
      }

      if (!this.mqttHelper.mqttClient.connected) {
        this.mqttHelper.mqttClient.reconnect();
      }
    });

    const tvOffCallback = () => {
      if (this.onCounter === -1) {
        this.offCounter++;
      } else {
        this.offCounter = 0;
      }

      if (this.offCounter === this.counterThreshold) {
        this.onCounter = 0;
        this.offCounter = 0;
        this.setTVPowerStateOff();
      }

      if (!this.mqttHelper.mqttClient.disconnected) {
        this.mqttHelper.mqttClient.end(true);
      }
    };

    socket.on('timeout', () => {
      socket.destroy();
      this.log.debug('Connection to TV timed out.');

      tvOffCallback();
    });

    socket.on('error', (err) => {
      socket.destroy();
      this.log.debug('An error occurred while connecting to TV: ' + JSON.stringify(err));

      tvOffCallback();
    });
  }

  /**
   * Get the currently visible input and updates HomeKit.
   *
   * This function will call `hisensetv --get state` and will try to match
   * the reported state to an input. At the moment, only the following states are supported:
   * - `sourceswitch`: any external input (i.e. HDMIs, AV).
   * - `livetv`: the tuner.
   *
   * Any other state will be matched as the "Other" input.
   */
  setCurrentInput(input: TVState) {
    this.log.debug('Received state from TV: ' + JSON.stringify(input));

    if (input.statetype === 'sourceswitch') {
      this.deviceState.currentSourceName = input.sourcename;
      this.log.debug('Current input is: ' + this.deviceState.currentSourceName);
    } else if (input.statetype === 'livetv') {
      this.deviceState.currentSourceName = 'TV';
      this.log.debug('Current input is: ' + this.deviceState.currentSourceName);
    } else if (input.statetype === 'app') {
      this.deviceState.currentSourceName = input.name;
      this.log.debug('Current input is: ' + this.deviceState.currentSourceName);
    } else {
      this.deviceState.currentSourceName = '';
      this.log.debug('Current input is unsupported.');
    }

    this.service.updateCharacteristic(this.Characteristic.ActiveIdentifier, this.getCurrentInputIndex());
  }

  /**
   * Get the index of the current input by matching the current input name to the
   * list of HomeKit inputs and apps.
   *
   * If the current input cannot be found, this function will return `0`.
   *
   * @returns The index of the current input in HomeKit.
   */
  getCurrentInputIndex() {
    if (!this.deviceState.hasFetchedInputs) {
      return 0;
    }

    let index = this.inputSources.findIndex((inputSource) => inputSource.sourcename === this.deviceState.currentSourceName);

    if (index !== -1) {
      return index + 1;
    }

    // if not found in the input sources, check the apps
    index = this.availableApps.findIndex((app) => app.name === this.deviceState.currentSourceName);

    if (index === -1) {
      return 0;
    }

    return index + this.inputSources.length + 1;
  }

  getFilteredApps(apps: TVApp[]) {
    if (!(this.deviceConfig.showApps ?? false)) {
      return [];
    }

    const visibleAppNames = this.deviceConfig.apps ?? [];

    return apps.filter((app) => !app.isunInstalled && (visibleAppNames.length === 0 || visibleAppNames.includes(app.name)));
  }

  private setAlwaysOnFakeSleepState(tvState: TVState) {
    if (tvState.statetype.startsWith('fake_sleep') && this.deviceState.isConnected) {
      // Disconnect
      this.setTVPowerStateOff();
    } else if (!tvState.statetype.startsWith('fake_sleep')) {
      this.setCurrentInput(tvState);
      if (!this.deviceState.isConnected) {
        // Connect
        this.setTVPowerStateOn();
      }
    }
  }
}