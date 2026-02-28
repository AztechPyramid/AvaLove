import diepThumbnail from '@/assets/diep-io-thumbnail.png';
import game2048Thumb from '@/assets/2048-thumb.jpg';
import tinyFishingThumb from '@/assets/tiny-fishing-thumb.jpg';
import holeyIoThumb from '@/assets/holey-io-thumb.jpg';
import bloxorzThumb from '@/assets/bloxorz-thumb.jpg';
import countMastersThumb from '@/assets/count-masters-thumb.jpg';
import stacktrisThumb from '@/assets/stacktris-thumb.jpg';
import mergeRushZThumb from '@/assets/merge-rush-z-thumb.jpg';
import trafficRunThumb from '@/assets/traffic-run-thumb.jpg';
import subwaySurfersThumb from '@/assets/subway-surfers-thumb.jpg';
import tunnelRushThumb from '@/assets/tunnel-rush-thumb.jpg';
import geometryDashThumb from '@/assets/geometry-dash-thumb.jpg';
import basketballStarsThumb from '@/assets/basketball-stars-thumb.jpg';
import vortexThumb from '@/assets/vortex-thumb.jpg';
import slopeGameThumb from '@/assets/slope-game-thumb.jpg';
import zombsRoyaleThumb from '@/assets/zombs-royale-thumb.jpg';
import krunkerThumb from '@/assets/krunker-thumb.jpg';
import combatReloadedThumb from '@/assets/combat-reloaded-thumb.jpg';
import survivIoThumb from '@/assets/surviv-io-thumb.jpg';
import voxiomThumb from '@/assets/voxiom-thumb.jpg';
import microsoftSolitaireThumb from '@/assets/microsoft-solitaire-thumb.jpg';
import woodokuThumb from '@/assets/woodoku-thumb.jpg';
import cutTheRopeThumb from '@/assets/cut-the-rope-thumb.jpg';
import ticTacToeThumb from '@/assets/tic-tac-toe-thumb.jpg';
import blockBlastThumb from '@/assets/block-blast-thumb.jpg';
import motoX3mThumb from '@/assets/moto-x3m-thumb.jpg';
import highwayRiderThumb from '@/assets/highway-rider-thumb.jpg';
import driftHuntersThumb from '@/assets/drift-hunters-thumb.jpg';
import bikeRacing3Thumb from '@/assets/bike-racing-3-thumb.jpg';
import crazyCarsThumb from '@/assets/crazy-cars-thumb.jpg';
import basketballLegendsThumb from '@/assets/basketball-legends-thumb.jpg';
import footballLegendsThumb from '@/assets/football-legends-thumb.jpg';
import tennisMastersThumb from '@/assets/tennis-masters-thumb.jpg';
import tableTennisThumb from '@/assets/table-tennis-thumb.jpg';
import penaltyShootersThumb from '@/assets/penalty-shooters-thumb.jpg';
import bloonsTdThumb from '@/assets/bloons-td-thumb.jpg';
import territorialIoThumb from '@/assets/territorial-io-thumb.jpg';
import islandOdysseyThumb from '@/assets/island-odyssey-thumb.jpg';
import idleMiningThumb from '@/assets/idle-mining-thumb.jpg';
import plantsVsZombiesThumb from '@/assets/plants-vs-zombies-thumb.jpg';

interface EmbeddedGame {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  iframe: string;
  tags: string[];
  category: string;
}

