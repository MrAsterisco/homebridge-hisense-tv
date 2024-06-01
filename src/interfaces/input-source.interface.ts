import {Service} from 'homebridge';

export interface InputSource {
  sourceid: string;
  sourcename : string;
  displayname : string;
  service?: Service;
}