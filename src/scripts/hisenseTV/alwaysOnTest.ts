import {SubscriptExitCode} from './subscriptShutdownHandler.type.js';
import readline from 'node:readline/promises';
import {HisenseMQTTClient} from '../../hisenseMQTTClient.js';
import {PictureSetting} from '../../interfaces/picturesetting.interface.js';

/**
 * function has to be called only when tv is on
 * @param rl
 * @param mqttHelper
 */
export function alwaysOnTest(rl: readline.Interface, mqttHelper: HisenseMQTTClient): SubscriptExitCode {
  let pictureSettingsOff: null|PictureSetting = null;

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

  return 0;
}