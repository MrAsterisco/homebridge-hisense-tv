#!/usr/bin/env node

import {parseArgs} from 'node:util';
import {HisenseMQTTClient} from '../hisenseMQTTClient.js';
import readline from 'node:readline/promises';

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
  get: {
    type: 'string',
  },
} as const;
const {values} = parseArgs({args, options});

const sslMode = values['no-ssl'] ? 'disabled' : 'custom';
const sslCertificate = (values['certfile'] ?? '') as string;
const sslPrivateKey = (values['keyfile'] ?? '') as string;
const macaddress = values['mac'];
const hostname = values['hostname'];
const action = values['get'] as string;

if(values['help'] || macaddress == null || hostname == null) {

  rl.write('Usage: hisense-tv-authorize --hostname <hostname> --mac <macaddress> [--no-ssl] [--certfile <certfile>] [--keyfile <keyfile>]\n');
  rl.write('Options:\n');
  rl.write('  --hostname <hostname>  IP address of the TV\n');
  rl.write('  --mac <macaddress>     MAC address of the Homebridge instance\n');
  rl.write('  --no-ssl               Disable SSL connection\n');
  rl.write('  --certfile <certfile>  Path to the certificate file\n');
  rl.write('  --keyfile <keyfile>    Path to the private key file\n');
  rl.write('  --help                 Display this help message\n');


  process.exit(0);
}

const getCommands = {
  state: 'gettvstate',
  sources: 'sourcelist',
  volume: 'getvolume',
};


if(!(action in getCommands)) {
  rl.write('Invalid get command\n');
  rl.write('Please use one of the following: state, sources, volume\n');
  process.exit(1);
}

const logger = {
  error: rl.write,
};

try{
  const mqttHelper = new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress, logger);

  mqttHelper.mqttClient.on('connect', () => {

    mqttHelper.callService('ui_service', getCommands[action]);
    mqttHelper.mqttClient.end(() => {
      process.exit(0);
    });
  });

}catch (e) {
  rl.write('Connection failed\n');
  rl.write('Please check if the TV is on and connected to the same network\n');
  rl.write('In case the TV doesn\'t need a ssl connection, use the --no-ssl flag\n');
  rl.write('In case the TV needs a custom ssl connection, use the --certfile and --keyfile flags\n');
  rl.write('Error message: ' + (e as Error).message + '\n');
  rl.write('Error stack: ' + (e as Error).stack);

  process.exit(1);
}
