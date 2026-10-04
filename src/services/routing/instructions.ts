/** Human-readable turn text for providers that don't supply it (OSRM). */
export function buildInstruction(type: string, modifier: string | undefined, roadName: string): string {
  const road = roadName && roadName !== '-' ? roadName : '';
  const onto = road ? ` onto ${road}` : '';
  const on = road ? ` on ${road}` : '';

  switch (type) {
    case 'depart':
      return road ? `Head out on ${road}` : 'Start your journey';
    case 'arrive':
      return 'You have arrived at your destination';
    case 'roundabout':
    case 'rotary':
      return `Enter the roundabout${road ? ` and exit${onto}` : ''}`;
    case 'continue':
    case 'new name':
      return `Continue${on}`;
    case 'merge':
      return `Merge${onto}`;
    case 'fork':
      return modifier?.includes('left') ? `Keep left${on}` : `Keep right${on}`;
    case 'end of road':
    case 'turn':
    case 'on ramp':
    case 'off ramp':
    default:
      if (!modifier || modifier === 'straight') return `Continue straight${on}`;
      if (modifier === 'uturn' || modifier === 'u-turn') return `Make a U-turn${on}`;
      return `Turn ${modifier}${onto}`;
  }
}
