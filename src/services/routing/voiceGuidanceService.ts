import { LocationBridge } from '@/services/location/LocationBridge';

/**
 * Turn-by-turn voice prompts through Android text-to-speech (native). Each manoeuvre is announced
 * once per distance tier ("in 800 m", "in 200 m", "now") so the driver isn't nagged.
 */
type Tier = 'FAR' | 'CLOSE' | 'IMMEDIATE';

export class VoiceGuidanceService {
  private isEnabled = true;
  private lastStepIndex = -1;
  private spokenTiers = new Set<Tier>();

  constructor(private readonly speakFn: (text: string) => void = (t) => LocationBridge.speak(t)) {}

  enableVoice(): void {
    this.isEnabled = true;
  }

  disableVoice(): void {
    this.isEnabled = false;
    LocationBridge.stopSpeaking();
  }

  get enabled(): boolean {
    return this.isEnabled;
  }

  speak(text: string): void {
    if (this.isEnabled) this.speakFn(text);
  }

  /** Decides whether to say something for the current distance to the next manoeuvre. */
  evaluateManeuverPrompt(stepIndex: number, distanceM: number, instruction: string): void {
    if (!this.isEnabled) return;

    if (stepIndex !== this.lastStepIndex) {
      this.lastStepIndex = stepIndex;
      this.spokenTiers.clear();
    }

    let tier: Tier | null = null;
    let prompt = '';
    if (distanceM <= 50) {
      tier = 'IMMEDIATE';
      prompt = instruction;
    } else if (distanceM <= 250) {
      tier = 'CLOSE';
      prompt = `In ${Math.round(distanceM / 50) * 50} metres, ${instruction}`;
    } else if (distanceM <= 800) {
      tier = 'FAR';
      prompt = `In ${Math.round(distanceM / 100) * 100} metres, ${instruction}`;
    }

    if (tier && !this.spokenTiers.has(tier)) {
      this.spokenTiers.add(tier);
      this.speakFn(prompt);
    }
  }

  reset(): void {
    this.lastStepIndex = -1;
    this.spokenTiers.clear();
  }
}

export const voiceGuidance = new VoiceGuidanceService();
