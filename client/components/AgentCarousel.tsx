'use client';

import { type HomeAgent, homeAgents } from '@/config/agents.config';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import clsx from 'clsx';
import { PanInfo, animate, motion, useMotionValue } from 'framer-motion';
import Image from 'next/image';
import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

// A drag past this share of the avatar's width, or a flick, moves one slide.
const SWIPE_DISTANCE = 0.2;
const SWIPE_VELOCITY = 400;
const SPRING = { type: 'spring', stiffness: 320, damping: 34 } as const;
// Space between avatars, in px; the neighbours stay in view either side.
const GAP = 40;

const AVATAR_SIZE = 'w-[clamp(140px,26dvh,200px)] md:w-[clamp(180px,30dvh,300px)]';

/**
 * The home page avatar, one slide per agent in agents.config.ts. Drag or swipe
 * to switch; the chevrons and the arrow keys do the same. Changing language
 * crossfades every avatar to its version for that language.
 */
export function AgentCarousel({
  value,
  onChange,
  mood,
  disabled,
  agents = homeAgents,
}: {
  value: string;
  onChange: (agent: string) => void;
  mood: AgentMoodI;
  disabled?: boolean;
  agents?: HomeAgent[];
}) {
  const index = Math.max(
    0,
    agents.findIndex(agent => agent.slug === value)
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const step = width + GAP;
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.offsetWidth));
    observer.observe(el);
    setWidth(el.offsetWidth);
    return () => observer.disconnect();
  }, []);

  // Jump on resize, glide on a change of slide.
  useLayoutEffect(() => x.set(-index * step), [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const controls = animate(x, -index * step, SPRING);
    return () => controls.stop();
  }, [index, step, x]);

  const go = (next: number) => {
    const clamped = Math.min(agents.length - 1, Math.max(0, next));
    if (clamped !== index) onChange(agents[clamped].slug);
    else animate(x, -index * step, SPRING);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const swiped = Math.abs(info.offset.x) > width * SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY;
    go(swiped ? index - Math.sign(info.offset.x || info.velocity.x) : index);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="relative">
      <div
        ref={viewport}
        role="group"
        aria-roledescription="carousel"
        aria-label="Choose who to talk to"
        tabIndex={0}
        onKeyDown={disabled ? undefined : handleKey}
        className={clsx(
          AVATAR_SIZE,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED] focus-visible:ring-offset-4'
        )}
      >
        <motion.div
          className={clsx(
            'flex gap-10 touch-pan-y',
            disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
          )}
          style={{ x }}
          drag={disabled ? false : 'x'}
          dragConstraints={{ left: -(agents.length - 1) * step, right: 0 }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          {agents.map((agent, i) => (
            <Slide key={agent.slug} agent={agent} mood={mood} active={i === index} />
          ))}
        </motion.div>
      </div>

      {/* In the gap either side of the avatar. */}
      <ArrowButton
        direction="previous"
        onClick={() => go(index - 1)}
        disabled={disabled || index === 0}
        className="right-full mr-1"
      />
      <ArrowButton
        direction="next"
        onClick={() => go(index + 1)}
        disabled={disabled || index === agents.length - 1}
        className="left-full ml-1"
      />
    </div>
  );
}

function Slide({ agent, mood, active }: { agent: HomeAgent; mood: AgentMoodI; active: boolean }) {
  const { avatar } = agent;
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={agent.name}
      aria-hidden={!active}
      className="w-full shrink-0"
    >
      {avatar ? (
        // Both language avatars share one cell and crossfade, so switching never flashes blank.
        <div className="grid">
          {[AgentMoodEnum.ENGLISH, AgentMoodEnum.SPANISH].map(m => (
            <Image
              key={m}
              src={avatar[m]}
              alt={m === mood ? `${agent.name} Avatar` : ''}
              aria-hidden={m !== mood}
              width={328}
              height={328}
              // Profile photos come from the sign-in provider, not this app; SVGs need no optimizing.
              unoptimized={avatar[m].startsWith('http') || avatar[m].endsWith('.svg')}
              draggable={false}
              className={clsx(
                '[grid-area:1/1] aspect-square w-full object-cover select-none transition-opacity duration-300 motion-reduce:transition-none',
                m === mood ? 'opacity-100' : 'opacity-0'
              )}
              priority
            />
          ))}
        </div>
      ) : (
        <PlaceholderAvatar name={agent.name} initials={agent.initials} />
      )}
    </div>
  );
}

// Stands in until the agent has artwork: the initials on the avatar's paper tone.
function PlaceholderAvatar({ name, initials: given }: { name: string; initials?: string }) {
  const initials =
    given ??
    name
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  return (
    <div
      role="img"
      aria-label={`${name} Avatar`}
      className="flex aspect-square w-full select-none items-center justify-center border-2 border-dashed border-[#A15EED]/40 bg-white/70"
    >
      <span className="font-inter text-5xl md:text-7xl font-semibold tracking-[0.1em] text-[#A15EED]/70">
        {initials}
      </span>
    </div>
  );
}

function ArrowButton({
  direction,
  onClick,
  disabled,
  className,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'previous' ? 'Previous agent' : 'Next agent'}
      className={clsx(
        'absolute top-1/2 z-10 flex h-10 w-8 -translate-y-1/2 items-center justify-center text-[#A15EED] transition-opacity hover:text-[#7C3AED] disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]',
        className
      )}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        aria-hidden="true"
      >
        <path
          d={direction === 'previous' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
