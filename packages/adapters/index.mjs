// Explicit integration boundaries. Stubs return structured "not wired" — do not fake success.
export class CodexAdapter {
  async startTurn() {
    throw new Error('Codex App Server 尚未接入');
  }
}

export { OpenMontageAdapter, openMontage, openMontageStatus } from './openmontage.mjs';

export class ProviderGateway {
  async generate() {
    throw new Error('远程模型网关尚未接入');
  }
}

export class PaymentAdapter {
  async createOrder() {
    throw new Error('支付宝/微信支付尚未接入');
  }
}
