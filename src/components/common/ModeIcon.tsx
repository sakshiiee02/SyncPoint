import React from 'react';
import { TravelMode } from '@/types/member';
import { BikeIcon, CarIcon, WalkIcon } from './Icons';

export const ModeIcon: React.FC<{ mode: TravelMode; selected: boolean }> = ({ mode, selected }) => {
  const color = selected ? '#ffffff' : '#475569';
  if (mode === 'CAR') return <CarIcon size={20} color={color} />;
  if (mode === 'BIKE') return <BikeIcon size={20} color={color} />;
  return <WalkIcon size={20} color={color} />;
};
