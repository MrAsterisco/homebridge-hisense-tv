import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { HiSenseTVPlatform } from './platform';
import wol from 'wol';

import packageInfo from './package-info.json';

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
    powerState: false,
    webApiEnabled: false,
    currentAumId: '',
    currentTitleId: '',
  };

  private inputSources = [
    {
      name: 'Other',
      type: this.platform.Characteristic.InputSourceType.OTHER,
      hidden: true,
      title_id: '',
    }, {
      name: 'Home',
      type: this.platform.Characteristic.InputSourceType.HOME_SCREEN,
      hidden: true,
      title_id: '',
    },
  ];

  private appTitleCache:any[] = [];

  constructor(
    private readonly platform: HiSenseTVPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // TODO: check HiSense

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'HiSense')
      .setCharacteristic(this.platform.Characteristic.Model, 'TV')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id)
      .setCharacteristic(this.platform.Characteristic.SoftwareRevision, packageInfo.version);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Television)||this.accessory.addService(this.platform.Service.Television);

    accessory.category = this.platform.api.hap.Categories.TELEVISION;

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.device.name);
    this.service.setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setOn.bind(this))
      .on('get', this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .on('set', this.setRemoteKey.bind(this));

    this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 1);

    this.service.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .on('set', this.setCurrentApplication.bind(this))
      .on('get', this.getCurrentApplication.bind(this));

    // Speaker service
    this.speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker);
    this.speakerService.setCharacteristic(this.platform.Characteristic.Active, 1);
    this.speakerService.setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);

    this.speakerService
      .getCharacteristic(this.platform.Characteristic.VolumeSelector)
      .on('set', this.setVolume.bind(this));

    this.service.addLinkedService(this.speakerService);

    // Prepare input sources
    for(const app in this.accessory.context.device.inputs){
      this.platform.log.debug('Adding input source to config:', this.accessory.context.device.inputs[app].name);

      this.inputSources.push({
        name: this.accessory.context.device.inputs[app].name,
        type: this.platform.Characteristic.InputSourceType.APPLICATION,
        title_id: this.accessory.context.device.inputs[app].title_id || '',
        hidden: false,
      });

    }

    // Configure input sources
    for(const id in this.inputSources){
      const inputSource = this.accessory.getService('input'+id) || this.accessory.addService(this.platform.Service.InputSource, 'input'+id, 'input'+id);

      inputSource.setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED);
      inputSource.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputSources[id].name);
      inputSource.setCharacteristic(this.platform.Characteristic.InputSourceType, this.inputSources[id].type || this.platform.Characteristic.InputSourceType.HOME_SCREEN);
      inputSource.setCharacteristic(this.platform.Characteristic.Identifier, (parseInt(id)+1));

      if(this.inputSources[id].hidden === true){
        inputSource.setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.HIDDEN);
      }
      
      this.service.addLinkedService(inputSource);
    }

    setInterval(() => {
      this.platform.log.debug('Device status:', this.deviceState.isConnected ? 'Connected':'Disconnected' );

      // TODO: check if the TV is reachable
    }, 10000);
    
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('Set Characteristic On ->', value);

    if (value === 1) {
      wol.wake(this.accessory.context.device.macaddress, (err, res) => {
        this.platform.log.debug('WOL res: ' + res);
        callback(err);
      });
    } else {
      callback(null);
    }

    // this.deviceState.isConnected = false;

    // TODO: Change state
    
    /* if((this.deviceState.powerState?1:0) === value){
      this.platform.log.debug('Set Characteristic not changes. Ignoring ('+value+')');
    } else {

      this.platform.log.debug('Set Characteristic On ->', value);
      if(value === 0){
        // Power off
        if(this.deviceState.webApiEnabled === true){
          this.ApiClient.isAuthenticated().then(() => {
            this.ApiClient.getProvider('smartglass').powerOff(this.accessory.context.device.liveid).then(() => {
              this.platform.log.debug('Powered off xbox using xbox api');
              this.deviceState.isConnected = false;
              this.deviceState.powerState = false;
              // this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);

            }).catch((error) => {
              this.platform.log.info('Failed to turn off xbox using xbox api:', error);
              this.deviceState.isConnected = false;
              this.deviceState.powerState = false;
            });
          }).catch((error) => {
            this.platform.log.info('Failed to turn off xbox using xbox api:', error);
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
          });
        } else {
          this.SGClient.powerOff().then(() => {
            this.platform.log.debug('Powered off xbox using smartglass');
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
            // this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);
    
          }).catch((error) => {
            this.platform.log.info('Failed to turn off xbox using smartglass:', error);
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
          });
        }
      } else {

        if(this.deviceState.webApiEnabled === true){
          this.ApiClient.isAuthenticated().then(() => {
            this.ApiClient.getProvider('smartglass').powerOn(this.accessory.context.device.liveid).then(() => {
              this.platform.log.debug('Powered on xbox using xbox api');
              this.deviceState.powerState = true;
              this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);

            }).catch((error) => {
              this.platform.log.info('Failed to turn on xbox using xbox api:', error);
              this.deviceState.isConnected = false;
              this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
            });
          }).catch((error) => {
            this.platform.log.info('Failed to turn on xbox using xbox api:', error);
            this.deviceState.isConnected = false;
            this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
          });
        } else {
          // Power on
          this.SGClient.powerOn({
            tries: 10,
            ip: this.accessory.context.device.ipaddress,
            live_id: this.accessory.context.device.liveid,
          }).then(() => {
            this.platform.log.debug('Powered on xbox using smartglass');
            this.deviceState.powerState = true;
            this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
    
          }).catch((error) => {
            this.platform.log.info('Failed to turn on xbox using smartglass:', error);
            this.deviceState.isConnected = false;
          });
        }
      }
      
    } */
    // you must call the callback function
    //callback(null);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // TODO: check if TV is on

    // implement your own code to check if the device is on
    const isOn = this.deviceState.isConnected;

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  setRemoteKey(newValue: CharacteristicValue, callback: CharacteristicSetCallback) {

    let inputKey;
    let inputType;
    // implement your own code to check if the device is on
    switch(newValue) {
      case this.platform.Characteristic.RemoteKey.REWIND: {
        this.platform.log.debug('set Remote Key Pressed: REWIND');
        break;
      }
      case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
        this.platform.log.debug('set Remote Key Pressed: FAST_FORWARD');
        break;
      }
      case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
        this.platform.log.debug('set Remote Key Pressed: NEXT_TRACK');
        break;
      }
      case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
        this.platform.log.debug('set Remote Key Pressed: PREVIOUS_TRACK');
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_UP: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_UP');
        inputKey = 'up';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_DOWN');
        inputKey = 'down';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_LEFT');
        inputKey = 'left';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_RIGHT');
        inputKey = 'right';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.SELECT: {
        this.platform.log.debug('set Remote Key Pressed: SELECT');
        inputKey = 'a';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.BACK: {
        this.platform.log.debug('set Remote Key Pressed: BACK');
        inputKey = 'b';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.EXIT: {
        this.platform.log.debug('set Remote Key Pressed: EXIT');
        inputKey = 'nexus';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
        this.platform.log.debug('set Remote Key Pressed: PLAY_PAUSE');
        inputKey = 'playpause';
        inputType = 'media';
        break;
      }
      case this.platform.Characteristic.RemoteKey.INFORMATION: {
        this.platform.log.debug('set Remote Key Pressed: INFORMATION');
        inputKey = 'nexus';
        inputType = 'input';
        break;
      }
    }

    // TODO: send input

    callback(null);
  }

  setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // TODO: set volume

    /* // 0 = up, 1 = down
    this.platform.log.debug('setVolume called with: ' + value);

    if(this.deviceState.webApiEnabled === false){

      this.SGClient.getManager('tv_remote').sendIrCommand(value?'btn.vol_down':'btn.vol_up').then(() => {
        this.platform.log.debug('Sent command ', value?'vol_down':'vol_up');
        // this.SGClient.getManager('system_input').sendCommand(value?'vol_down':'vol_up').then((response) => {
        // platform.log("Send input key:", input_key);
        callback(null);
  
      }).catch((error) => {
        this.platform.log.info('Error sending key input', value?'vol_down':'vol_up', error);
        callback(null);
      });

    } else {

      this.ApiClient.isAuthenticated().then(() => {
        this.ApiClient.getProvider('smartglass')._sendCommand(this.accessory.context.device.liveid, 'Audio', 'Volume', [{
          'direction': (value ? 'Down':'Up'), 'amount': 1,
        }]).then(() => {
          this.platform.log.debug('Sent volume command to xbox via Xbox api');
        }).catch((error ) => {
          this.platform.log.debug('Failed to send volume command to xbox via Xbox api:', error);
        });
      }).catch((error) => {
        this.platform.log.info('Failed to authenticate user:', error);
      }); */

    callback(null);

  }
    

  // let command = this.device.codes.volume.up;
  // if (value === this.platform.Characteristic.VolumeSelector.DECREMENT) {
  //   command = this.device.codes.volume.down;
  // }

  // this.socketClient.sendCommand('IR-SEND', command)
  //   .catch((e) => this.platform.log.error(e));
  // this.platform.log.debug('Sending code: ' + command);
  // callback(null);

  setCurrentApplication(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // this.launchApp(this.accessory.context.config.liveid, this.appMap[newValue.toString()].name, newValue)
    this.platform.log.debug('setCurrentApplication() invoked to ->', value);

    /* const newValue = parseInt(value.toString())-1;
    const inputSourceTitleId = this.inputSources[newValue].title_id;

    if(this.deviceState.webApiEnabled === true){

      if(inputSourceTitleId !== undefined){
        // Got titleid, launch app.
        this.ApiClient.isAuthenticated().then(() => {
          this.getAppByTitleId(inputSourceTitleId).then((result:any) => {
            // console.log('Launch product id:', result.ProductId);

            this.ApiClient.getProvider('smartglass').launchApp(this.accessory.context.device.liveid, result.ProductId).then(() => {
              this.platform.log.debug('Launched app:', result.Title, '('+result.ProductId+')');
              this.service.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, value);

            }).catch((error: any) => {
              this.platform.log.info('Rejected app launch (launchApp)', error);
            });
          }).catch((error: any) => {
            this.platform.log.info('Rejected app launch (getAppByTitleId)', error);
          });
        }).catch((error: any) => {
          this.platform.log.info('Rejected app launch (isAuthenticated)', error);
        });
      }
    } else {
      this.platform.log.info('Failed to launch app:', inputSourceTitleId);
      this.platform.log.info('Launching apps is not possible when you are not logged in to the Xbox api. Make sure the Xbox api functionalities are enabled.');
    } */

    // TODO: change input

    callback(null, value);
  }

  getCurrentApplication(callback: CharacteristicSetCallback) {
    // let activeInputId = 1;

    // if(this.deviceState.isConnected === true){
    //   activeInputId = this.getAppId(this.deviceState.currentAumId, this.deviceState.currentTitleId);
    //   this.platform.log.debug('getCurrentApplication() returned', activeInputId);
    // }

    // TODO: get input

    callback(null, 0);
  }

}
