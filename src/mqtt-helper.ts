import * as mqtt from 'mqtt';
import path from 'path';
import {DeviceConfig} from './interfaces/device-config.interface';
import fs from 'node:fs';

export class MqttHelper {
  public _BASE_TOPIC : string;
  public _STATE_TOPIC: string;
  public _DEVICE_TOPIC: string;
  public _COMMUNICATION_TOPIC: string;
  public _SOURCE_LIST_TOPIC : string;
  public _APP_LIST_TOPIC : string;
  public _PICTURE_SETTINGS_TOPIC : string;

  public mqttClient: mqtt.MqttClient;

  constructor(public deviceConfig: Pick<DeviceConfig, 'sslmode' | 'ipaddress' | 'sslcertificate' | 'sslprivatekey'>, macaddress: string) {
    this._BASE_TOPIC = path.join('/', 'remoteapp', 'mobile');
    this._STATE_TOPIC = path.join(this._BASE_TOPIC, 'broadcast', 'ui_service', 'state');
    this._DEVICE_TOPIC = `${macaddress.toUpperCase()}$normal`;
    this._COMMUNICATION_TOPIC = path.join(this._BASE_TOPIC, this._DEVICE_TOPIC, 'ui_service', 'data');
    this._APP_LIST_TOPIC = path.join(this._COMMUNICATION_TOPIC, 'applist');
    this._SOURCE_LIST_TOPIC = path.join(this._COMMUNICATION_TOPIC, 'sourcelist');
    this._PICTURE_SETTINGS_TOPIC = path.join(this._BASE_TOPIC, 'broadcast', 'platform_service', 'data', 'picturesetting');

    let key: Buffer|null = null;
    let cert: Buffer|null = null;

    if(this.deviceConfig.sslmode === 'custom') {
      key = fs.readFileSync(this.deviceConfig.sslprivatekey);
      cert = fs.readFileSync(this.deviceConfig.sslcertificate);
    }

    this.mqttClient = mqtt.connect({
      port: 36669,
      host: this.deviceConfig.ipaddress,
      key: key,
      cert: cert,
      username: 'hisenseservice',
      password: 'multimqttservice',
      rejectUnauthorized: false,
      queueQoSZero: false,
      protocol: this.deviceConfig.sslmode === 'disabled' ? 'mqtt' : 'mqtts',
    } as mqtt.IClientOptions);
  }

  public callService(service: string, action: string, payload?: string) {
    const topic = path.join('/', 'remoteapp', 'tv', service, this._DEVICE_TOPIC, 'actions', action);
    this.mqttClient.publish(topic, payload ?? '');
  }

  public changeSource(sourceId: string) {
    this.callService('ui_service', 'changesource', JSON.stringify({'sourceid': sourceId}));
  }

  public changeApp(name: string, url: string, urlType: number|string, storeType: number) {
    this.callService('ui_service', 'launchapp', JSON.stringify({'name': name, 'url': url, 'urlType': urlType, 'storeType': storeType}));
  }

  public sendKey(key) {
    this.callService('remote_service', 'sendkey', key);
  }

  public subscribe(topic: string){
    this.mqttClient.subscribe(topic);
  }

  public sendAuthCode(code: string) {
    this.callService('ui_service', 'authenticationcode', JSON.stringify({'authNum': code}));
  }
}