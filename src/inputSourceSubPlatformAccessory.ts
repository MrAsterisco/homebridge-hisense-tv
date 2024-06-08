import {Characteristic, CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {InputSource} from './interfaces/input-source.interface';
import {TVApp} from './interfaces/tv-app.interface';

export class InputSourceSubPlatformAccessory {
  constructor(public service: typeof Service, public accessory: PlatformAccessory, public characteristic: typeof Characteristic ) {
  }

  public createInputService(identifier: string){
    return this.accessory.getService(identifier)
      || this.accessory.addService(this.service.InputSource, identifier, identifier);
  }

  public createUnknownSource(){
    const inputService = this.createInputService('inputhome');

    this.setCharacteristics(inputService, 0, 'Unknown', 'Unknown', this.characteristic.InputSourceType.OTHER);
    return inputService;
  }

  public addTVInputSource(inputSource: InputSource, identifier: number) {
    const inputService = this.createInputService('input' + inputSource.sourceid);

    const inputSourceType = this.getInputSourceTypeFromSourceName(inputSource.sourcename);

    this.setCharacteristics(inputService, identifier, inputSource.displayname, inputSource.sourcename, inputSourceType);

    return inputService;
  }

  public addAppInputSource(app: TVApp, identifier: number) {
    const inputService = this.createInputService('app' + app.name);

    this.setCharacteristics(inputService, identifier, app.name, app.name, this.characteristic.InputSourceType.APPLICATION);
    return inputService;
  }

  public getInputSourceTypeFromSourceName(sourceName: string){
    let inputType = this.characteristic.InputSourceType.OTHER;
    if (sourceName === 'TV') {
      inputType = this.characteristic.InputSourceType.TUNER;
    } else if (sourceName === 'AV') {
      inputType = this.characteristic.InputSourceType.COMPOSITE_VIDEO;
    } else if (sourceName.startsWith('HDMI')) {
      inputType = this.characteristic.InputSourceType.HDMI;
    }
    return inputType;
  }

  public setCharacteristics(inputService: Service, identifier: number, configuredName: string, sourceName: string, inputType: CharacteristicValue){
    inputService
      .setCharacteristic(this.characteristic.Identifier, identifier)
      .setCharacteristic(this.characteristic.IsConfigured, this.characteristic.IsConfigured.CONFIGURED)
      .setCharacteristic(this.characteristic.ConfiguredName, configuredName)
      .setCharacteristic(this.characteristic.Name, sourceName)
      .setCharacteristic(this.characteristic.CurrentVisibilityState, this.characteristic.CurrentVisibilityState.SHOWN)
      .setCharacteristic(this.characteristic.InputSourceType, inputType);
  }
}