import { HomebridgePluginUiServer } from '@homebridge/plugin-ui-utils';
import { connect, type MqttClient } from 'mqtt';
import os from 'os';
import fs from 'fs';

// ─── Types ───────────────────────────────────────────────────────────────────

type SslMode = 'default' | 'disabled' | 'custom';

interface MqttOpts {
  ipaddress: string;
  sslmode: SslMode;
  sslcertificate?: string;
  sslprivatekey?: string;
}

interface Topics {
  state: string;
  sourceList: string;
  appList: string;
  pictureDevice: string;
  commAll: string;
}

interface NetworkInterface {
  name: string;
  mac: string;
  address: string;
}

interface PictureMenuItem {
  menu_id: number;
  menu_flag: number;
  menu_name: string;
}

interface PictureSettings {
  menu_info: PictureMenuItem[];
}

interface PictureDiffItem {
  menuId: number;
  menuFlag: number;
  name: string;
}

interface PictureContext {
  client: MqttClient;
  macaddress: string;
  topics: Topics;
  offSnapshot: PictureSettings | null;
}

interface AppItem {
  name: string;
  id: string;
}

// Raw app list entries vary by TV firmware
interface RawApp {
  name?: string;
  label?: string;
  appId?: string;
  id?: string;
}

// ─── Server ──────────────────────────────────────────────────────────────────

class HiSenseTVUiServer extends HomebridgePluginUiServer {
  private activeClient: MqttClient | null = null;
  private pictureContext: PictureContext | null = null;

  constructor() {
    super();

    this.onRequest('/get-network-interfaces', this.getNetworkInterfaces.bind(this));
    this.onRequest('/test-connection', this.testConnection.bind(this));
    this.onRequest('/start-pairing', this.startPairing.bind(this));
    this.onRequest('/send-auth-code', this.sendAuthCode.bind(this));
    this.onRequest('/detect-tv-type', this.detectTvType.bind(this));
    this.onRequest('/picture-settings-snapshot', this.pictureSettingsSnapshot.bind(this));
    this.onRequest('/get-app-list', this.getAppList.bind(this));
    this.onRequest('/cleanup', this.cleanup.bind(this));

    this.ready();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildMqttOpts(opts: MqttOpts) {
    let key: Buffer | undefined;
    let cert: Buffer | undefined;

    if (opts.sslmode === 'custom') {
      try {
        if (opts.sslprivatekey) key = fs.readFileSync(opts.sslprivatekey);
        if (opts.sslcertificate) cert = fs.readFileSync(opts.sslcertificate);
      } catch {
        // ignore missing files — will connect without certs
      }
    }

    return {
      port: 36669,
      host: opts.ipaddress,
      username: 'hisenseservice',
      password: 'multimqttservice',
      rejectUnauthorized: false,
      queueQoSZero: false,
      protocol: opts.sslmode === 'disabled' ? ('mqtt' as const) : ('mqtts' as const),
      key,
      cert,
    };
  }

  private buildTopics(macaddress: string): Topics {
    const base = '/remoteapp/mobile';
    const device = `${macaddress.toUpperCase()}$normal`;
    const comm = `${base}/${device}/ui_service/data`;
    return {
      state: `${base}/broadcast/ui_service/state`,
      sourceList: `${comm}/sourcelist`,
      appList: `${comm}/applist`,
      pictureDevice: `${base}/${device}/platform_service/data/picturesetting`,
      commAll: `${comm}/#`,
    };
  }

  private callService(client: MqttClient, macaddress: string, service: string, action: string, payload = '') {
    const device = `${macaddress.toUpperCase()}$normal`;
    const topic = `/remoteapp/tv/${service}/${device}/actions/${action}`;
    client.publish(topic, payload);
  }

  private endClient(client: MqttClient | null) {
    if (client) {
      try { client.end(true); } catch { /* ignore */ }
    }
  }

  private connectWithTimeout(opts: ReturnType<typeof this.buildMqttOpts>, timeoutMs: number): Promise<MqttClient | null> {
    return new Promise((resolve) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { client.end(true); } catch { /* ignore */ }
          resolve(null);
        }
      }, timeoutMs);

      const client = connect(opts);

