#!/usr/bin/env node

import {HisenseMQTTClient} from '../hisenseMQTTClient.js';
import {parseArgs} from 'node:util';
import * as readline from 'node:readline/promises';
import path from 'path';
import {SSLMode} from '../types/ssl-mode.type';


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
  help: {
    type: 'boolean',
    default: false,
  },
} as const;
const {values} = parseArgs({args, options});

let sslMode: SSLMode = values['no-ssl'] ? 'disabled' : 'custom';
const sslCertificate = (values['certfile'] ?? '') as string;
const sslPrivateKey = (values['keyfile'] ?? '') as string;
const macaddress = values['mac'];
const hostname = values['hostname'];

if(sslCertificate != '' && sslPrivateKey == '') {
  rl.write('Please provide a private key file\n');
  process.exit(1);
}
if(sslPrivateKey != '' && sslCertificate == '') {
  rl.write('Please provide a certificate file\n');
  process.exit(1);
}
if(sslPrivateKey == '' && sslCertificate == '') {
  sslMode = 'default';
}

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

const logger = {
  error: (message: string) => {
    rl.write(message + '\n');
  },
};

try {
  const mqttHelper = new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress, logger);

  mqttHelper.mqttClient.on('connect', () => {
    mqttHelper.callService('ui_service', 'gettvstate');
  });
  mqttHelper.mqttClient.on('message', (topic, message) => {
    const data = JSON.parse(message.toString());
    if(data != null && typeof data === 'object' && 'result' in data) {
      if(data.result !== 1) {
        rl.write('TV pairing failed - please try again');
        rl.write(message.toString());
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
} catch (e) {
  rl.write('Connection failed\n');
  rl.write('Please check if the TV is on and connected to the same network\n');
  rl.write('In case the TV doesn\'t need a ssl connection, use the --no-ssl flag\n');
  rl.write('In case the TV needs a custom ssl connection, use the --certfile and --keyfile flags\n');
  rl.write('Error message: ' + (e as Error).message + '\n');
  rl.write('Error stack: ' + (e as Error).stack);

  process.exit(1);
}