export class OnlineGamesService {
  // Only working iframe games that allow embedding
  private static MANUAL_GAMES: EmbeddedGame[] = [
    // === TOP PICKS & FEATURED ===
    {
      id: 'mahjongg-solitaire',
      title: 'Mahjongg Solitaire',
      description: 'Classic Mahjong tile matching puzzle!',
      thumbnail: 'https://imgs.crazygames.com/games/mahjongg-solitaire/cover_16x9-1707829450935.png?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/mahjongg-solitaire/index.html',
      tags: ['puzzle', 'mahjong', 'classic'],
      category: 'puzzle'
    },
    {
      id: 'ragdoll-archers',
      title: 'Ragdoll Archers',
      description: 'Physics-based archery combat!',
      thumbnail: 'https://imgs.crazygames.com/ragdoll-archers_16x9/20250926080758/ragdoll-archers_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/ragdoll-archers/index.html',
      tags: ['action', 'physics', 'archery'],
      category: 'action'
    },
    {
      id: 'space-waves',
      title: 'Space Waves',
      description: 'Navigate through cosmic waves!',
      thumbnail: 'https://imgs.crazygames.com/space-waves_16x9/20241203031650/space-waves_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/space-waves/index.html',
      tags: ['arcade', 'space', 'rhythm'],
      category: 'arcade'
    },
    {
      id: 'farm-merge-valley',
      title: 'Farm Merge Valley',
      description: 'Merge and build your dream farm!',
      thumbnail: 'https://imgs.crazygames.com/farm-merge-valley_16x9/20251002051802/farm-merge-valley_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/farm-merge-valley/index.html',
      tags: ['merge', 'farm', 'strategy'],
      category: 'strategy'
    },
    {
      id: 'mergest-kingdom',
      title: 'Mergest Kingdom',
      description: 'Merge items to build a magical kingdom!',
      thumbnail: 'https://imgs.crazygames.com/mergest-kingdom_16x9/20251124121228/mergest-kingdom_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/mergest-kingdom/index.html',
      tags: ['merge', 'kingdom', 'strategy'],
      category: 'strategy'
    },
    {
      id: '8-ball-billiards',
      title: '8 Ball Billiards Classic',
      description: 'Classic pool billiards game!',
      thumbnail: 'https://imgs.crazygames.com/8-ball-billiards-classic_16x9/20231108025958/8-ball-billiards-classic_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/8-ball-billiards-classic/index.html',
      tags: ['sports', 'billiards', 'pool'],
      category: 'sports'
    },
    {
      id: 'animal-world',
      title: 'Animal World',
      description: 'Explore an open world with animals!',
      thumbnail: 'https://imgs.crazygames.com/palmons-open-world_16x9/20251110075655/palmons-open-world_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/palmons-open-world/index.html',
      tags: ['adventure', 'animals', 'openworld'],
      category: 'action'
    },
    {
      id: '2048',
      title: '2048',
      description: 'Classic number merging puzzle!',
      thumbnail: game2048Thumb,
      iframe: 'https://games.crazygames.com/en_US/2048/index.html',
      tags: ['puzzle', 'numbers', 'classic'],
      category: 'puzzle'
    },
    {
      id: 'tiny-fishing',
      title: 'Tiny Fishing',
      description: 'Relaxing fishing game!',
      thumbnail: tinyFishingThumb,
      iframe: 'https://games.crazygames.com/en_US/tiny-fishing/index.html',
      tags: ['casual', 'fishing', 'relaxing'],
      category: 'arcade'
    },
    {
      id: 'holey-io',
      title: 'Holey.io Battle Royale',
      description: 'Be the biggest hole in the arena!',
      thumbnail: holeyIoThumb,
      iframe: 'https://games.crazygames.com/en_US/holey-io-battle-royale/index.html',
      tags: ['io', 'battle', 'hole'],
      category: 'action'
    },
    {
      id: 'sandbox-city',
      title: 'Sandbox City',
      description: 'Zombie ragdoll sandbox!',
      thumbnail: 'https://imgs.crazygames.com/sandbox-city---cars-zombies-ragdolls_16x9/20250909075759/sandbox-city---cars-zombies-ragdolls_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/sandbox-city---cars-zombies-ragdolls/index.html',
      tags: ['sandbox', 'zombie', 'ragdoll'],
      category: 'action'
    },
    {
      id: 'bloxorz',
      title: 'Bloxorz',
      description: 'Classic block rolling puzzle!',
      thumbnail: bloxorzThumb,
      iframe: 'https://games.crazygames.com/en_US/bloxorz/index.html',
      tags: ['puzzle', 'block', 'brain'],
      category: 'puzzle'
    },

    // === POPULAR MULTIPLAYER GAMES ===
    {
      id: 'bloxd-io',
      title: 'Bloxd.io [MULTIPLAYER]',
      description: 'Minecraft-style multiplayer game with up to 19 players!',
      thumbnail: 'https://imgs.crazygames.com/bloxdhop-io_16x9/20250829023851/bloxdhop-io_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/bloxdhop-io/index.html',
      tags: ['multiplayer', 'io', 'minecraft'],
      category: 'action'
    },
    {
      id: 'buildnow-gg',
      title: 'BuildNow GG [MULTIPLAYER]',
      description: 'Fast-paced building and shooting with up to 12 players!',
      thumbnail: 'https://imgs.crazygames.com/buildnow-gg_16x9/20250217093036/buildnow-gg_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/buildnow-gg/index.html',
      tags: ['multiplayer', 'shooting', 'building'],
      category: 'action'
    },
    {
      id: 'shell-shockers',
      title: 'Shell Shockers [MULTIPLAYER]',
      description: 'Egg shooting mayhem with up to 18 players!',
      thumbnail: 'https://imgs.crazygames.com/shellshockersio_16x9/20251107172007/shellshockersio_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/shellshockersio/index.html',
      tags: ['multiplayer', 'io', 'shooter'],
      category: 'action'
    },
    {
      id: 'miniblox',
      title: 'Miniblox [MULTIPLAYER]',
      description: 'Massive multiplayer with up to 48 players!',
      thumbnail: 'https://imgs.crazygames.com/miniblox_16x9/20240617083401/miniblox_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/miniblox/index.html',
      tags: ['multiplayer', 'io', 'sandbox'],
      category: 'action'
    },
    {
      id: 'skillwarz',
      title: 'SkillWarz [MULTIPLAYER]',
      description: 'Competitive shooting with up to 10 players!',
      thumbnail: 'https://imgs.crazygames.com/skillwarz_16x9/20250225074000/skillwarz_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/skillwarz/index.html',
      tags: ['multiplayer', 'shooting', 'competitive'],
      category: 'action'
    },
    {
      id: 'kirka-io',
      title: 'Kirka.io [MULTIPLAYER]',
      description: 'Pixelated FPS with up to 50 players!',
      thumbnail: 'https://imgs.crazygames.com/kirka-io_16x9/20251001025235/kirka-io_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/kirka-io/index.html',
      tags: ['multiplayer', 'io', 'fps'],
      category: 'action'
    },
    {
      id: 'war-brokers',
      title: 'War Brokers [MULTIPLAYER]',
      description: 'Military FPS with up to 50 players and vehicles!',
      thumbnail: 'https://imgs.crazygames.com/war-brokers-io_16x9/20241105062359/war-brokers-io_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/war-brokers-io/index.html',
      tags: ['multiplayer', 'io', 'military'],
      category: 'action'
    },
    {
      id: 'fortzone-battle-royale',
      title: 'Fortzone Battle Royale [MULTIPLAYER]',
      description: 'Battle royale with building and up to 30 players!',
      thumbnail: 'https://imgs.crazygames.com/fortzone-battle-royale-xkd_16x9/20250513044222/fortzone-battle-royale-xkd_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/fortzone-battle-royale-xkd/index.html',
      tags: ['multiplayer', 'battle', 'royale'],
      category: 'action'
    },

    // === SPORTS MULTIPLAYER ===
    {
      id: '8-ball-pool',
      title: '8 Ball Pool [MULTIPLAYER]',
      description: 'Classic billiards with up to 100 players!',
      thumbnail: 'https://imgs.crazygames.com/8-ball-pool-billiards-multiplayer_16x9/20240826034902/8-ball-pool-billiards-multiplayer_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/8-ball-pool-billiards-multiplayer/index.html',
      tags: ['multiplayer', 'sports', 'billiards'],
      category: 'sports'
    },
    {
      id: 'unmatched-ego',
      title: 'Unmatched Ego [MULTIPLAYER]',
      description: 'Soccer action with up to 6 players!',
      thumbnail: 'https://imgs.crazygames.com/unmatched-ego---soccer-action_16x9/20250711023134/unmatched-ego---soccer-action_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/unmatched-ego---soccer-action/index.html',
      tags: ['multiplayer', 'sports', 'soccer'],
      category: 'sports'
    },
    {
      id: 'golf-mania',
      title: 'Golf Mania [MULTIPLAYER]',
      description: 'Crazy golf with up to 12 players!',
      thumbnail: 'https://imgs.crazygames.com/golf-mania_16x9/20250617091855/golf-mania_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/golf-mania/index.html',
      tags: ['multiplayer', 'sports', 'golf'],
      category: 'sports'
    },

    // === RACING MULTIPLAYER ===
    {
      id: 'racing-limits',
      title: 'Racing Limits [MULTIPLAYER]',
      description: 'High-speed racing with up to 2 players!',
      thumbnail: 'https://imgs.crazygames.com/racing-limits_16x9/20250711091800/racing-limits_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/racing-limits/index.html',
      tags: ['multiplayer', 'racing', 'speed'],
      category: 'racing'
    },

    // === PUZZLE/STRATEGY MULTIPLAYER ===
    {
      id: 'checkers-free',
      title: 'Checkers Free [MULTIPLAYER]',
      description: 'Classic checkers for 2 players!',
      thumbnail: 'https://imgs.crazygames.com/checkers-free_16x9/20250331052950/checkers-free_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/checkers-free/index.html',
      tags: ['multiplayer', 'puzzle', 'checkers'],
      category: 'puzzle'
    },
    {
      id: 'connect-4',
      title: 'Connect 4 [MULTIPLAYER]',
      description: 'Connect four online with up to 42 players!',
      thumbnail: 'https://imgs.crazygames.com/games/4-in-a-row-connected-multiplayer-online/cover_16x9-1739759253546.png?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/4-in-a-row-connected-multiplayer-online/index.html',
      tags: ['multiplayer', 'puzzle', 'strategy'],
      category: 'puzzle'
    },

    // === CASUAL MULTIPLAYER ===
    {
      id: 'worldguessr',
      title: 'WorldGuessr [MULTIPLAYER]',
      description: 'Geography guessing with 100+ players!',
      thumbnail: 'https://imgs.crazygames.com/worldguessr_16x9/20241018082520/worldguessr_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/worldguessr/index.html',
      tags: ['multiplayer', 'casual', 'geography'],
      category: 'arcade'
    },
    {
      id: 'squid-game-online',
      title: 'Squid Game Online [MULTIPLAYER]',
      description: 'Survive games with up to 30 players!',
      thumbnail: 'https://imgs.crazygames.com/squid-game-online_16x9/20250403161318/squid-game-online_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/squid-game-online/index.html',
      tags: ['multiplayer', 'arcade', 'survival'],
      category: 'arcade'
    },

    // === ORIGINAL GAMES ===
    {
      id: 'diep-io',
      title: 'Diep.io [Only PC or Tablet]',
      description: 'Upgrade your tank and dominate the battlefield!',
      thumbnail: diepThumbnail,
      iframe: 'https://diep.io/',
      tags: ['io', 'tank'],
      category: 'action'
    },
    {
      id: 'evowars-io',
      title: 'EvoWars.io',
      description: 'Battle and evolve to become the ultimate warrior!',
      thumbnail: 'https://imgs.crazygames.com/evowarsio_16x9/20251003061326/evowarsio_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/evowarsio/index.html',
      tags: ['io', 'battle', 'evolution'],
      category: 'action'
    },
    {
      id: 'deadshot-io',
      title: 'DEADSHOT.io',
      description: 'Fast-paced FPS action in your browser!',
      thumbnail: 'https://imgs.crazygames.com/games/deadshot-io/cover_16x9-1694770506842.png?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/deadshot-io/index.html',
      tags: ['io', 'fps', 'shooter'],
      category: 'action'
    },
    {
      id: 'punchers',
      title: 'Punchers',
      description: 'Step into the ring and fight to win!',
      thumbnail: 'https://imgs.crazygames.com/punchers_16x9/20241223161057/punchers_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/punchers/index.html',
      tags: ['boxing', 'fighting', 'sports'],
      category: 'sports'
    },
    {
      id: 'smash-karts',
      title: 'Smash Karts',
      description: 'Kart racing with explosive combat action!',
      thumbnail: 'https://imgs.crazygames.com/smash-karts_16x9/20251127132240/smash-karts_16x9-cover?metadata=none&quality=85&width=196&dpr=1',
      iframe: 'https://games.crazygames.com/en_US/smash-karts/index.html',
      tags: ['kart', 'battle', 'racing'],
      category: 'action'
    },
    {
      id: 'count-masters',
      title: 'Count Masters [Mobile]',
      description: 'Multiply your stickman army and conquer!',
      thumbnail: countMastersThumb,
      iframe: 'https://games.crazygames.com/en_US/count-masters-stickman-games/index.html',
      tags: ['runner', 'stickman', 'casual'],
      category: 'arcade'
    },
    {
      id: 'merge-rush-z',
      title: 'Merge Rush Z [Mobile]',
      description: 'Merge soldiers and fight zombies!',
      thumbnail: mergeRushZThumb,
      iframe: 'https://games.crazygames.com/en_US/merge-rush-z/index.html',
      tags: ['merge', 'zombie', 'runner'],
      category: 'arcade'
    },

    // === MORE RACING GAMES ===
    {
      id: 'drift-hunters',
      title: 'Drift Hunters',
      description: 'Master the art of drifting!',
      thumbnail: driftHuntersThumb,
      iframe: 'https://games.crazygames.com/en_US/drift-hunters/index.html',
      tags: ['racing', 'drift', 'cars'],
      category: 'racing'
    },

    // === MORE SPORTS GAMES ===
    {
      id: 'table-tennis',
      title: 'Table Tennis World Tour',
      description: 'Ping pong championship!',
      thumbnail: tableTennisThumb,
      iframe: 'https://games.crazygames.com/en_US/table-tennis-world-tour/index.html',
      tags: ['sports', 'tennis', 'casual'],
      category: 'sports'
    },
    {
      id: 'penalty-shooters',
      title: 'Penalty Shooters [MULTIPLAYER]',
      description: 'Score penalty goals!',
      thumbnail: penaltyShootersThumb,
      iframe: 'https://games.crazygames.com/en_US/penalty-shooters-2/index.html',
      tags: ['multiplayer', 'sports', 'soccer'],
      category: 'sports'
    },

    // === MORE STRATEGY GAMES ===
  ];

