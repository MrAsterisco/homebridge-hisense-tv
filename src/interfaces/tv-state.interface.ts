export interface GenericTVState {
  statetype: string;

  // this seems a bit weird but is needed
  // we can't create a type like Exclude<string, 'app' | 'sourceswitch'>
  // because it resolves back to string...
  name: string;
  sourcename: string;
}

export interface TVStateApp {
  statetype: 'app';
  name: string;
}

export interface TVStateSource {
  statetype: 'sourceswitch';
  sourcename: string;
}

export type TVState = TVStateApp | TVStateSource | GenericTVState;