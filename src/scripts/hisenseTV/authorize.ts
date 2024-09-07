import {HisenseMQTTClient} from '../../hisenseMQTTClient.js';
import {SubscriptExitCode} from './subscriptShutdownHandler.type.js';
import readline from 'node:readline/promises';
import path from 'path';

export function authorize(rl: readline.Interface, mqttHelper: HisenseMQTTClient): SubscriptExitCode {
  mqttHelper.mqttClient.on('connect', () => {
    mqttHelper.callService('ui_service', 'gettvstate');
  });
  mqttHelper.mqttClient.on('message', (topic, message) => {
    const strMessage = message.toString();
    if(strMessage.length === 0) {
      rl.write(`Received empty message on ${topic}`);
      return;
    }
    const data = JSON.parse(strMessage);
    if(data != null && typeof data === 'object' && 'result' in data) {
      mqttHelper.mqttClient.end(true);
      if(data.result !== 1) {
        rl.write('TV pairing failed - please try again');
        rl.write(message.toString());
        process.exit(1);
      }
      rl.write('TV successfully paired\n');
      process.exit(0);
    }else{
      rl.write(`Received message on topic ${topic}: ${strMessage}\n`);
    }
  });

  (async () => {
    const code = await rl.question('Please enter the 4-digit code shown on tv: ');
    mqttHelper.subscribe(path.join(mqttHelper._COMMUNICATION_TOPIC, '#'));
    mqttHelper.sendAuthCode(code);
  })();

  return 0;
}