import {HisenseMQTTClient} from '../../hisenseMQTTClient.js';
import {SubscriptExitCode} from './subscriptShutdownHandler.type.js';
import readline from 'node:readline/promises';
import path from 'path';
import {clearTimeout} from 'node:timers';

export function authorize(rl: readline.Interface, mqttHelper: HisenseMQTTClient): SubscriptExitCode {
  const aborter = new AbortController();
  let timeout: NodeJS.Timeout|undefined;
  mqttHelper.mqttClient.on('connect', () => {
    // trigger the tv to show the pairing code
    mqttHelper.callService('ui_service', 'gettvstate');

    // also trigger the tv to send the source list
    // to check if we are already authorized
    // source list uses the device identifier (mac)
    // thus it's better to use than the state
    // as the state could also be sent by other devices
    mqttHelper.subscribe(mqttHelper._SOURCE_LIST_TOPIC);
    mqttHelper.callService('ui_service', 'sourcelist');
  });

  mqttHelper.mqttClient.on('message', (topic, message) => {
    const strMessage = message.toString();
    if(strMessage.length === 0) {
      rl.write(`Received empty message on ${topic}`);
      return;
    }
    const data = JSON.parse(strMessage);
    if(topic === mqttHelper._SOURCE_LIST_TOPIC){
      aborter.abort();
      rl.write('\nMac address is already authorized!\n');
      process.exit(0);
    } else if(data != null && typeof data === 'object' && 'result' in data) {
      if(timeout !== undefined) {
        clearTimeout(timeout);
      }
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
    const code = await rl.question('Please enter the 4-digit code shown on tv: ', { signal: aborter.signal });
    mqttHelper.subscribe(path.join(mqttHelper._COMMUNICATION_TOPIC, '#'));
    timeout = setTimeout(() => {
      rl.write('Timeout\n');
      process.exit(1);
    }, 8000);
    mqttHelper.sendAuthCode(code);
  })();

  return 0;
}