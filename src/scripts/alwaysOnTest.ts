#!/usr/bin/env node

import {MqttHelper} from '../mqtt-helper';
import {parseArgs} from 'node:util';
import * as readline from 'node:readline/promises';
import {PictureSetting} from '../interfaces/picturesetting.interface';


if(require.main === module) {
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

  let pictureSettingsOff: null|PictureSetting = null;


  (async () => {
    rl.write('Running first test to determine if TV is always on or off');
    await rl.question('Turn your TV off now and press enter when ready: ');
    rl.write('Wait for a few seconds...');
    const mqttHelper = new MqttHelper({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, macaddress);
    const timeout = setTimeout(() => {
      mqttHelper.mqttClient.end(true);
      rl.write('Could not detect always on TV');
      process.exit(0);
    }, 5000);

    mqttHelper.mqttClient.on('connect', () => {
      clearTimeout(timeout);
      rl.write('Always on TV detected');

      rl.write('Running second test to determine if Always On TV has Fake Sleep Mode');
      rl.write('Wait for a few seconds...');

      mqttHelper.mqttClient.on('message', async (topic, message) => {
        const data = JSON.parse(message.toString());
        if(topic === mqttHelper._STATE_TOPIC) {
          mqttHelper.mqttClient.unsubscribe(mqttHelper._STATE_TOPIC);
          if('statetype' in data && 'tv_state_type' in data['statetype']) {
            rl.write('Possible Always On TV with Fake Sleep Detected: ' + data['statetype']['tv_state_type']);
          }else{
            rl.write('First test didn\'t detect always on mode.');
            rl.write('Continuing with Picture Settings Test');
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
              rl.write('Picture Settings Always On Mode possible.');
            }

            diff.forEach(menu => {
              const oldMenu = pictureSettingsOff?.menu_info.find((offMenu) => offMenu.menu_id === menu.menu_id);

              rl.write(`Menu: ${menu.menu_name} with id ${menu.menu_id} has changed from ${oldMenu?.menu_flag} to ${menu.menu_flag}`);
            });
            process.exit(0);
          }
        }
      });
      mqttHelper.subscribe(mqttHelper._STATE_TOPIC);
      mqttHelper.callService('ui_service', 'gettvstate');
    });
  })();
}