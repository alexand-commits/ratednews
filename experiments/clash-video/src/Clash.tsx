import React from 'react';
import {
  AbsoluteFill, Audio, Sequence, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import timing from './timing.json';

const FPS = 30;
const s2f = (s: number) => Math.round(s * FPS);

// ── Timeline (frames) ────────────────────────────────────────────────────────
const INTRO_VO_AT = 12;
const INTRO_LEN = INTRO_VO_AT + s2f(timing.intro) + 16;
const A_START = INTRO_LEN;
const A_VO_AT = 14;
const A_LEN = A_VO_AT + s2f(timing.a) + 18;
const B_START = A_START + A_LEN;
const B_VO_AT = 14;
const B_LEN = B_VO_AT + s2f(timing.b) + 18;
const BEAT_START = B_START + B_LEN;
const BEAT_LEN = 22;
const OUTRO_START = BEAT_START + BEAT_LEN;
const OUTRO_LEN = 10 + s2f(timing.outro) + 40;
export const totalFrames = OUTRO_START + OUTRO_LEN;

// ── Palette (site tokens) ────────────────────────────────────────────────────
const BG = '#191715';
const CREAM = '#F2F0ED';
const CORAL = '#E8724A';
const BLUE = '#7FA8D6';
const MUTED = '#B7B2AC';

const Fonts: React.FC = () => (
  <style>{`
    @font-face { font-family: 'Playfair'; src: url('${staticFile('playfair-700.ttf')}'); font-weight: 700; }
    @font-face { font-family: 'InterB'; src: url('${staticFile('inter-700.ttf')}'); font-weight: 700; }
  `}</style>
);

const Badge: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <div style={{
    width: size, height: size, background: '#2C2B29', borderRadius: size * 0.19,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Playfair', fontWeight: 700, fontSize: size * 0.5,
  }}>
    <span style={{ color: '#FFFFFF' }}>R</span>
    <span style={{ color: '#D85A30' }}>N</span>
  </div>
);

// Word-by-word reveal synced to a duration window
const Reveal: React.FC<{ text: string; from: number; over: number; style: React.CSSProperties }> = ({ text, from, over, style }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={style}>
      {words.map((w, i) => {
        const at = from + (i / words.length) * over;
        const o = interpolate(frame, [at, at + 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{ opacity: 0.14 + 0.86 * o, marginRight: '0.28em', display: 'inline-block' }}>{w}</span>
        );
      })}
    </div>
  );
};

const Pane: React.FC<{
  top: boolean; outlet: string; quote: string;
  enterAt: number; voAt: number; voDur: number;
}> = ({ top, outlet, quote, enterAt, voAt, voDur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: frame - enterAt, fps, config: { damping: 100, stiffness: 120 } });
  const x = interpolate(slide, [0, 1], [top ? -1080 : 1080, 0]);
  return (
    <div style={{
      position: 'absolute', left: 0, width: 1080, height: 830,
      top: top ? 140 : 970, transform: `translateX(${x}px)`,
      background: top
        ? 'linear-gradient(170deg, #1E2732, #191E24)'
        : 'linear-gradient(190deg, #33221B, #241C18)',
      padding: '70px 76px', display: 'flex', flexDirection: 'column', gap: 34,
    }}>
      <div style={{ fontFamily: 'InterB', fontSize: 40, letterSpacing: 5, color: top ? BLUE : CORAL }}>
        {outlet.toUpperCase()}
      </div>
      <Reveal
        text={`“${quote}”`}
        from={voAt}
        over={voDur}
        style={{ fontFamily: 'Playfair', fontSize: 66, lineHeight: 1.32, color: '#F0EEEA' }}
      />
    </div>
  );
};

