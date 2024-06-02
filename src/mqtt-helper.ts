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

  constructor(public deviceConfig: DeviceConfig, ifname: string) {
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
      protocol: this.deviceConfig.sslmode === 'disabled' ? 'mqtt' : 'mqtts',
    } as mqtt.IClientOptions);
  }

  public callService(service: string, action: string, payload?: unknown) {
    const topic = path.join('/', 'remoteapp', 'tv', service, this._DEVICE_TOPIC, 'actions', action);
    this.mqttClient.publish(topic, payload ? JSON.stringify(payload) : '');
  }

  public changeSource(sourceId: string) {
    this.callService('ui_service', 'changesource', {'sourceid': sourceId});
  }

  public sendKey(key) {
    this.callService('remote_service', 'sendKey', key);
  }

  public subscribe(topic: string){
    this.mqttClient.subscribe(topic);
  }
}