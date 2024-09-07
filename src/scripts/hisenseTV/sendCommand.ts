import readline from 'node:readline/promises';
import {HisenseMQTTClient} from '../../hisenseMQTTClient.js';

const getCommands = {
  state: 'gettvstate',
  sources: 'sourcelist',
  volume: 'getvolume',
};

export function sendCommand(rl: readline.Interface, mqttHelper: HisenseMQTTClient, command: string) {
  if(!(command in getCommands)) {
    rl.write(`Invalid --get command ${command}\n`);
    rl.write('Please use one of the following: state, sources, volume\n');
    process.exit(1);
  }

  mqttHelper.mqttClient.on('connect', () => {

    mqttHelper.callService('ui_service', getCommands[command]);
    mqttHelper.mqttClient.end(() => {
      process.exit(0);
    });
  });
}