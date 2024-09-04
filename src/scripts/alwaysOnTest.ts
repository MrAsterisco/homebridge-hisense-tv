#!/usr/bin/env node

import {HisenseMQTTClient} from '../hisenseMQTTClient.js';
import {parseArgs} from 'node:util';
import * as readline from 'node:readline/promises';
import {PictureSetting} from '../interfaces/picturesetting.interface.js';


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

const sslMode = values['no-ssl'] ? 'disabled' : 'custom';
const sslCertificate = (values['certfile'] ?? '') as string;
const sslPrivateKey = (values['keyfile'] ?? '') as string;
const macaddress = values['mac'];
const hostname = values['hostname'];


if(values['help'] || macaddress == null || hostname == null) {

  rl.write('Usage: hisense-tv-always-on-test --hostname <hostname> --mac <macaddress> [--no-ssl] [--certfile <certfile>] [--keyfile <keyfile>]\n');
  rl.write('Options:\n');
  rl.write('  --hostname <hostname>  IP address of the TV\n');
  rl.write('  --mac <macaddress>     MAC address of the Homebridge instance (the same one used for the authenticate script)\n');
  rl.write('  --no-ssl               Disable SSL connection\n');
  rl.write('  --certfile <certfile>  Path to the certificate file\n');
  rl.write('  --keyfile <keyfile>    Path to the private key file\n');
  rl.write('  --help                 Display this help message\n');
    

  process.exit(0);
}


let pictureSettingsOff: null|PictureSetting = null;

const logger = {
  error: rl.write,
};

(async () => {
  rl.write('Running first test to determine if TV is always on or off\n');
  await rl.question('Turn your TV off now and press enter when ready: ');
  rl.write('\nWait for a few seconds...\n');
  try {
    const mqttHelper = new HisenseMQTTClient({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress, logger);
    const timeout = setTimeout(() => {
      mqttHelper.mqttClient.end(true);
      rl.write('Could not detect always on TV\n');
      process.exit(0);
    }, 5000);

    mqttHelper.mqttClient.on('connect', () => {
      clearTimeout(timeout);
      rl.write('Always on TV detected\n');

      rl.write('Running second test to determine if Always On TV has Fake Sleep Mode\n');
      rl.write('Wait for a few seconds...\n');

      mqttHelper.mqttClient.on('message', async (topic, message) => {
        const data = JSON.parse(message.toString());
        if(topic === mqttHelper._STATE_TOPIC) {
          mqttHelper.mqttClient.unsubscribe(mqttHelper._STATE_TOPIC);
          if('statetype' in data && data['statetype'].startsWith('fake_sleep')) {
            rl.write('Possible Always On TV with Fake Sleep Detected: ' + data['statetype'] + '\n');
          }else{
            rl.write('First test didn\'t detect always on mode.\n');
            rl.write('Continuing with Picture Settings Test\n');
            mqttHelper.subscribe(mqttHelper._PICTURE_SETTINGS_TOPIC);
            mqttHelper.callService('platform_service', 'picturesetting');
          }
        }else if(topic === mqttHelper._PICTURE_SETTINGS_TOPIC) {
          const pictureSettings = data as PictureSetting;
          if(pictureSettingsOff == null) {
            pictureSettingsOff = pictureSettings;
            mqttHelper.mqttClient.unsubscribe(mqttHelper._PICTURE_SETTINGS_TOPIC);
            await rl.question('Turn your TV on now and press enter when ready:');
            mqttHelper.subscribe(mqttHelper._PICTURE_SETTINGS_TOPIC);
            mqttHelper.callService('platform_service', 'picturesetting');
          }else {
            // find different objects in picture settings
            mqttHelper.mqttClient.end(true);
            const diff = pictureSettings.menu_info.filter((menu) => {
              const offMenu = pictureSettingsOff?.menu_info.find((offMenu) => offMenu.menu_id === menu.menu_id);
              return menu.menu_flag !== offMenu?.menu_flag;
            });

            if(diff.length > 0){
              rl.write('\nPicture Settings Always On Mode possible.\n');
            }

            diff.forEach(menu => {
              const oldMenu = pictureSettingsOff?.menu_info.find((offMenu) => offMenu.menu_id === menu.menu_id);

              rl.write(`\nMenu: ${menu.menu_name} with id ${menu.menu_id} has changed from ${oldMenu?.menu_flag} to ${menu.menu_flag}`);
            });
            process.exit(0);
          }
        }
      });
      mqttHelper.subscribe(mqttHelper._STATE_TOPIC);
      mqttHelper.callService('ui_service', 'gettvstate');
    });
  } catch (e) {
    rl.write('Connection failed\n');
    rl.write('Please check if the TV is on and connected to the same network\n');
    rl.write('In case the TV doesn\'t need a ssl connection, use the --no-ssl flag\n');
    rl.write('In case the TV needs a custom ssl connection, use the --certfile and --keyfile flags\n');
    rl.write('Error message: ' + (e as Error).message + '\n');
    rl.write('Error stack: ' + (e as Error).stack);

    process.exit(1);
  }
})();