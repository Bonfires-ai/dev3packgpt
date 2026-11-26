// Languages a session can be held in. French, Turkish and Ukrainian speak their own
// language but search the English bonfire (see BONFIRES_MCP in agents.config.ts).
export enum AgentMoodEnum {
  ENGLISH = 'english',
  SPANISH = 'spanish',
  FRENCH = 'french',
  TURKISH = 'turkish',
  UKRAINIAN = 'ukrainian',
}

export type AgentMoodI = AgentMoodEnum;

export const ALL_MOODS = Object.values(AgentMoodEnum) as AgentMoodI[];

export const isMood = (value: unknown): value is AgentMoodI => ALL_MOODS.includes(value as AgentMoodI);

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