export const ClashVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Intro fades out as panes phase begins
  const introOut = interpolate(frame, [INTRO_LEN - 14, INTRO_LEN], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inPanes = frame >= INTRO_LEN && frame < OUTRO_START;
  const outroIn = interpolate(frame, [OUTRO_START, OUTRO_START + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const pillPop = spring({ frame: frame - BEAT_START, fps, config: { damping: 9, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Fonts />

      {/* Audio */}
      <Sequence from={INTRO_VO_AT}><Audio src={staticFile('vo-intro.wav')} /></Sequence>
      <Sequence from={A_START + A_VO_AT}><Audio src={staticFile('vo-a.wav')} /></Sequence>
      <Sequence from={B_START + B_VO_AT}><Audio src={staticFile('vo-b.wav')} /></Sequence>
      <Sequence from={OUTRO_START + 10}><Audio src={staticFile('vo-outro.wav')} /></Sequence>

      {/* Intro */}
      {frame < INTRO_LEN && (
        <AbsoluteFill style={{ opacity: introOut, padding: '110px 90px', display: 'flex', flexDirection: 'column' }}>
          <Badge />
          <div style={{ marginTop: 340 }}>
            <div style={{ fontFamily: 'InterB', fontSize: 42, letterSpacing: 7, color: CORAL, marginBottom: 46 }}>
              COVERAGE CHECK
            </div>
            <Reveal
              text="Trump freezes $1B+ in Medicaid funds to two states."
              from={INTRO_VO_AT}
              over={s2f(timing.intro) * 0.55}
              style={{ fontFamily: 'Playfair', fontSize: 104, lineHeight: 1.18, color: CREAM }}
            />
            <Reveal
              text="Two newsrooms. Two very different headlines."
              from={INTRO_VO_AT + s2f(timing.intro) * 0.62}
              over={s2f(timing.intro) * 0.3}
              style={{ fontFamily: 'Playfair', fontSize: 60, lineHeight: 1.3, color: MUTED, marginTop: 56 }}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* Panes phase */}
      {inPanes && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 1080, height: 140,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 76px',
          }}>
            <Badge size={78} />
            <span style={{ fontFamily: 'InterB', fontSize: 34, letterSpacing: 6, color: '#8A857E' }}>COVERAGE CHECK</span>
          </div>

          <Pane
            top outlet="NYT Politics"
            quote="Trump Officials Withhold $1 Billion in Medicaid Funds From California and Minnesota Over Suspected Fraud"
            enterAt={A_START} voAt={A_START + A_VO_AT + 28} voDur={s2f(timing.a) - 34}
          />
          {frame >= B_START - 4 && (
            <Pane
              top={false} outlet="New York Post"
              quote="RFK Jr. yanks Medicaid funds to California and Minnesota, says Dems 'opened the floodgates to theft'"
              enterAt={B_START} voAt={B_START + B_VO_AT + 28} voDur={s2f(timing.b) - 34}
            />
          )}

          {/* Seam + pill */}
          {frame >= B_START && (
            <>
              <div style={{ position: 'absolute', top: 968, left: 60, width: 960, height: 4, background: 'rgba(255,255,255,0.18)' }} />
              <div style={{
                position: 'absolute', top: 970, left: 540,
                transform: `translate(-50%, -50%) scale(${frame >= BEAT_START ? 0.9 + pillPop * 0.25 : 1})`,
                background: BG, border: '3px solid rgba(255,255,255,0.3)', borderRadius: 99,
                padding: '20px 44px', fontFamily: 'InterB', fontSize: 36, letterSpacing: 6, color: '#CFCBC5',
              }}>
                SAME STORY
              </div>
            </>
          )}
        </>
      )}

      {/* Outro */}
      {frame >= OUTRO_START && (
        <AbsoluteFill style={{ opacity: outroIn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 90 }}><Badge size={140} /></div>
            <Reveal
              text="Same story. Two different stories."
              from={OUTRO_START + 10}
              over={s2f(timing.outro) * 0.36}
              style={{ fontFamily: 'Playfair', fontSize: 76, color: CREAM, marginBottom: 60 }}
            />
            <Reveal
              text="compare every angle. rate the source."
              from={OUTRO_START + 10 + s2f(timing.outro) * 0.45}
              over={s2f(timing.outro) * 0.4}
              style={{ fontFamily: 'Playfair', fontSize: 58, color: MUTED, marginBottom: 110 }}
            />
            <div style={{ fontFamily: 'Playfair', fontSize: 72, opacity: interpolate(frame, [OUTRO_START + s2f(timing.outro), OUTRO_START + s2f(timing.outro) + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
              <span style={{ color: CREAM }}>rated</span>
              <span style={{ color: CORAL }}>news</span>
              <span style={{ color: MUTED }}>.com</span>
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
