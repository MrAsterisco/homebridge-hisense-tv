import readline from 'node:readline/promises';

export function terminateWithHelpMessage(rl: readline.Interface, script: string) {
  rl.write(`Usage: hisense-tv ${script} --hostname <hostname> --mac <macaddress> [--no-ssl] [--certfile <certfile>] [--keyfile <keyfile>]\n`);
  rl.write('Options:\n');
  rl.write('  --hostname <hostname>  IP address of the TV\n');
  rl.write('  --mac <macaddress>     MAC address of the Homebridge instance\n');
  rl.write('  --no-ssl               Disable SSL connection\n');
  rl.write('  --certfile <certfile>  Path to the certificate file\n');
  rl.write('  --keyfile <keyfile>    Path to the private key file\n');
  if(script === 'send-mqtt-command') {
    rl.write('  --get <path>          Command to send. Either state, sources or volume\n');
  }
  if(script === 'listen-to-mqtt') {
    rl.write('  --path <path>          MQTT path to subscribe to. If not set every message will be logged\n');
  }
  rl.write('  --help                 Display this help message\n');


  process.exit(0);
}

export function terminateWithError(rl: readline.Interface, error: Error) {
  rl.write('Connection failed\n');
  rl.write('Please check if the TV is ON and connected to the same network\n');
  rl.write('In case the TV doesn\'t need a ssl connection, use the --no-ssl flag\n');
  rl.write('In case the TV needs a custom ssl connection, use the --certfile and --keyfile flags\n');
  rl.write('Error message: ' + error.message + '\n\n');
  rl.write('Error stack: ' + error.stack);

  process.exit(1);
}