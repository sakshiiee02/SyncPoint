import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';
import { Mascot, MascotAnimal } from '@/domain/mascot';

interface MascotAvatarProps {
  mascot: Mascot;
  size?: number;
}

const INK = '#1f2937';

/** Two simple eyes with a highlight, shared by most animals. */
const Eyes: React.FC<{ y?: number; gap?: number; r?: number }> = ({ y = 52, gap = 12, r = 4.6 }) => (
  <G>
    <Circle cx={50 - gap} cy={y} r={r} fill={INK} />
    <Circle cx={50 + gap} cy={y} r={r} fill={INK} />
    <Circle cx={50 - gap + 1.6} cy={y - 1.6} r={1.5} fill="#ffffff" />
    <Circle cx={50 + gap + 1.6} cy={y - 1.6} r={1.5} fill="#ffffff" />
  </G>
);

const Smile: React.FC<{ y?: number; width?: number }> = ({ y = 68, width = 9 }) => (
  <Path
    d={`M${50 - width} ${y} Q50 ${y + 8} ${50 + width} ${y}`}
    stroke={INK}
    strokeWidth={2.4}
    strokeLinecap="round"
    fill="none"
  />
);

/** The animal's face on a 100x100 canvas. */
const Face: React.FC<{ animal: MascotAnimal }> = ({ animal }) => {
  switch (animal) {
    case 'BEAR':
      return (
        <G>
          <Circle cx={24} cy={26} r={13} fill="#8b5e3c" />
          <Circle cx={76} cy={26} r={13} fill="#8b5e3c" />
          <Circle cx={24} cy={26} r={6} fill="#d9b08c" />
          <Circle cx={76} cy={26} r={6} fill="#d9b08c" />
          <Circle cx={50} cy={56} r={36} fill="#a8744f" />
          <Ellipse cx={50} cy={67} rx={15} ry={11} fill="#ecd5b5" />
          <Eyes />
          <Ellipse cx={50} cy={61} rx={6} ry={4.2} fill="#3b2a1e" />
          <Smile y={68} width={6} />
        </G>
      );
    case 'CAT':
      return (
        <G>
          <Polygon points="16,40 22,8 46,24" fill="#f59e0b" />
          <Polygon points="84,40 78,8 54,24" fill="#f59e0b" />
          <Polygon points="23,32 25,17 38,26" fill="#fbcfe8" />
          <Polygon points="77,32 75,17 62,26" fill="#fbcfe8" />
          <Circle cx={50} cy={57} r={36} fill="#f59e0b" />
          <Path d="M50 22 v10 M40 24 l3 8 M60 24 l-3 8" stroke="#b45309" strokeWidth={3} strokeLinecap="round" />
          <Eyes y={54} gap={13} />
          <Polygon points="46,62 54,62 50,67" fill="#f472b6" />
          <Smile y={70} width={7} />
          <Path d="M20 62 L36 65 M20 72 L36 69 M80 62 L64 65 M80 72 L64 69" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" />
        </G>
      );
    case 'DOG':
      return (
        <G>
          <Ellipse cx={18} cy={48} rx={11} ry={24} fill="#7c4a2d" transform="rotate(14 18 48)" />
          <Ellipse cx={82} cy={48} rx={11} ry={24} fill="#7c4a2d" transform="rotate(-14 82 48)" />
          <Circle cx={50} cy={56} r={34} fill="#d9a066" />
          <Ellipse cx={50} cy={68} rx={18} ry={14} fill="#f3dcc0" />
          <Eyes y={50} gap={13} />
          <Ellipse cx={50} cy={60} rx={8} ry={5.5} fill="#2b1d12" />
          <Path d="M50 65 v6 M42 72 Q50 78 58 72" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Ellipse cx={50} cy={76} rx={5} ry={3.4} fill="#f472b6" />
        </G>
      );
    case 'FOX':
      return (
        <G>
          <Polygon points="14,42 20,6 46,26" fill="#ea580c" />
          <Polygon points="86,42 80,6 54,26" fill="#ea580c" />
          <Polygon points="20,22 21,10 32,20" fill="#1f2937" />
          <Polygon points="80,22 79,10 68,20" fill="#1f2937" />
          <Circle cx={50} cy={55} r={35} fill="#f97316" />
          <Path d="M14 60 Q50 98 86 60 Q70 52 50 66 Q30 52 14 60 Z" fill="#ffffff" />
          <Eyes y={52} gap={14} />
          <Ellipse cx={50} cy={80} rx={5} ry={3.6} fill={INK} />
        </G>
      );
    case 'RABBIT':
      return (
        <G>
          <Ellipse cx={36} cy={22} rx={9} ry={23} fill="#e5e7eb" />
          <Ellipse cx={64} cy={22} rx={9} ry={23} fill="#e5e7eb" />
          <Ellipse cx={36} cy={24} rx={4.5} ry={16} fill="#fbcfe8" />
          <Ellipse cx={64} cy={24} rx={4.5} ry={16} fill="#fbcfe8" />
          <Circle cx={50} cy={62} r={33} fill="#f3f4f6" />
          <Eyes y={58} gap={13} />
          <Ellipse cx={50} cy={67} rx={4.5} ry={3.2} fill="#f472b6" />
          <Path d="M50 70 v4 M42 76 Q50 82 58 76" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <Path d="M46 77 h8 v6 h-8 z" fill="#ffffff" stroke="#d1d5db" strokeWidth={1} />
        </G>
      );
    case 'PANDA':
      return (
        <G>
          <Circle cx={24} cy={26} r={13} fill={INK} />
          <Circle cx={76} cy={26} r={13} fill={INK} />
          <Circle cx={50} cy={56} r={36} fill="#ffffff" stroke="#e5e7eb" strokeWidth={1.5} />
          <Ellipse cx={34} cy={52} rx={9} ry={12} fill={INK} transform="rotate(20 34 52)" />
          <Ellipse cx={66} cy={52} rx={9} ry={12} fill={INK} transform="rotate(-20 66 52)" />
          <Circle cx={35} cy={51} r={3.4} fill="#ffffff" />
          <Circle cx={65} cy={51} r={3.4} fill="#ffffff" />
          <Ellipse cx={50} cy={64} rx={6} ry={4.2} fill={INK} />
          <Smile y={70} width={6} />
        </G>
      );
    case 'FROG':
      return (
        <G>
          <Ellipse cx={50} cy={60} rx={40} ry={32} fill="#4ade80" />
          <Circle cx={30} cy={32} r={14} fill="#4ade80" />
          <Circle cx={70} cy={32} r={14} fill="#4ade80" />
          <Circle cx={30} cy={32} r={9} fill="#ffffff" />
          <Circle cx={70} cy={32} r={9} fill="#ffffff" />
          <Circle cx={31} cy={33} r={4.4} fill={INK} />
          <Circle cx={69} cy={33} r={4.4} fill={INK} />
          <Path d="M24 66 Q50 90 76 66" stroke="#166534" strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx={44} cy={54} r={1.8} fill="#166534" />
          <Circle cx={56} cy={54} r={1.8} fill="#166534" />
          <Circle cx={22} cy={64} r={5} fill="#fda4af" opacity={0.7} />
          <Circle cx={78} cy={64} r={5} fill="#fda4af" opacity={0.7} />
        </G>
      );
    case 'LION':
      return (
        <G>
          <Circle cx={50} cy={54} r={45} fill="#b45309" />
          <Circle cx={30} cy={22} r={10} fill="#fbbf24" />
          <Circle cx={70} cy={22} r={10} fill="#fbbf24" />
          <Circle cx={50} cy={56} r={29} fill="#fbbf24" />
          <Ellipse cx={50} cy={66} rx={14} ry={10} fill="#fde68a" />
          <Eyes y={50} gap={11} />
          <Polygon points="45,58 55,58 50,64" fill="#7c2d12" />
          <Smile y={67} width={6} />
        </G>
      );
    case 'OWL':
      return (
        <G>
          <Polygon points="18,34 22,8 44,22" fill="#92400e" />
          <Polygon points="82,34 78,8 56,22" fill="#92400e" />
          <Ellipse cx={50} cy={58} rx={37} ry={36} fill="#a16207" />
          <Circle cx={34} cy={50} r={15} fill="#fef3c7" />
          <Circle cx={66} cy={50} r={15} fill="#fef3c7" />
          <Circle cx={34} cy={50} r={8} fill={INK} />
          <Circle cx={66} cy={50} r={8} fill={INK} />
          <Circle cx={36} cy={48} r={2.6} fill="#ffffff" />
          <Circle cx={68} cy={48} r={2.6} fill="#ffffff" />
          <Polygon points="44,62 56,62 50,74" fill="#f97316" />
        </G>
      );
    case 'KOALA':
      return (
        <G>
          <Circle cx={18} cy={36} r={17} fill="#9ca3af" />
          <Circle cx={82} cy={36} r={17} fill="#9ca3af" />
          <Circle cx={18} cy={36} r={9} fill="#f3f4f6" />
          <Circle cx={82} cy={36} r={9} fill="#f3f4f6" />
          <Circle cx={50} cy={57} r={33} fill="#9ca3af" />
          <Eyes y={52} gap={14} />
          <Ellipse cx={50} cy={63} rx={9} ry={12} fill="#374151" />
          <Smile y={78} width={6} />
        </G>
      );
  }
};

/** A traveler's mascot: animal face on their chosen colour, as a circle. */
export const MascotAvatar: React.FC<MascotAvatarProps> = ({ mascot, size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Circle cx={50} cy={50} r={50} fill={mascot.color} />
    <G transform="translate(6 8) scale(0.88)">
      <Face animal={mascot.animal} />
    </G>
  </Svg>
);
