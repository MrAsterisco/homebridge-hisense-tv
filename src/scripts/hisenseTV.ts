#!/usr/bin/env node

import readline from 'node:readline/promises';
import {parseArgs} from 'node:util';
import {SSLMode} from '../types/ssl-mode.type.js';
import {listenToMqtt} from './hisenseTV/listenToMqtt.js';
import {authorize} from './hisenseTV/authorize.js';
import {alwaysOnTest} from './hisenseTV/alwaysOnTest.js';
import {createMQTTClient, enableAuthorizationWatcher, registerExitHandler, registerMQTTErrorHandler} from './mqttClientHelper.js';
import {terminateWithError, terminateWithHelpMessage} from './terminationHelper.js';
import {sendCommand} from './hisenseTV/sendCommand.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


const args = process.argv.slice(2);
const subscript = args.slice(0, 1);
const subscriptArgs = args.slice(1);

const subscripts = ['authorize', 'always-on-test', 'send-mqtt-command', 'listen-to-mqtt'];
const positionals = parseArgs({args: subscript, allowPositionals: true, strict: false}).positionals;

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

switch (script) {
  case 'send-mqtt-command':
    options['get'] = {type: 'string'};
    break;
  case 'listen-to-mqtt':
    options['path'] = {type: 'string', default: '#'};
    break;
}

const values = parseArgs({args: subscriptArgs, options}).values;

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
    case 'authorize':{
      (async () => {
        await rl.question('Please turn on your TV and press enter when ready: ');
        try{
          const mqttHelper = createMQTTClient(sslMode, hostname, sslCertificate, sslPrivateKey, macaddress, logger);
          registerExitHandler(rl, mqttHelper);
          registerMQTTErrorHandler(mqttHelper, rl);
          authorize(rl, mqttHelper);
        }catch (e){
          terminateWithError(rl, e as Error);
        }
      })();
      break;
    }
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
      registerExitHandler(rl, mqttHelper);
      registerMQTTErrorHandler(mqttHelper, rl);

      const get = options['get'];

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
      registerExitHandler(rl, mqttHelper);
      registerMQTTErrorHandler(mqttHelper, rl);

      const path = options['path'];
      listenToMqtt(rl, mqttHelper, (path ?? '#'));
      break;
    }
  }

}catch (e){
  terminateWithError(rl, e as Error);
}

