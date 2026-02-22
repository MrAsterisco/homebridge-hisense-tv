import { Logging } from 'homebridge';
import wol from 'wol';
import os from 'node:os';

/**
 * Convert IPv4 string (e.g. "192.168.1.5") to a 32-bit unsigned int
 */
const ipv4ToInt = (ip: string) => ip.split('.').reduce((n, o) => (n << 8) + (+o), 0) >>> 0;

/**
 * Convert 32-bit unsigned int back to dotted IPv4 string
 */
const intToIpv4 = (n: number) => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');

/**
 * Check whether two IPv4 addresses are in the same subnet given a netmask
 */
const sameSubnet = (ipA: string, ipB: string, mask: string) => {
  const a = ipv4ToInt(ipA);
  const b = ipv4ToInt(ipB);
  const m = ipv4ToInt(mask);
  return ((a & m) >>> 0) === ((b & m) >>> 0);
};

/**
 * Calculate the directed broadcast address for an IP + netmask
 */
const directedBroadcast = (ip: string, mask: string) => {
  const ipN = ipv4ToInt(ip);
  const m = ipv4ToInt(mask);
  const bcast = (ipN | (~m >>> 0)) >>> 0; // equivalent to ((ipN & m) | (~m >>> 0))
  return intToIpv4(bcast);
};


interface Nic {
    localIp: string;
    netmask: string;
}

/**
 * Wake on Lan
 */
export class WoL {
  /**
   * @param log Homebridge logger
   * @param macAddress MAC address of the device to wake up
   * @param tvIp IP address of the device to wake up
   * @param retries Number of retries to send the magic packet
   * @param interval Interval between retries in milliseconds
   * @param broadcast (Optional) Broadcast address to use. If not provided, the broadcast address will be calculated based on the NIC in the same subnet as the TV IP address.
   */
  constructor(private log: Logging, private macAddress: string, private tvIp: string, private retries: number, private interval: number, private broadcast: string|undefined) {
  }


  /**
   * Picks a network interface card (NIC) that is in the same subnet as the TV IP address.
   * @param tvIp
   */
  public pickNicFor(tvIp: string): Nic|undefined {
    const nics = [] as Nic[];
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal && a.netmask && sameSubnet(tvIp, a.address, a.netmask)) {
          nics.push({ localIp: a.address, netmask: a.netmask });
        }
      }
    }

    if(nics.length === 1){
      return nics[0];
    }else if(nics.length > 1){
      this.log.info('Multiple NICs found in same subnet as ' + tvIp);
      this.log.info('Please configure a broadcast address manually in case the TV does not wake up.');

      // return the one with the most specific network mask (i.e. the highest number of bits set to 1)
      return nics.sort((a, b) => ipv4ToInt(b.netmask) - ipv4ToInt(a.netmask))[0];
    }else{
      this.log.warn('No NIC found in same subnet as ' + tvIp + ', please configure a broadcast address manually.');

      return undefined;
    }

  }

  private async sendPackets(ipAddress: string|undefined, attempt = 0) {
    if (attempt < this.retries) {
      try {
        await wol.wake(this.macAddress, ipAddress ? { address: ipAddress } : undefined);
        this.log.debug('Send Wake On Lan');
      } catch (error) {
        this.log.error('An error occurred while sending WoL: ' + error);
      }finally {
        setTimeout(() => {
          this.sendPackets(ipAddress, attempt + 1);
        }, this.interval ?? 400);
      }
    }
  }

  /**
     * Triggers sending the magic packet to wake up the TV.
     */
  public sendMagicPacket() {
    // if we have a broadcast address, we don't need to pick a NIC
    const nic = this.broadcast ? undefined : this.pickNicFor(this.tvIp);

    if(nic){
      this.log.debug('Using NIC with local IP ' + nic.localIp + ' and netmask ' + nic.netmask);
      // send additional packets to the directed broadcast address of the NIC
      void this.sendPackets(directedBroadcast(nic.localIp, nic.netmask));
    }
    if(this.broadcast){
      void this.sendPackets(this.broadcast);
    }

    // always send additional packets to the tvIp directly
    void this.sendPackets(this.tvIp);
  }
}