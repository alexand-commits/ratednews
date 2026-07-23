import React from 'react';
import { Composition } from 'remotion';
import { ClashVideo, totalFrames } from './Clash';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Clash"
    component={ClashVideo}
    durationInFrames={totalFrames}
    fps={30}
    width={1080}
    height={1920}
  />
);
