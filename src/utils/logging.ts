import Chalk from 'chalk';

export function l(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

export function prepareMessage(msg: unknown): string {
  if (typeof msg === 'string') {
    return msg;
  }
  if (msg instanceof Error) {
    return `${msg.stack || ''}`;
  }
  return JSON.stringify(msg, null, '\t');
}

export function red(msg: string): void {
  return l(Chalk.red(prepareMessage(msg)));
}