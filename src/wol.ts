import {Logging} from 'homebridge';
import wol from 'wol';

/**
 * Wake on Lan
 */
export class WoL {
  /**
   * @param log Homebridge logger
   * @param macAddress MAC address of the device to wake up
   * @param retries Number of retries to send the magic packet
   * @param interval Interval between retries in milliseconds
   */
  constructor(private log: Logging, private macAddress: string, private retries: number, private interval: number){
  }


  /**
   * Send the magic packet to wake up the device
   * @param attempt Current attempt
   */
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