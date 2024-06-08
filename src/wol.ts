import {Logger} from 'homebridge';
import wol from 'wol';

export class WoL {
  constructor(private log: Logger, private macAddress: string, private retries: number, private interval: number){
  }


  public async sendMagicPacket(attempt = 0) {
    if(attempt < this.retries){
      try {
        await wol.wake(this.macAddress);
        this.log.debug('Send Wake On Lan');
        setTimeout(() => {
          this.sendMagicPacket(attempt + 1);
        }, this.interval ?? 400);
      } catch (error) {
        this.log.error('An error occurred while sending WoL: ' + error);
      }
    }
  }
}