import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Loader2, Cpu, Binary } from 'lucide-react';

interface ConnectCaptchaProps {
  onPass: () => void;
}

type ChallengeType = 'math' | 'sequence';

interface Challenge {
  question: string;
  hint: string;
  correctAnswer: string;
  options: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateChallenge(): Challenge {
  const type: ChallengeType = Math.random() > 0.35 ? 'math' : 'sequence';

  if (type === 'math') {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const op = Math.random() > 0.5 ? '+' : '-';
    let answer: number;
    if (op === '+') answer = a + b;
    else answer = Math.max(a, b) - Math.min(a, b);

    const correct = answer.toString();
    const wrongs = new Set<string>();
    while (wrongs.size < 3) {
      const w = answer + Math.floor(Math.random() * 6) - 3;
      if (w !== answer && w >= 0) wrongs.add(w.toString());
    }
    return {
      question: `${op === '-' ? Math.max(a, b) : a} ${op} ${op === '-' ? Math.min(a, b) : b} = ?`,
      hint: 'Solve',
      correctAnswer: correct,
      options: shuffle([correct, ...Array.from(wrongs)]),
    };
  }

  // sequence - simple +1, +2 or +3
  const step = Math.floor(Math.random() * 3) + 1;
  const start = Math.floor(Math.random() * 5) + 1;
  const seq = [start, start + step, start + step * 2];
  const answer = (start + step * 3).toString();
  const wrongs = new Set<string>();
  while (wrongs.size < 3) {
    const w = start + step * 3 + Math.floor(Math.random() * 6) - 3;
    if (w.toString() !== answer && w >= 0) wrongs.add(w.toString());
  }
  return {
    question: `${seq.join(', ')}, ?`,
    hint: 'Next Number',
    correctAnswer: answer,
    options: shuffle([answer, ...Array.from(wrongs)]),
  };
}

export default function ConnectCaptcha({ onPass }: ConnectCaptchaProps) {
  const [challenge, setChallenge] = useState<Challenge>(generateChallenge);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const handleSelect = useCallback((option: string) => {
    if (status !== 'idle') return;
    setSelected(option);

    if (option === challenge.correctAnswer) {
      setStatus('correct');
      setTimeout(() => onPass(), 400);
    } else {
      setStatus('wrong');
      setTimeout(() => {
        setChallenge(generateChallenge());
        setSelected(null);
        setStatus('idle');
      }, 900);
    }
  }, [challenge, status, onPass]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
    >
      {/* Tech background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-cyan-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[250px] h-[250px] bg-purple-500/8 rounded-full blur-[100px]" />
        {/* Scanning line */}
        <motion.div
          className="absolute left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <motion.div
        initial={{ y: 20, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        className="relative w-full max-w-sm"
      >
        {/* Card with animated border */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Animated gradient border */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 rounded-2xl p-[1px] bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite]">
            <div className="w-full h-full bg-zinc-950 rounded-2xl" />
          </div>

          <div className="relative p-6 space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">Human Verification</span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">{challenge.hint}</p>
            </div>

            {/* Challenge display */}
            <div className="text-center">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-black border border-zinc-800 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
                <Binary className="w-5 h-5 text-cyan-500/50" />
                <span className="text-2xl md:text-3xl font-mono font-bold text-transparent bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text">
                  {challenge.question}
                </span>
              </div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {challenge.options.map((option, i) => {
                const isSelected = selected === option;
                const isCorrect = status === 'correct' && isSelected;
                const isWrong = status === 'wrong' && isSelected;

                return (
                  <motion.button
                    key={`${challenge.question}-${option}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleSelect(option)}
                    disabled={status !== 'idle'}
                    whileHover={status === 'idle' ? { scale: 1.03 } : {}}
                    whileTap={status === 'idle' ? { scale: 0.97 } : {}}
                    className={`
                      relative px-4 py-3 rounded-xl font-mono font-bold text-sm transition-all duration-200 border
                      ${isCorrect 
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                        : isWrong 
                          ? 'bg-red-500/15 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-cyan-500/40 hover:text-white hover:bg-zinc-800/80'
                      }
                    `}
                  >
                    {option}
                  </motion.button>
                );
              })}
            </div>

            {/* Status feedback */}
            <AnimatePresence>
              {status === 'correct' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-emerald-400"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">Access Granted</span>
                  <Loader2 className="w-3 h-3 animate-spin" />
                </motion.div>
              )}
              {status === 'wrong' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-xs font-mono text-red-400"
                >
                  ✗ Invalid — Recalibrating...
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="flex items-center justify-center gap-2">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-zinc-800" />
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.2em]">AvaLove Security</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-zinc-800" />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
