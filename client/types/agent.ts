export enum AgentMoodEnum {
  ENGLISH = 'english',
  FRENCH = 'french',
}

export type AgentMoodI = AgentMoodEnum.FRENCH | AgentMoodEnum.ENGLISH;

export interface ZoraCoinResult {
  zoraLink: string;
  coinAddress: `0x${string}`;
  hash: `0x${string}`;
}

export enum ZoraCoinFlowStep {
  IDLE = 'idle',
  CONNECTING_WALLET = 'connecting_wallet',
  UPLOADING_IMAGE = 'uploading_image',
  CREATING_COIN = 'creating_coin',
  SUCCESS = 'success',
  FAILURE = 'failure',
}
