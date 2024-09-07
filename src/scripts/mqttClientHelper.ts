import {SSLMode} from '../types/ssl-mode.type.js';
import {HisenseMQTTClient} from '../hisenseMQTTClient.js';
import path from 'path';
import readline from 'node:readline/promises';
import {ReadlineLogger} from './readlineLogger.interface.js';

export function createMQTTClient(sslMode: SSLMode, hostname: string, sslCertificate: string, sslPrivateKey: string, macaddress: string, logger: ReadlineLogger) {
  return new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress, logger);
}

/**
 * Logs message if mac address is not authorized
 * @param mqttHelper
 * @param rl
 */
export function enableAuthorizationWatcher(mqttHelper: HisenseMQTTClient, rl: readline.Interface){
  mqttHelper.mqttClient.on('connect', () => {
    const authTopic = path.join(mqttHelper._COMMUNICATION_TOPIC, 'authentication');
    mqttHelper.mqttClient.on('message', (topic, _) => {
      if(topic === authTopic) {
        rl.write('It seems this mac address is not authorized yet. Please run the authorize command first.\n');
      }
    });
    mqttHelper.mqttClient.subscribe(path.join(mqttHelper._COMMUNICATION_TOPIC, 'authentication'));
  });
}