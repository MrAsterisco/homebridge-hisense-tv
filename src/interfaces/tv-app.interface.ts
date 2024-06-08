import {Service} from 'homebridge';

export interface TVApp {
  url: string;
  isunInstalled: boolean;
  name: string;
  urlType: number;
  storeType: number;
  service?: Service;
}