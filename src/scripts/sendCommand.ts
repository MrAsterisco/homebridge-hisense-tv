#!/usr/bin/env node

import {parseArgs} from 'node:util';
import {HisenseMQTTClient} from '../hisenseMQTTClient';
import readline from 'node:readline/promises';

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
  get: {
    type: 'string',
  },
} as const;
const {values} = parseArgs({args, options});

const sslMode = values['no-ssl'] ? 'disabled' : 'custom';
const sslCertificate = (values['certfile'] ?? '') as string;
const sslPrivateKey = (values['keyfile'] ?? '') as string;
const macaddress = values['mac'] as string;
const hostname = values['hostname'] as string;
const action = values['get'] as string;

const getCommands = {
  state: 'gettvstate',
  source: 'sourcelist',
  volume: 'getvolume',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

if(!(action in getCommands)) {
  rl.write('Invalid get command\n');
  rl.write('Please use one of the following: state, source, volume\n');
  process.exit(1);
}

try{
  const mqttHelper = new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress);

  mqttHelper.mqttClient.on('connect', () => {

    mqttHelper.callService('ui_service', getCommands[action]);
    mqttHelper.mqttClient.end(() => {
      process.exit(0);
    });
  });

}catch (e) {
  rl.write('Connection failed\n');
  rl.write('Please check if the TV is on and connected to the same network\n');
  rl.write('In case the TV doesn\t need a ssl connection, use the --no-ssl flag\n');
  rl.write('In case the TV needs a custom ssl connection, use the --certfile and --keyfile flags\n');
  rl.write('Error message: ' + (e as Error).message);

  process.exit(1);
}
