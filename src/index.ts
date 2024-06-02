import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { HiSenseTVPlatform } from './platform';
import {MqttHelper} from './mqtt-helper';
import {parseArgs} from 'node:util';
import * as readline from 'node:readline/promises';


if(require.main === module) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });


  const args = process.argv;
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
    ifname: {
      type: 'string',
    },
  };
  const {values} = parseArgs({args, options});

  const sslMode = values['no-ssl'] ? 'disabled' : 'custom';
  const sslCertificate = (values['certfile'] ?? '') as string;
  const sslPrivateKey = (values['keyfile'] ?? '') as string;
  const ifname = values['ifname'] as string;
  const hostname = values['hostname'] as string;

  const mqttHelper = new MqttHelper({sslmode: sslMode, ipaddress: hostname, sslcertificate: sslCertificate, sslprivatekey: sslPrivateKey}, ifname);
  mqttHelper.callService('ui_service', 'gettvstate');

  (async () => {
    const code = await rl.question('Please enter the 4-digit code shown on tv: ');
    mqttHelper.sendAuthCode(code);
  })();

}


/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, HiSenseTVPlatform);
};
