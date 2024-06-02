import {Characteristic, CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {HiSenseTVPlatform} from './platform';
import wol from 'wol';
import net from 'net';

import {DeviceConfig} from './interfaces/device-config.interface';
import {TVState} from './interfaces/tv-state.interface';
import {InputSource} from './interfaces/input-source.interface';
import {MqttHelper} from './mqtt-helper';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HiSenseTVAccessory {
  private Characteristic: typeof Characteristic;
  private Service: typeof Service;

  private service: Service;
  private speakerService: Service;

  private mqttHelper: MqttHelper;
  private deviceConfig: DeviceConfig;

  private deviceState = {
    isConnected: false, hasFetchedInputs: false, currentSourceName: '',
  };

  private inputSources: InputSource[] = [];

  constructor(private readonly platform: HiSenseTVPlatform, private readonly accessory: PlatformAccessory) {
    this.Characteristic = platform.Characteristic;
    this.Service = platform.Service;

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

    this.mqttHelper = new MqttHelper(this.deviceConfig, this.platform.config.ifname);
    this.setupMqtt();
  }

  public setupMqtt() {
    this.mqttHelper.mqttClient.on('connect', () => {
      this.platform.log.debug('Connected to MQTT service on TV.');

      this.deviceState.isConnected = true;
      this.service.updateCharacteristic(this.Characteristic.Active, this.Characteristic.Active.ACTIVE);

      this.mqttHelper.subscribe(this.mqttHelper._SOURCE_LIST_TOPIC);
      this.mqttHelper.subscribe(this.mqttHelper._STATE_TOPIC);

      this.mqttHelper.callService('ui_service', 'gettvstate');
      this.mqttHelper.callService('ui_service', 'sourcelist');
    });


    this.mqttHelper.mqttClient.on('message', (topic, message) => {
      this.platform.log.debug(`Received message from TV (${topic}):` + message.toString());
      if(topic === this.mqttHelper._STATE_TOPIC) {
        this.setCurrentInput(JSON.parse(message.toString()));
      }else if(topic === this.mqttHelper._SOURCE_LIST_TOPIC){
        this.setSources(JSON.parse(message.toString()));
      }
    });

    this.mqttHelper.mqttClient.on('reconnect', () => {
      this.platform.log.debug('Reconnecting to MQTT service on TV.');
    });

    this.mqttHelper.mqttClient.on('disconnect', () => {
      this.platform.log.debug('Disconnected from MQTT service on TV.');
      this.service.updateCharacteristic(this.Characteristic.Active, this.Characteristic.Active.INACTIVE);
      this.deviceState.isConnected = false;
    });


    this.mqttHelper.mqttClient.on('error', (err) => {
      this.platform.log.debug('name', err.name);
      this.platform.log.error('An error occurred while connecting to MQTT service: ' + JSON.stringify(err));
      this.service.updateCharacteristic(this.Characteristic.Active, this.Characteristic.Active.INACTIVE);
      this.deviceState.isConnected = false;
    });
  }

  async setOn(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic On ->', value);

    if (value === 1) {
      try {
        const result = await wol.wake(this.deviceConfig.macaddress, {address: this.deviceConfig.ipaddress});
        this.platform.log.debug('Wake on LAN result:', result);
      } catch (error) {
        this.platform.log.error('An error occurred while turning on the TV: ' + error);
      }
    } else {
      this.mqttHelper.sendKey('KEY_POWER');
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

    if(keyName){
      this.mqttHelper.sendKey(keyName);
    } else {
      this.platform.log.debug(`Key ${newValue} not supported.`);
    }

  }

  async setVolume(value: CharacteristicValue) {
    this.platform.log.debug('setVolume called with: ' + value);

    if (value === 0) {
      this.mqttHelper.sendKey('KEY_VOLUMEUP');
    } else {
      this.mqttHelper.sendKey('KEY_VOLUMEDOWN');
    }
  }

  async setCurrentApplication(value: CharacteristicValue) {
    this.platform.log.debug('setCurrentApplication() invoked to ->', value);

    if (value === 0) {
      this.platform.log.debug('Switching to the Other input is unsupported. This input is only used when the plugin is unable to identify the current input on the TV (i.e. you are using an app).');
    } else if (this.deviceState.hasFetchedInputs) {
      const inputSource = this.inputSources[(value as number) - 1];

      if(this.deviceState.currentSourceName == inputSource.sourcename){
        this.platform.log.debug(`Input ${inputSource.sourcename} is already selected.`);
      }else {
        this.mqttHelper.changeSource(inputSource.sourceid);
      }
    } else {
      this.platform.log.debug('Cannot switch input because the input list has not been fetched yet.');
    }
  }


  /**
   * Fetch the available inputs from the TV.
   *
   * This function calls `hisensetv --get sources` and registers new inputs
   * with HomeKit. It will automatically get the display name from each input and
   * use that as name in HomeKit.
   *
   * This function will be executed only once when registering a new device or
   * starting up. It will be executed again if the TV is off the first time.
   */
  setSources(sources: InputSource[]) {
    // TODO implement correct comparison of sources
    if(this.deviceState.hasFetchedInputs && this.inputSources == sources){
      return;
    }

    this.inputSources = sources
      .sort((a, b) => {
        return parseInt(a.sourceid, 10) - parseInt(b.sourceid, 10);
      });

    this.inputSources.forEach((inputSource, index) => {
      this.platform.log.debug('Adding input: ' + JSON.stringify(inputSource));

      const inputService = this.accessory.getService('input' + inputSource.sourceid) || this.accessory.addService(this.Service.InputSource, 'input' + inputSource.sourceid, 'input' + inputSource.sourceid);

      inputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
      inputService.setCharacteristic(this.Characteristic.ConfiguredName, inputSource.displayname);
      inputService.setCharacteristic(this.Characteristic.Name, inputSource.displayname);

      let inputType = this.Characteristic.InputSourceType.OTHER;
      if (inputSource.sourcename === 'TV') {
        inputType = this.Characteristic.InputSourceType.TUNER;
      } else if (inputSource.sourcename === 'AV') {
        inputType = this.Characteristic.InputSourceType.COMPOSITE_VIDEO;
      } else if (inputSource.sourcename.startsWith('HDMI')) {
        inputType = this.Characteristic.InputSourceType.HDMI;
      }

      inputService.setCharacteristic(this.Characteristic.InputSourceType, inputType);
      inputService.setCharacteristic(this.Characteristic.Identifier, (index + 1));

      inputSource.service = inputService;

      this.service.addLinkedService(inputService);
    });

    const displayOrder = [0].concat(this.inputSources.map((_, index) => index+1));
    this.service.setCharacteristic(this.platform.api.hap.Characteristic.DisplayOrder, this.platform.api.hap.encode(1, displayOrder).toString('base64'));
    this.deviceState.hasFetchedInputs = true;
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
    this.platform.log.debug('Adding unknown source...');

    const inputService = this.accessory.getService('inputhome') || this.accessory.addService(this.Service.InputSource, 'inputhome', 'inputhome');

    inputService
      .setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
      .setCharacteristic(this.Characteristic.ConfiguredName, 'Unknown')
      .setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.OTHER)
      .setCharacteristic(this.Characteristic.Identifier, 0);

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
    this.platform.log.debug('Checking state for TV at IP: ' + this.deviceConfig.ipaddress);

    const socket = net.createConnection({host: this.deviceConfig.ipaddress, port: 36669, timeout: 500});
    socket.on('connect', () => {
      this.platform.log.debug('Legacy-Method: Connected to TV!');
      socket.destroy();
    });

    socket.on('timeout', () => {
      this.platform.log.debug('Legacy-Method: Connection to TV timed out.');
      socket.destroy();
    });

    socket.on('error', (err) => {
      this.platform.log.debug('Legacy-Method: An error occurred while connecting to TV: ' + err);
      socket.destroy();
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
    if (input.statetype === 'sourceswitch') {
      this.deviceState.currentSourceName = input.sourcename;
      this.platform.log.debug('Current input is: ' + this.deviceState.currentSourceName);
    } else if (input.statetype === 'livetv') {
      this.deviceState.currentSourceName = 'TV';
      this.platform.log.debug('Current input is: ' + this.deviceState.currentSourceName);
    } else {
      this.deviceState.currentSourceName = '';
      this.platform.log.debug('Current input is unsupported.');
    }

    this.service.updateCharacteristic(this.Characteristic.ActiveIdentifier, this.getCurrentInputIndex());
  }

  /**
   * Get the index of the current input by matching the current input name to the
   * list of HomeKit inputs.
   *
   * If the current input cannot be found, this function will return `0`.
   *
   * @returns The index of the current input in HomeKit.
   */
  getCurrentInputIndex() {
    if (!this.deviceState.hasFetchedInputs) {
      return 0;
    }

    const index = this.inputSources.findIndex((inputSource) =>
      inputSource.sourcename === this.deviceState.currentSourceName,
    );

    // here we return 0 incase the input is not found in the list of inputs (-1 + 1 = 0)
    // otherwise we return the input index
    return index + 1;
  }
}