import {HisenseMQTTClient} from '../../hisenseMQTTClient.js';
import {SubscriptExitCode} from './subscriptShutdownHandler.type.js';
import readline from 'node:readline/promises';

export function listenToMqtt(rl: readline.Interface, mqttClient: HisenseMQTTClient, path: string): SubscriptExitCode {
  mqttClient.mqttClient.on('connect', () => {
    mqttClient.mqttClient.on('message', (topic, message) => {
      rl.write(`Received message on topic ${topic}: ${message.toString()}\n`);
    });
    mqttClient.subscribe(path);
  });

  mqttClient.mqttClient.on('disconnect', () => {
    rl.write('Disconnected from MQTT server\n');
  });

  return 0;
}

// export const {function, help, args}