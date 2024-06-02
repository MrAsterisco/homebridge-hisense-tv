import * as mqtt from 'mqtt';
import path from 'path';
import {DeviceConfig} from './interfaces/device-config.interface';
import fs from 'node:fs';
import {networkInterfaces} from 'node:os';

export class MqttHelper {
  public _BASE_TOPIC : string;
  public _STATE_TOPIC: string;
  public _DEVICE_TOPIC: string;
  public _SOURCE_LIST_TOPIC : string;

  public mqttClient: mqtt.MqttClient;

  constructor(public deviceConfig: Pick<DeviceConfig, 'sslmode' | 'ipaddress' | 'sslcertificate' | 'sslprivatekey'>, ifname: string) {
    this._BASE_TOPIC = path.join('/', 'remoteapp', 'mobile');
    this._STATE_TOPIC = path.join(this._BASE_TOPIC, 'broadcast', 'ui_service', 'state');
    const interfaces = networkInterfaces();
    const interface_ = interfaces[ifname];
    if(interface_ === undefined) {
      throw new Error(`Interface ${ifname} not found`);
    }

    this._DEVICE_TOPIC = `${interface_[0].mac.toUpperCase()}$normal`;
    this._SOURCE_LIST_TOPIC = path.join(this._BASE_TOPIC, this._DEVICE_TOPIC, 'ui_service', 'data', 'sourcelist');

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