  static async fetchGames(): Promise<EmbeddedGame[]> {
    try {
      // Import supabase dynamically to avoid circular dependencies
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Fetch games from database
      const { data: dbGames, error } = await supabase
        .from('online_games')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching games from database:', error);
      }

      // Combine manual games with database games
      const allGames = [...this.MANUAL_GAMES];
      
      if (dbGames && dbGames.length > 0) {
        // Add database games that don't exist in manual list
        dbGames.forEach(dbGame => {
          if (!allGames.find(g => g.id === dbGame.id)) {
            allGames.push({
              id: dbGame.id,
              title: dbGame.title,
              description: dbGame.description,
              thumbnail: dbGame.thumbnail,
              iframe: dbGame.iframe,
              tags: dbGame.tags || [],
              category: dbGame.category
            });
          }
        });
      }

      return allGames;
    } catch (error) {
      console.error('Error in fetchGames:', error);
      // Return manual games as fallback
      return this.MANUAL_GAMES;
    }
  }

  static async getGameById(id: string): Promise<EmbeddedGame | null> {
    const games = await this.fetchGames();
    return games.find(game => game.id === id) || null;
  }

  static async searchGames(query: string): Promise<EmbeddedGame[]> {
    const games = await this.fetchGames();
    const lowerQuery = query.toLowerCase();
    
    return games.filter(game => 
      game.title.toLowerCase().includes(lowerQuery) ||
      game.description.toLowerCase().includes(lowerQuery) ||
      game.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  static async getGamesByCategory(category: string): Promise<EmbeddedGame[]> {
    const games = await this.fetchGames();
    return games.filter(game => game.category === category);
  }

  static getCategories(): string[] {
    return ['arcade', 'action', 'puzzle', 'racing', 'sports', 'strategy'];
  }
}
