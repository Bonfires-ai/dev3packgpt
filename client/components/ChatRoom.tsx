'use client';

import { VoiceAssistant } from '@/components/VoiceAssistant';
import { AgentMoodI } from '@/types/agent';
import { RoomContext } from '@livekit/components-react';
import { motion } from 'framer-motion';
import { Room } from 'livekit-client';

export function ChatRoom({
  room,
  mood,
  ended,
  onRestart,
}: {
  room: Room;
  mood: AgentMoodI;
  ended: boolean;
  onRestart: () => void;
}) {
  return (
    <motion.main
      data-lk-theme="default"
      className="fixed inset-0 z-30 bg-[#F5F5F5]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <RoomContext.Provider value={room}>
        <VoiceAssistant mood={mood} ended={ended} onRestart={onRestart} />
      </RoomContext.Provider>
    </motion.main>
  );
}
