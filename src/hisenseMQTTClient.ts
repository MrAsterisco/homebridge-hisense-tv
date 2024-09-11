import * as mqtt from 'mqtt';
import path from 'path';
import {DeviceConfig} from './interfaces/device-config.interface.js';
import fs from 'node:fs';

/**
 * HisenseMQTTClient
 * This class is used to interact with the MQTT server on the TV
 * We also store all useful topics in this class
 *
 */
export class HisenseMQTTClient {
  public _BASE_TOPIC : string;
  public _STATE_TOPIC: string;
  public _DEVICE_TOPIC: string;
  public _COMMUNICATION_TOPIC: string;
  public _SOURCE_LIST_TOPIC : string;
  public _APP_LIST_TOPIC : string;
  public _PICTURE_SETTINGS_TOPIC : string;
  public _DEVICE_PICTURE_SETTINGS_TOPIC : string;

  public mqttClient: mqtt.MqttClient;

  constructor(public deviceConfig: Pick<DeviceConfig, 'sslmode' | 'ipaddress' | 'sslcertificate' | 'sslprivatekey'>,
    macaddress: string, private log: {error: (message: string) => void}, connectionTimeout?: number) {

    this._BASE_TOPIC = path.join('/', 'remoteapp', 'mobile');
    this._STATE_TOPIC = path.join(this._BASE_TOPIC, 'broadcast', 'ui_service', 'state');
    this._DEVICE_TOPIC = `${macaddress.toUpperCase()}$normal`;
    this._COMMUNICATION_TOPIC = path.join(this._BASE_TOPIC, this._DEVICE_TOPIC, 'ui_service', 'data');
    this._APP_LIST_TOPIC = path.join(this._COMMUNICATION_TOPIC, 'applist');
    this._SOURCE_LIST_TOPIC = path.join(this._COMMUNICATION_TOPIC, 'sourcelist');
    this._PICTURE_SETTINGS_TOPIC = path.join(this._BASE_TOPIC, 'broadcast', 'platform_service', 'data', 'picturesetting');
    this._DEVICE_PICTURE_SETTINGS_TOPIC = path.join(this._BASE_TOPIC, this._DEVICE_TOPIC, 'platform_service', 'data', 'picturesetting');

    let key: Buffer|null = null;
    let cert: Buffer|null = null;

    if(this.deviceConfig.sslmode === 'custom') {
      try{
        key = fs.readFileSync(this.deviceConfig.sslprivatekey);
        cert = fs.readFileSync(this.deviceConfig.sslcertificate);
      }catch (e){
        this.log.error('Could not read certificate or key file');
        this.log.error('Continuing with SSL but no certificate or key');
      }
    }

    this.mqttClient = mqtt.connect({
      port: 36669,
      host: this.deviceConfig.ipaddress,
      key: key,
      cert: cert,
      username: 'hisenseservice',
      password: 'multimqttservice',
      connectTimeout: connectionTimeout,
      rejectUnauthorized: false,
      queueQoSZero: false,
      protocol: this.deviceConfig.sslmode === 'disabled' ? 'mqtt' : 'mqtts',
    } as mqtt.IClientOptions);
  }

  public callService(service: string, action: string, payload?: string) {
    const topic = path.join('/', 'remoteapp', 'tv', service, this._DEVICE_TOPIC, 'actions', action);
    if(this.mqttClient.disconnected || this.mqttClient.disconnecting) {
      this.log.error('Sending message to TV failed - MQTT client is disconnected');
      this.log.error(Error().stack ?? '');
      return;
    }else {
      this.mqttClient.publish(topic, payload ?? '');
    }
  }

  public changeSource(sourceId: string) {
    this.callService('ui_service', 'changesource', JSON.stringify({'sourceid': sourceId}));
  }

  /**
   * Send a command to the TV to open an app
   * Different TVs need different parameters (appId is mandatory for some for others it is not)
   */
  public changeApp(name: string, appId: string, url: string, urlType: number|string, storeType: number) {
    this.callService('ui_service', 'launchapp', JSON.stringify({'name': name, 'appId': appId, 'url': url, 'urlType': urlType, 'storeType': storeType}));
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