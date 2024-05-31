import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {HiSenseTVPlatform} from './platform';
import wol from 'wol';
import {PythonShell} from 'python-shell';
import net from 'net';

import path from 'path';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HiSenseTVAccessory {
  private service: Service;
  private speakerService: Service;

  private deviceState = {
    isConnected: false, hasFetchedInputs: false, currentSourceName: '',
  };

  private inputSources: InputSource[] = [];

  constructor(private readonly platform: HiSenseTVPlatform, private readonly accessory: PlatformAccessory) {
    let isFirstRun = true;
    // Start the asynchronous check of the TV status.
    this.checkTVStatus();

    // Configure the TV details.
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'HiSense')
      .setCharacteristic(this.platform.Characteristic.Model, 'TV')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

    // Create the service.
    this.service = this.accessory.getService(this.platform.Service.Television) || this.accessory.addService(this.platform.Service.Television);

    // Configure the service.
    this.service
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.device.name)
      .setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.NOT_DISCOVERABLE);

    // Bind to events.
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .onSet(this.setRemoteKey.bind(this));

    this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 0);

    this.service.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .onSet(this.setCurrentApplication.bind(this))
      .onGet(this.getCurrentApplication.bind(this));

    // Create the TV speaker service.
    this.speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker);

    // Configure the TV speaker service.
    this.speakerService
      .setCharacteristic(this.platform.Characteristic.Active, 1)
      .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.RELATIVE);

    // Bind to TV speaker events.
    this.speakerService
      .getCharacteristic(this.platform.Characteristic.VolumeSelector)
      .onSet(this.setVolume.bind(this));

    // Add the TV speaker to the TV.
    this.service.addLinkedService(this.speakerService);

    // Create "Unknown" source.
    this.createHomeSource();

    // Setup an interval to periodically check the TV status.
    setInterval(() => {
      if (isFirstRun && this.deviceState.hasFetchedInputs) {
        isFirstRun = false;
        return;
      }
      this.checkTVStatus();
    }, this.accessory.context.pollingInterval * 1000);

  }

  async getOn(): Promise<CharacteristicValue> {
    return this.deviceState.isConnected;
  }

  async setOn(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic On ->', value);

    if (value === 1) {
      if (this.deviceState.isConnected) {
        // The device is already turned on. Nothing to do
        return;
      }
      await wol.wake(this.accessory.context.device.macaddress);
      this.deviceState.isConnected = true;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE);
    } else {
      if (!this.deviceState.isConnected) {
        // The device is already turned off. Nothing to do
        return;
      }
      await this.sendCommand(['--key', 'power']);
      this.deviceState.isConnected = false;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.INACTIVE);
    }
  }

  async setRemoteKey(newValue: CharacteristicValue) {
    let keyName = '';
    switch (newValue) {
      case this.platform.Characteristic.RemoteKey.REWIND: {
        this.platform.log.debug('set Remote Key Pressed: REWIND');
        keyName = 'rewind';
        break;
      }
      case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
        this.platform.log.debug('set Remote Key Pressed: FAST_FORWARD');
        keyName = 'fast_forward';
        break;
      }
      case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
        this.platform.log.debug('unsupported Remote Key Pressed: NEXT_TRACK, ignoring.');
        return;
      }
      case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
        this.platform.log.debug('unsupported Remote Key Pressed: PREVIOUS_TRACK, ignoring.');
        return;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_UP: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_UP');
        keyName = 'up';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_DOWN');
        keyName = 'down';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_LEFT');
        keyName = 'left';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_RIGHT');
        keyName = 'right';
        break;
      }
      case this.platform.Characteristic.RemoteKey.SELECT: {
        this.platform.log.debug('set Remote Key Pressed: SELECT');
        keyName = 'ok';
        break;
      }
      case this.platform.Characteristic.RemoteKey.BACK: {
        this.platform.log.debug('set Remote Key Pressed: BACK');
        keyName = 'back';
        break;
      }
      case this.platform.Characteristic.RemoteKey.EXIT: {
        this.platform.log.debug('set Remote Key Pressed: EXIT');
        keyName = 'exit';
        break;
      }
      case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
        this.platform.log.debug('set Remote Key Pressed: PLAY_PAUSE');
        keyName = 'play';
        break;
      }
      case this.platform.Characteristic.RemoteKey.INFORMATION: {
        this.platform.log.debug('set Remote Key Pressed: INFORMATION');
        keyName = 'home';
        break;
      }
    }


    const [err] = await this.sendCommand(['--key', keyName]);
    if (err) {
      this.platform.log.error('An error occurred while sending the remote key: ' + err);
    }
  }

  async setVolume(value: CharacteristicValue) {
    this.platform.log.debug('setVolume called with: ' + value);

    if (value === 0) {
      const [err] = await this.sendCommand(['--key', 'volume_up']);
      if (err) {
        this.platform.log.error('An error occurred while changing the volume: ' + err);
      }
    } else {
      const [err] = await this.sendCommand(['--key', 'volume_down']);
      if (err) {
        this.platform.log.error('An error occurred while changing the volume: ' + err);
      }
    }
  }

  async getCurrentApplication() {
    return this.getCurrentInputIndex();
  }

  async setCurrentApplication(value: CharacteristicValue) {
    this.platform.log.debug('setCurrentApplication() invoked to ->', value);

    if (value === 0) {
      this.platform.log.debug('Switching to the Other input is unsupported. This input is only used when the plugin is unable to identify the current input on the TV (i.e. you are using an app).');
    } else if (this.deviceState.hasFetchedInputs) {
      const inputSource = this.inputSources[(value as number) - 1];
      await this.sendCommand(['--key', 'source_' + inputSource.sourceid]);
      this.service.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, value);
    } else {
      //callback(EvalError('Inputs are not available'));
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
  async getSources() {
    this.platform.log.debug('Fetching input sources...');
    if (!this.deviceState.isConnected) {
      this.platform.log.info('Unable to fetch input sources because the TV is off. Will retry as soon as the device comes back online.');
      return;
    }

    const [_, output] = await this.sendCommand(['--get', 'sources']);
    try {
      this.inputSources = (JSON.parse((output as string[]).join('')) as InputSource[])
        .sort((a, b) => {
          return parseInt(a.sourceid, 10) - parseInt(b.sourceid, 10);
        });

      this.inputSources.forEach((inputSource, index) => {
        this.platform.log.debug('Adding input: ' + JSON.stringify(inputSource));

        const inputService = this.accessory.getService('input' + inputSource.sourceid) || this.accessory.addService(this.platform.Service.InputSource, 'input' + inputSource.sourceid, 'input' + inputSource.sourceid);

        inputService.setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED);
        inputService.setCharacteristic(this.platform.Characteristic.ConfiguredName, inputSource.displayname);
        inputService.setCharacteristic(this.platform.Characteristic.Name, inputSource.displayname);
        inputService.setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.SHOWN);

        let inputType = this.platform.Characteristic.InputSourceType.OTHER;
        if (inputSource.sourcename === 'TV') {
          inputType = this.platform.Characteristic.InputSourceType.TUNER;
        } else if (inputSource.sourcename === 'AV') {
          inputType = this.platform.Characteristic.InputSourceType.COMPOSITE_VIDEO;
        } else if (inputSource.sourcename.startsWith('HDMI')) {
          inputType = this.platform.Characteristic.InputSourceType.HDMI;
        }

        inputService.setCharacteristic(this.platform.Characteristic.InputSourceType, inputType);
        inputService.setCharacteristic(this.platform.Characteristic.Identifier, (index + 1));

        inputSource.service = inputService;

        this.service.addLinkedService(inputService);
      });

      const displayOrder = [0].concat(this.inputSources.map((_, index) => index+1));
      this.service.setCharacteristic(this.platform.api.hap.Characteristic.DisplayOrder, this.platform.api.hap.encode(1, displayOrder).toString('base64'));

      this.getCurrentInput();
    } catch (error) {
      this.deviceState.hasFetchedInputs = false;
      this.platform.log.error('An error occurred while fetching inputs: ' + error);
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
    this.platform.log.debug('Adding unknown source...');

    const inputService = this.accessory.getService('inputhome') || this.accessory.addService(this.platform.Service.InputSource, 'inputhome', 'inputhome');

    inputService
      .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Unknown')
      .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.OTHER)
      .setCharacteristic(this.platform.Characteristic.Identifier, 0);

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
    this.platform.log.debug('Checking state for TV at IP: ' + this.accessory.context.device.ipaddress);

    const socket = net.createConnection({host: this.accessory.context.device.ipaddress, port: 36669, timeout: 500});
    socket.on('connect', () => {
      this.platform.log.debug('Connected to TV!');
      this.deviceState.isConnected = true;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.deviceState.isConnected);

      socket.destroy();

      if (!this.deviceState.hasFetchedInputs) {
        this.deviceState.hasFetchedInputs = true;
        this.getSources();
      } else {
        this.getCurrentInput();
      }
    });

    socket.on('timeout', () => {
      this.platform.log.debug('Connection to TV timed out.');
      this.deviceState.isConnected = false;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.deviceState.isConnected);
      socket.destroy();
    });

    socket.on('error', (err) => {
      this.platform.log.debug('An error occurred while connecting to TV: ' + err);
      this.deviceState.isConnected = false;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.deviceState.isConnected);
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
  async getCurrentInput() {
    this.platform.log.debug('Checking current input...');

    const [_, output] = await this.sendCommand(['--get', 'state']);

    try {
      const response = JSON.parse((output as string[]).join('')) as TVState;
      if (response.statetype === 'sourceswitch') {
        this.deviceState.currentSourceName = response.sourcename;
        this.platform.log.debug('Current input is: ' + this.deviceState.currentSourceName);
      } else if (response.statetype === 'livetv') {
        this.deviceState.currentSourceName = 'TV';
        this.platform.log.debug('Current input is: ' + this.deviceState.currentSourceName);
      } else {
        this.deviceState.currentSourceName = '';
        this.platform.log.debug('Current input is unsupported.');
      }

      this.service.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.getCurrentInputIndex());
    } catch (error) {
      this.platform.log.error('An error occurred while fetching the current input: ' + error);
    }
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
    for (let index = 0; index < this.inputSources.length; index++) {
      const inputSource = this.inputSources[index];
      if (inputSource.sourcename === this.deviceState.currentSourceName) {
        return index + 1;
      }
    }

    return 0;
  }

  /**
   * Invoke a function on the Hisense script.
   *
   * @param args the arguments to pass to the Hisense script.
   * @param callback A callback to call with an error and the output of the script.
   */
  async sendCommand(args: string[]): Promise<[err?: Error, output?: unknown]> {
    const sslParameter = this.getSslArgument();

    const pythonScript = path.resolve(__dirname, '../bin/hisensetv.py');

    let pythonArgs = args.concat([this.accessory.context.device.ipaddress, '--ifname', this.platform.config.ifname]);
    if (sslParameter !== null) {
      pythonArgs = pythonArgs.concat(sslParameter);
    }

    this.platform.log.debug('Run Python command: ' + pythonScript + ' ' + pythonArgs.join(' '));

    return new Promise((resolve) => {
      PythonShell.run(pythonScript, {args: pythonArgs}, (err, output) => {
        if (err === null) {
          this.platform.log.debug('Received Python command response: ' + output);
        } else {
          this.platform.log.debug('Received Python command error: ' + err);
        }

        resolve([err, output]);
      });
    });
  }

  /**
   * Compute the SSL argument to pass to the underlying script,
   * based on the current device configuration.
   *
   * @returns The SSL parameter to pass or null.
   */
  getSslArgument(): string[] {
    let sslParameter: string[] = [];
    switch (this.accessory.context.device.sslmode) {
      case 'disabled':
        sslParameter = ['--no-ssl'];
        break;
      case 'custom':
        sslParameter = ['--certfile', this.accessory.context.device.sslcertificate.trim(), '--keyfile', this.accessory.context.device.sslprivatekey.trim()];
        break;
    }

    return sslParameter;
  }

  // #endregion

}

class InputSource {
  sourceid = '';
  sourcename = '';
  displayname = '';
  service?: Service;
}

class TVState {
  statetype = '';
  sourcename = '';
}