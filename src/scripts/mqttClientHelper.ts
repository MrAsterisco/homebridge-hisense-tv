import {SSLMode} from '../types/ssl-mode.type.js';
import {HisenseMQTTClient} from '../hisenseMQTTClient.js';
import path from 'path';
import readline from 'node:readline/promises';
import {ReadlineLogger} from './readlineLogger.interface.js';
import {terminateWithError} from './terminationHelper.js';

export function createMQTTClient(sslMode: SSLMode, hostname: string, sslCertificate: string, sslPrivateKey: string, macaddress: string, logger: ReadlineLogger) {
  return new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress, logger, 4000);
}

export function registerMQTTErrorHandler(mqttHelper: HisenseMQTTClient, rl: readline.Interface) {
  mqttHelper.mqttClient.on('error', (error) => {
    terminateWithError(rl, error);
  });
}

export function registerExitHandler(rl: readline.Interface, mqttHelper: HisenseMQTTClient) {
  process.on('SIGINT', () => {
    rl.write('Exiting...\n');
    mqttHelper.mqttClient.end(() => {
      rl.close();
      process.exit(0);
    });
  });
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
        rl.write('\n\nIt seems this mac address is not authorized yet. Please run the authorize command first.\n\n');
        process.exit(1);
      }
    });
    mqttHelper.mqttClient.subscribe(path.join(mqttHelper._COMMUNICATION_TOPIC, 'authentication'));
  });
}