/**
 * Voice Navigation Guidance Service
 * Matches Section 11.2 of Developer Handoff: "Voice guidance through Android Text-to-Speech in V1."
 */
class VoiceGuidanceService {
  private isEnabled: boolean = true;
  private lastSpokenStepIndex: number = -1;
  private lastSpokenDistanceTier: string = '';

  enableVoice() {
    this.isEnabled = true;
  }

  disableVoice() {
    this.isEnabled = false;
  }

  speak(text: string) {
    if (!this.isEnabled) return;

    // In web / React Native with SpeechSynthesis or react-native-tts:
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      console.log(`[SyncPoint Voice Guidance] "${text}"`);
    }
  }

  /**
   * Evaluates distance to next maneuver and dispatches staggered voice prompts.
   */
  evaluateManeuverPrompt(
    stepIndex: number,
    distanceM: number,
    instruction: string
  ) {
    if (!this.isEnabled) return;

    let tier = '';
    let prompt = '';

    if (distanceM <= 50) {
      tier = 'IMMEDIATE';
      prompt = instruction;
    } else if (distanceM <= 250) {
      tier = 'CLOSE';
      prompt = `In 200 meters, ${instruction.toLowerCase()}`;
    } else if (distanceM <= 800) {
      tier = 'FAR';
      prompt = `In 800 meters, ${instruction.toLowerCase()}`;
    }

    if (tier && (this.lastSpokenStepIndex !== stepIndex || this.lastSpokenDistanceTier !== tier)) {
      this.lastSpokenStepIndex = stepIndex;
      this.lastSpokenDistanceTier = tier;
      this.speak(prompt);
    }
  }

  reset() {
    this.lastSpokenStepIndex = -1;
    this.lastSpokenDistanceTier = '';
  }
}

export const voiceGuidance = new VoiceGuidanceService();
