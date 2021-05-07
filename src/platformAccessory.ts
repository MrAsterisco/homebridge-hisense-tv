import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { HiSenseTVPlatform } from './platform';
import wol from 'wol';
import { PythonShell } from 'python-shell';
import net from 'net';

import packageInfo from './package-info.json';
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
    isConnected: false,
    hasFetchedInputs: false,
    currentSourceName: '', 
  };

  private inputSources: InputSource[] = [];

  constructor(
    private readonly platform: HiSenseTVPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Start the asynchronous check of the TV status.
    this.checkTVStatus();

    // Configure the TV details.
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'HiSense')
      .setCharacteristic(this.platform.Characteristic.Model, 'TV')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id)
      .setCharacteristic(this.platform.Characteristic.SoftwareRevision, packageInfo.version);

    // Create the service.
    this.service = this.accessory.getService(this.platform.Service.Television)||this.accessory.addService(this.platform.Service.Television);
    accessory.category = this.platform.api.hap.Categories.TELEVISION;

    // Configure the service.
    this.service
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.device.name)
      .setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.NOT_DISCOVERABLE);

    // Bind to events.
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setOn.bind(this))
      .on('get', this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .on('set', this.setRemoteKey.bind(this));

    this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 0);

    this.service.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .on('set', this.setCurrentApplication.bind(this))
      .on('get', this.getCurrentApplication.bind(this));

    // Create the TV speaker service.
    this.speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker);

    // Configure the TV speaker service.
    this.speakerService
      .setCharacteristic(this.platform.Characteristic.Active, 1)
      .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.RELATIVE);

    // Bind to TV speaker events.
    this.speakerService
      .getCharacteristic(this.platform.Characteristic.VolumeSelector)
      .on('set', this.setVolume.bind(this));

    // Add the TV speaker to the TV.
    this.service.addLinkedService(this.speakerService);

    // Create "Unknown" source.
    this.createHomeSource();

    // Setup an interval to periodically check the TV status.
    setInterval(() => {
      this.checkTVStatus();
    }, 10000);
    
  }
  
  getOn(callback: CharacteristicGetCallback) {
    callback(null, this.deviceState.isConnected);
  }

  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('Set Characteristic On ->', value);

    if (value === 1) {
      if (this.deviceState.isConnected) {
        // The device is already turned on.
        callback(null);
        return; 
      }
      wol.wake(this.accessory.context.device.macaddress, (err, res) => {
        this.platform.log.debug('Sent magic packet, response: ' + res + 'error: ' + err);
        callback(err);
      });
    } else {
      if (!this.deviceState.isConnected) {
        // The device is already turned off.
        callback(null);
        return; 
      }
      this.sendCommand(['--key', 'power'], (err) => {
        this.platform.log.debug('Sent power off, error: ' + err);
        callback(err);
      });
    }
  }

  setRemoteKey(newValue: CharacteristicValue, callback: CharacteristicSetCallback) {
    let keyName = '';
    switch(newValue) {
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

    this.sendCommand(['--key', keyName], (err) => {
      callback(err);
    });
  }

  setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setVolume called with: ' + value);

    if (value === 0) {
      this.sendCommand(['--key', 'volume_up'], (err) => {
        callback(err);
      });
    } else {
      this.sendCommand(['--key', 'volume_down'], (err) => {
        callback(err);
      });
    }
  }

  getCurrentApplication(callback: CharacteristicSetCallback) {
    callback(null, this.getCurrentInputIndex());
  }

  setCurrentApplication(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setCurrentApplication() invoked to ->', value);

    if (value === 0) {
      this.platform.log.debug('Switching to the Other input is unsupported. This input is only used when the plugin is unable to identify the current input on the TV (i.e. you are using an app).');
      callback(EvalError('Other input is unsupported.'));
    } else if (this.deviceState.hasFetchedInputs) {
      const inputSource = this.inputSources[(value as number)-1];
      this.sendCommand(['--key', 'source_' + inputSource.sourceid], (err) => {
        callback(err, value);
      });
    } else {
      callback(EvalError('Inputs are not available'));
    }
  }

  // #region Support

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
  getSources() {
    this.platform.log.debug('Fetching input sources...');
    if (!this.deviceState.isConnected) {
      this.platform.log.info('Unable to fetch input sources because the TV is off. Will retry as soon as the device comes back online.');
      return;
    }

    this.sendCommand(['--get', 'sources'], (err, output) => {
      try {
        const response: InputSource[] = JSON.parse((output as any[]).join(''));
        this.inputSources = response;

        this.inputSources.forEach((inputSource, index) => {
          this.platform.log.debug('Adding input: ' + JSON.stringify(inputSource));

          const inputService = this.accessory.getService('input'+inputSource.sourceid) 
        || this.accessory.addService(this.platform.Service.InputSource, 'input'+inputSource.sourceid, 'input'+inputSource.sourceid);
        
          inputService.setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED);
          inputService.setCharacteristic(this.platform.Characteristic.ConfiguredName, inputSource.displayname);

          let inputType = this.platform.Characteristic.InputSourceType.OTHER;
          if (inputSource.sourcename === 'TV') {
            inputType = this.platform.Characteristic.InputSourceType.TUNER;
          } else if (inputSource.sourcename === 'AV') {
            inputType = this.platform.Characteristic.InputSourceType.COMPOSITE_VIDEO;
          } else if (inputSource.sourcename.startsWith('HDMI')) {
            inputType = this.platform.Characteristic.InputSourceType.HDMI;
          }
          
          inputService.setCharacteristic(this.platform.Characteristic.InputSourceType, inputType);
          inputService.setCharacteristic(this.platform.Characteristic.Identifier, (index+1));

          this.service.addLinkedService(inputService);
        });

        this.deviceState.hasFetchedInputs = true;
        this.getCurrentInput();
      } catch (error) {
        this.platform.log.error('An error occurred while fetching inputs: ' + error);
      }
    });
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

    const inputService = this.accessory.getService('inputhome') 
        || this.accessory.addService(this.platform.Service.InputSource, 'inputhome', 'inputhome');
        
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
  getCurrentInput() {
    this.platform.log.debug('Checking current input...');

    this.sendCommand(['--get', 'state'], (err, output) => {
      try {
        const response: TVState = JSON.parse((output as any[]).join(''));
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
    });
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
        return index+1;
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
  sendCommand(args: string[], callback: (err?: Error, output?: any) => void) {
    let sslParameter = '';
    switch (this.accessory.context.device.sslmode) {
      case 'disabled':
        sslParameter = '--no-ssl';
        break;
      case 'custom':
        sslParameter = ['--certfile ', this.accessory.context.device.sslcertificate, '--keyfile', this.accessory.context.device.sslprivatekey].join(' ');
        break;
    }

    const pythonScript = path.resolve(__dirname, '../bin/hisensetv.py');
    const pythonArgs = args.concat([this.accessory.context.device.ipaddress, '--ifname', this.platform.config.ifname, sslParameter]);
    this.platform.log.debug('Run Python command: ' + pythonScript + ' ' + pythonArgs.join(' '));

    PythonShell.run(pythonScript, {args: pythonArgs}, callback);
  }

  // #endregion

}

class InputSource {
  sourceid = '';
  sourcename = '';
  displayname = '';
}

class TVState {
  statetype = '';
  sourcename = '';
}