import {Service} from 'homebridge';

export interface TVApp {
  url: string;
  isunInstalled: boolean;
  name: string;
  id: string;
  urlType?: number|string;
  storeType: number;
  service?: Service;
}