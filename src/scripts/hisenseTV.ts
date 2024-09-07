#!/usr/bin/env node

import readline from 'node:readline/promises';
import {parseArgs} from 'node:util';
import {SSLMode} from '../types/ssl-mode.type.js';
import {listenToMqtt} from './hisenseTV/listenToMqtt.js';
import {authorize} from './hisenseTV/authorize.js';
import {alwaysOnTest} from './hisenseTV/alwaysOnTest.js';
import {createMQTTClient, enableAuthorizationWatcher} from './mqttClientHelper.js';
import {terminateWithError, terminateWithHelpMessage} from './terminationHelper.js';
import {sendCommand} from './hisenseTV/sendCommand.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


const args = process.argv.slice(2);

const subscripts = ['authorize', 'always-on-test', 'send-mqtt-command', 'listen-to-mqtt'];
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
const {values, positionals} = parseArgs({args, options, allowPositionals: true});

let sslMode: SSLMode = values['no-ssl'] ? 'disabled' : 'custom';
const sslCertificate = (values['certfile'] ?? '') as string;
const sslPrivateKey = (values['keyfile'] ?? '') as string;
const macaddress = values['mac'];
const hostname = values['hostname'];

if(sslCertificate !== '' && sslPrivateKey === '') {
  rl.write('Please provide a private key file with --keyfile\n');
  process.exit(1);
}
if(sslPrivateKey !== '' && sslCertificate === '') {
  rl.write('Please provide a certificate file with --certfile\n');
  process.exit(1);
}
if(sslPrivateKey === '' && sslCertificate === '') {
  sslMode = 'default';
}

if(positionals.length === 0 || !subscripts.includes(positionals[0])) {
  rl.write(`Usage: hisense-tv {${subscripts.join(',')}}\n`);
  rl.write('\nPositional arguments:\n');
  rl.write(`  {${subscripts.join(',')}}\n`);
  rl.write('  authorize     authorizes specific mac address to connect to TV\n');
  rl.write('  always-on-test     tests if TV is a always on TV or not\n');
  rl.write('  send-mqtt-command     sends a command to the TV\n');
  rl.write('  listen-to-mqtt     listens to mqtt messages\n');

  rl.write(`\nUse: hisense-tv {${subscripts.join(',')}} --help for more information\n`);

  process.exit(0);
}

const script = positionals[0];

if(values['help'] || macaddress == null || hostname == null) {
  terminateWithHelpMessage(rl, script);
  process.exit(0);
}

const logger = {
  error: (message: string) => {
    rl.write(message + '\n');
  },
};

try{
  switch(script) {
    case 'authorize':
      authorize(rl, createMQTTClient(sslMode, hostname, sslCertificate, sslPrivateKey, macaddress, logger));
      break;
    case 'always-on-test':
      (async () => {
        rl.write('Running first test to determine if TV is always on or off\n');
        await rl.question('Turn your TV OFF now and press enter when ready: ');
        rl.write('\nWait for a few seconds...\n');
        try {
          const mqttHelper = createMQTTClient(sslMode, hostname, sslCertificate, sslPrivateKey, macaddress, logger);
          enableAuthorizationWatcher(mqttHelper, rl);
          alwaysOnTest(rl, mqttHelper);
        } catch (e) {
          terminateWithError(rl, e as Error);
        }
      })();
      break;
    case 'send-mqtt-command': {
      const mqttHelper = createMQTTClient(sslMode, hostname, sslCertificate, sslPrivateKey, macaddress, logger);
      enableAuthorizationWatcher(mqttHelper, rl);

      const getValues = parseArgs({args, options: {get: {type: 'string'}}, allowPositionals: true}).values;

      const get = getValues['get'];

      if(get == null) {
        terminateWithHelpMessage(rl, script);
        // terminate so get is typed as not null
        process.exit(0);
      }
      sendCommand(rl, mqttHelper, get);
      break;
    }
    case 'listen-to-mqtt': {
      const mqttHelper = createMQTTClient(sslMode, hostname, sslCertificate, sslPrivateKey, macaddress, logger);
      enableAuthorizationWatcher(mqttHelper, rl);
      const pathValues = parseArgs({args, options: {path: {type: 'string'}}, allowPositionals: true}).values;

      const path = pathValues['path'];
      listenToMqtt(rl, mqttHelper, path ?? '#');
      break;
    }
  }

}catch (e){
  terminateWithError(rl, e as Error);
}