      client.on('connect', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(client);
        }
      });

      client.on('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try { client.end(true); } catch { /* ignore */ }
          resolve(null);
        }
      });
    });
  }

  private waitForMessage<T>(client: MqttClient, topic: string, timeoutMs: number): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        client.removeListener('message', handler);
        resolve(null);
      }, timeoutMs);

      const handler = (msgTopic: string, message: Buffer) => {
        if (msgTopic === topic) {
          clearTimeout(timer);
          client.removeListener('message', handler);
          try {
            resolve(JSON.parse(message.toString()) as T);
          } catch {
            resolve(null);
          }
        }
      };

      client.on('message', handler);
    });
  }

  // ─── Endpoints ─────────────────────────────────────────────────────────────

  private async getNetworkInterfaces(): Promise<{ interfaces: NetworkInterface[] }> {
    const result: NetworkInterface[] = [];
    const ifaces = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family !== 'IPv4' || addr.internal) continue;
        result.push({ name, mac: addr.mac, address: addr.address });
      }
    }

    return { interfaces: result };
  }

  private async testConnection(body: MqttOpts & { macaddress: string }) {
    const { ipaddress, macaddress, sslmode, sslcertificate, sslprivatekey } = body;

    this.endClient(this.activeClient);
    this.activeClient = null;

    const opts = this.buildMqttOpts({ ipaddress, sslmode, sslcertificate, sslprivatekey });
    const client = await this.connectWithTimeout(opts, 5000);

    if (!client) {
      return { success: false, error: 'Could not connect to TV. Check the IP address and SSL mode.' };
    }

    const topics = this.buildTopics(macaddress);

    client.subscribe(topics.sourceList);
    this.callService(client, macaddress, 'ui_service', 'sourcelist');
    this.callService(client, macaddress, 'ui_service', 'gettvstate');

    const sources = await this.waitForMessage<unknown>(client, topics.sourceList, 3000);

    this.activeClient = client;

    if (sources !== null) {
      return { success: true, authorized: true, sources };
    }
    return { success: true, authorized: false };
  }

  private async startPairing(body: MqttOpts & { macaddress: string }) {
    const { ipaddress, macaddress, sslmode, sslcertificate, sslprivatekey } = body;

    if (!this.activeClient?.connected) {
      this.endClient(this.activeClient);
      const opts = this.buildMqttOpts({ ipaddress, sslmode, sslcertificate, sslprivatekey });
      const client = await this.connectWithTimeout(opts, 5000);
      if (!client) {
        return { success: false, error: 'Could not connect to TV.' };
      }
      this.activeClient = client;
    }

    this.callService(this.activeClient, macaddress, 'ui_service', 'gettvstate');
    return { success: true };
  }

  private async sendAuthCode(body: { code: string; macaddress: string }) {
    const { code, macaddress } = body;

    if (!this.activeClient?.connected) {
      return { success: false, error: 'No active connection. Please go back to the connection test step.' };
    }

    const topics = this.buildTopics(macaddress);
    this.activeClient.subscribe(topics.commAll);

    const device = `${macaddress.toUpperCase()}$normal`;
    const authTopic = `/remoteapp/tv/ui_service/${device}/actions/authenticationcode`;
    this.activeClient.publish(authTopic, JSON.stringify({ authNum: code }));

    const result = await new Promise<{ result?: number; timedOut?: boolean }>((resolve) => {
      const timer = setTimeout(() => resolve({ timedOut: true }), 8000);

      const handler = (_topic: string, message: Buffer) => {
        try {
          const data = JSON.parse(message.toString()) as Record<string, unknown>;
          if (data !== null && typeof data === 'object' && 'result' in data) {
            clearTimeout(timer);
            this.activeClient?.removeListener('message', handler);
            resolve({ result: data.result as number });
          }
        } catch { /* ignore non-JSON */ }
      };

      this.activeClient!.on('message', handler);
    });

    if (result.timedOut) {
      return { success: false, error: 'Timeout waiting for TV response. Please try again.' };
    }
    if (result.result !== 1) {
      return { success: false, error: 'TV rejected the pairing code. Please try again.' };
    }
    return { success: true };
  }

  private async detectTvType(body: MqttOpts & { macaddress: string }) {
    const { ipaddress, macaddress, sslmode, sslcertificate, sslprivatekey } = body;

    if (!this.activeClient?.connected) {
      this.endClient(this.activeClient);
      const opts = this.buildMqttOpts({ ipaddress, sslmode, sslcertificate, sslprivatekey });
      const client = await this.connectWithTimeout(opts, 5000);
      if (!client) {
        return { tvType: 'default' };
      }
      this.activeClient = client;
    }

    const topics = this.buildTopics(macaddress);

    this.activeClient.subscribe(topics.state);
    this.callService(this.activeClient, macaddress, 'ui_service', 'gettvstate');

    const stateData = await this.waitForMessage<{ statetype?: string }>(this.activeClient, topics.state, 2000);

    if (!stateData) {
      return { tvType: 'default' };
    }

    if (stateData.statetype?.startsWith('fake_sleep')) {
      return { tvType: 'fakeSleep' };
    }

    // Proceed to picture settings test
    this.activeClient.subscribe(topics.pictureDevice);
    this.callService(
      this.activeClient,
      macaddress,
      'platform_service',
      'picturesetting',
      JSON.stringify({ action: 'get_menu_info' }),
    );

    const initialSnapshot = await this.waitForMessage<PictureSettings>(this.activeClient, topics.pictureDevice, 5000);

    if (!initialSnapshot) {
      return { tvType: 'default', needsManual: true, error: 'Could not read picture settings. Try setting TV type manually.' };
    }

    this.pictureContext = {
      client: this.activeClient,
      macaddress,
      topics,
      offSnapshot: null,
    };

    return { tvType: 'pictureSettings', needsPictureTest: true };
  }

  private async pictureSettingsSnapshot(body: { stage: 'off' | 'on' }) {
    const { stage } = body;

    if (!this.pictureContext) {
      return { success: false, error: 'No picture settings test in progress.' };
    }

    const { client, macaddress, topics } = this.pictureContext;

    if (!client.connected) {
      return { success: false, error: 'Lost connection to TV.' };
    }

    client.subscribe(topics.pictureDevice);
    this.callService(client, macaddress, 'platform_service', 'picturesetting', JSON.stringify({ action: 'get_menu_info' }));

    const snapshot = await this.waitForMessage<PictureSettings>(client, topics.pictureDevice, 5000);

    if (!snapshot) {
      return { success: false, error: 'Could not read picture settings from TV.' };
    }

    if (stage === 'off') {
      this.pictureContext.offSnapshot = snapshot;
      return { success: true };
    }

    // stage === 'on' — diff off vs on
    const { offSnapshot } = this.pictureContext;
    if (!offSnapshot) {
      return { success: false, error: 'Missing OFF snapshot. Please restart the detection.' };
    }

    const diff: PictureDiffItem[] = snapshot.menu_info
      .filter((menu) => {
        const offMenu = offSnapshot.menu_info.find((m) => m.menu_id === menu.menu_id);
        return menu.menu_flag !== offMenu?.menu_flag;
      })
      .map((menu) => {
        const offMenu = offSnapshot.menu_info.find((m) => m.menu_id === menu.menu_id);
        return {
          menuId: menu.menu_id,
          menuFlag: offMenu?.menu_flag ?? menu.menu_flag,
          name: menu.menu_name,
        };
      });

    this.pictureContext = null;
    return { success: true, diff };
  }

  private async getAppList(body: MqttOpts & { macaddress: string }) {
    const { ipaddress, macaddress, sslmode, sslcertificate, sslprivatekey } = body;

    let client = this.activeClient?.connected ? this.activeClient : null;
    if (!client) {
      const opts = this.buildMqttOpts({ ipaddress, sslmode, sslcertificate, sslprivatekey });
      client = await this.connectWithTimeout(opts, 5000);
      if (!client) {
        return { apps: [] };
      }
      this.activeClient = client;
    }

    const topics = this.buildTopics(macaddress);
    client.subscribe(topics.appList);
    this.callService(client, macaddress, 'ui_service', 'applist');

    const appData = await this.waitForMessage<RawApp[] | { applist?: RawApp[]; data?: RawApp[] }>(
      client,
      topics.appList,
      5000,
    );

    if (!appData) {
      return { apps: [] as AppItem[] };
    }

    const rawList: RawApp[] = Array.isArray(appData)
      ? appData
      : ((appData as { applist?: RawApp[]; data?: RawApp[] }).applist ?? (appData as { data?: RawApp[] }).data ?? []);

    const apps: AppItem[] = rawList.map((app) => ({
      name: app.name ?? app.label ?? '',
      id: app.appId ?? app.id ?? '',
    }));

    return { apps };
  }

  private async cleanup() {
    this.endClient(this.activeClient);
    this.activeClient = null;
    if (this.pictureContext) {
      this.endClient(this.pictureContext.client);
      this.pictureContext = null;
    }
    return {};
  }
}

(() => new HiSenseTVUiServer())();
