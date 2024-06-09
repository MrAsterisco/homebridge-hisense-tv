#!/usr/bin/env node

import {HisenseMQTTClient} from '../hisenseMQTTClient.js';
import {parseArgs} from 'node:util';
import * as readline from 'node:readline/promises';
import path from 'path';


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


const args = process.argv.slice(2);
const options = {
  'no-ssl': {
    type: 'boolean',
    default: false,
  },
  hostname: {
    type: 'string',
  },
  certfile: {
    type: 'string',
  },
  keyfile: {
    type: 'string',
  },
  mac: {
    type: 'string',
  },
} as const;
const {values} = parseArgs({args, options});

const sslMode = values['no-ssl'] ? 'disabled' : 'custom';
const sslCertificate = (values['certfile'] ?? '') as string;
const sslPrivateKey = (values['keyfile'] ?? '') as string;
const macaddress = values['mac'] as string;
const hostname = values['hostname'] as string;

const mqttHelper = new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress);

mqttHelper.mqttClient.on('connect', () => {
  mqttHelper.callService('ui_service', 'gettvstate');
});
mqttHelper.mqttClient.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  if(data != null && typeof data === 'object' && 'result' in data) {
    if(data.result !== 1) {
      rl.write('TV pairing failed - please try again');
    }
    mqttHelper.mqttClient.end(true);
    process.exit(0);
  }
});

(async () => {
  const code = await rl.question('Please enter the 4-digit code shown on tv: ');
  mqttHelper.subscribe(path.join(mqttHelper._COMMUNICATION_TOPIC, '#'));
  mqttHelper.sendAuthCode(code);
})();