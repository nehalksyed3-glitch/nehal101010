/**
 * Provider-independent telephony adapter. The UI only talks to this interface.
 * - LiveTwilioAdapter needs a backend token endpoint + credentials; until configured it refuses to place calls.
 * - SimulatedAdapter exists only for demo workspaces and every record it produces is flagged `simulated`.
 */
export type CallState = "idle" | "connecting" | "ringing" | "in-call" | "ended" | "failed";

export interface TelephonyAdapter {
  readonly id: string;
  readonly live: boolean;
  readonly configured: boolean;
  readonly label: string;
  start(to: string, onState: (s: CallState, info?: string) => void): Promise<void>;
  hangup(): void;
  mute(on: boolean): void;
}

declare global { interface Window { __AG_TELEPHONY__?: { tokenEndpoint?: string } } }

export class LiveTwilioAdapter implements TelephonyAdapter {
  readonly id = "twilio"; readonly live = true; readonly label = "Twilio Voice";
  get configured() { return !!window.__AG_TELEPHONY__?.tokenEndpoint; }
  async start(_to: string, onState: (s: CallState, info?: string) => void) {
    if (!this.configured) { onState("failed", "Telephony is not configured. Add the Twilio secrets and token endpoint (docs/INTEGRATIONS.md)."); return; }
    // Backend validates membership, campaign assignment and destination, then returns a short-lived token.
    onState("failed", "Twilio Voice SDK is not bundled in this build. Install @twilio/voice-sdk and wire the token endpoint.");
  }
  hangup() { /* no active call */ }
  mute() { /* no active call */ }
}

export class SimulatedAdapter implements TelephonyAdapter {
  readonly id = "simulated"; readonly live = false; readonly configured = true; readonly label = "Simulated (demo)";
  private timers: number[] = [];
  async start(_to: string, onState: (s: CallState, info?: string) => void) {
    onState("connecting");
    this.timers.push(window.setTimeout(() => onState("ringing"), 700), window.setTimeout(() => onState("in-call"), 2200));
  }
  hangup() { this.timers.forEach(clearTimeout); this.timers = []; }
  mute() { /* simulated */ }
}
