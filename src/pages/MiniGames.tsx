import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, Search, Users, Smartphone, Heart, Settings, ShieldAlert, 
  Zap, Trophy, Coins, Clock, Sparkles, TrendingUp 
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { OnlineGamesService } from "@/services/OnlineGamesService";
import { MobileGamesService } from "@/services/MobileGamesService";
import EmbeddedGamePlayer from "@/components/games/EmbeddedGamePlayer";
import { useFavoriteGames } from "@/hooks/useFavoriteGames";
import { shuffleArray } from "@/utils/shuffleArray";
import { AddGameDialog } from "@/components/games/AddGameDialog";

export default function MiniGames() {
  const navigate = useNavigate();
  const { profile, isConnected } = useWalletAuth();
  const { favorites, isFavorite, toggleFavorite } = useFavoriteGames();
  const { isAdmin } = useAdminAuth();
  const [embeddedGames, setEmbeddedGames] = useState<any[]>([]);
  const [mobileGames, setMobileGames] = useState<any[]>([]);
  const [filteredGames, setFilteredGames] = useState<any[]>([]);
  const [filteredMobileGames, setFilteredMobileGames] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMobileCategory, setSelectedMobileCategory] = useState("all");
  const [showMultiplayerOnly, setShowMultiplayerOnly] = useState(false);
  const [selectedEmbeddedGame, setSelectedEmbeddedGame] = useState<any | null>(null);
  const [loadingGames, setLoadingGames] = useState(true);
  const [pcGamesPage, setPcGamesPage] = useState(1);
  const [mobileGamesPage, setMobileGamesPage] = useState(1);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const GAMES_PER_PAGE = 25;

  useEffect(() => {
    loadEmbeddedGames();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const loadEmbeddedGames = async () => {
    setLoadingGames(true);
    try {
      const games = await OnlineGamesService.fetchGames();
      
      // Separate CrazyGames iframe games and others
      const crazyGames = games.filter((game: any) => 
        game.iframe?.includes('crazygames.com')
      );
      const otherGames = games.filter((game: any) => 
        !game.iframe?.includes('crazygames.com')
      );
      
      // Shuffle CrazyGames and put them first, then shuffle others
      const shuffledCrazyGames = shuffleArray(crazyGames);
      const shuffledOtherGames = shuffleArray(otherGames);
      const orderedGames = [...shuffledCrazyGames, ...shuffledOtherGames];
      
      setEmbeddedGames(orderedGames);
      setFilteredGames(orderedGames);
      
      const hardcodedMobileGames = MobileGamesService.getAllGames();
      const allMobileGames = [...hardcodedMobileGames];
      games.forEach((game: any) => {
        if (!allMobileGames.find(mg => mg.id === game.id)) {
          allMobileGames.push(game);
        }
      });
      
      const shuffledMobileGames = shuffleArray(allMobileGames);
      setMobileGames(shuffledMobileGames);
      setFilteredMobileGames(shuffledMobileGames);
    } catch (error) {
      console.error("Error loading embedded games:", error);
      toast.error("Failed to load games");
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    let filtered = embeddedGames;

    if (searchQuery) {
      filtered = filtered.filter(game =>
        game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(game => game.category === selectedCategory);
    }

    if (showMultiplayerOnly) {
      filtered = filtered.filter(game => game.title.includes('[MULTIPLAYER]'));
    }

    setFilteredGames(filtered);
    setPcGamesPage(1);
  }, [searchQuery, selectedCategory, embeddedGames, showMultiplayerOnly]);

  useEffect(() => {
    let filtered = mobileGames;

    if (mobileSearchQuery) {
      filtered = filtered.filter(game =>
        game.title.toLowerCase().includes(mobileSearchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(mobileSearchQuery.toLowerCase())
      );
    }

    if (selectedMobileCategory !== "all") {
      filtered = filtered.filter(game => game.category === selectedMobileCategory);
    }

    setFilteredMobileGames(filtered);
    setMobileGamesPage(1);
  }, [mobileSearchQuery, selectedMobileCategory, mobileGames]);

  const stats = [
    { value: "100+", label: "PC Games", icon: Gamepad2, color: "#a855f7" },
    { value: "∞", label: "Rewards", icon: Coins, color: "#eab308" },
    { value: "24/7", label: "Play Time", icon: Clock, color: "#ec4899" },
  ];

  if (!isConnected || !profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-6">
            <Gamepad2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect to Play</h2>
          <p className="text-white/60 mb-6">Please connect your wallet to access Browser Games</p>
          <Button onClick={() => navigate('/connect')} className="bg-gradient-to-r from-purple-500 to-pink-500">
            Connect Wallet
          </Button>
        </motion.div>
      </div>
    );
  }

  if (selectedEmbeddedGame) {
    return (
      <EmbeddedGamePlayer
        gameId={selectedEmbeddedGame.id}
        gameTitle={selectedEmbeddedGame.title}
        gameIframe={selectedEmbeddedGame.iframe}
        onClose={() => setSelectedEmbeddedGame(null)}
        onGameEnd={() => {}}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(168, 85, 247, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(168, 85, 247, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(168, 85, 247, 0.4), transparent 70%)",
            left: mousePosition.x - 200,
            top: mousePosition.y - 200,
          }}
        />
        
        <motion.div
          className="absolute top-20 right-20 w-[300px] h-[300px] rounded-full blur-[80px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-20 left-20 w-[250px] h-[250px] rounded-full blur-[60px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(34, 197, 94, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(234, 179, 8, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(34, 197, 94, 0.2), transparent 70%)",
            ],
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Gamepad2 className="w-7 h-7 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600">
                    Play & Earn
                  </span>
                </h1>
                <p className="text-white/60 text-sm flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Earn AVLO tokens while gaming
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <AddGameDialog onGameAdded={loadEmbeddedGames} />
              
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  className="bg-black/50 border-purple-500/50 text-purple-400 hover:bg-purple-950/30 hover:border-purple-400"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all group"
              >
                <stat.icon className="w-5 h-5 mb-2 transition-colors" style={{ color: stat.color }} />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/50 uppercase tracking-wide">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border border-purple-500/20 p-5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-purple-500/5 animate-pulse" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  Play-to-Earn Gaming
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Live</Badge>
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Convert all your earned scores into airdrops by playing games! Each second is worth AVLO while playing. 
                  Rates may change in the future. Airdrops can be sent weekly, monthly, or quarterly.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="play" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <TabsTrigger 
              value="play" 
              className="relative rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/60 transition-all"
            >
              <Gamepad2 className="w-4 h-4 mr-2" />
              PC Games
            </TabsTrigger>
            
            <TabsTrigger 
              value="favorites" 
              className="relative rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/60 transition-all"
            >
              <Heart className="w-4 h-4 mr-2" />
              Favorites
            </TabsTrigger>
          </TabsList>

          <TabsContent value="play" className="space-y-4">
            {/* Ad Blocker Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 p-3"
            >
              <div className="flex items-center justify-center gap-2">
                <ShieldAlert className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-yellow-300 font-medium text-sm">
                  Using an ad blocker is recommended for a better gaming experience
                </span>
              </div>
            </motion.div>

            {/* Search & Filters */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search games..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl h-12 focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <Button
                  variant={showMultiplayerOnly ? "default" : "outline"}
                  onClick={() => setShowMultiplayerOnly(!showMultiplayerOnly)}
                  className={`gap-2 h-12 rounded-xl ${
                    showMultiplayerOnly 
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0" 
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Multiplayer
                  {showMultiplayerOnly && <span className="text-xs">({filteredGames.length})</span>}
                </Button>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  className={`rounded-full ${
                    selectedCategory === "all" 
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0" 
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  All Games
                </Button>
                {OnlineGamesService.getCategories().map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full capitalize whitespace-nowrap ${
                      selectedCategory === cat 
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0" 
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Games Grid */}
            {loadingGames ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredGames.slice((pcGamesPage - 1) * GAMES_PER_PAGE, pcGamesPage * GAMES_PER_PAGE).map((game, index) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card
                        className="bg-white/5 border-white/10 overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer group relative"
                        onClick={() => setSelectedEmbeddedGame(game)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 rounded-full w-8 h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(game.id, 'online');
                          }}
                        >
                          <Heart 
                            className={`w-4 h-4 ${isFavorite(game.id, 'online') ? 'fill-red-500 text-red-500' : 'text-white/60'}`}
                          />
                        </Button>
                        <div className="aspect-video bg-gradient-to-br from-purple-900/20 to-pink-900/20 flex items-center justify-center overflow-hidden relative">
                          <img 
                            src={game.thumbnail} 
                            alt={game.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <span className="text-white text-xs font-medium flex items-center gap-1">
                              <Zap className="w-3 h-3 text-yellow-400" />
                              Earn AVLO
                            </span>
                          </div>
                        </div>
                        <CardContent className="p-3 bg-black/50">
                          <h3 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-2 mb-2">
                            {game.title}
                          </h3>
                          <div className="flex items-center justify-between text-xs">
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">
                              Time-Based
                            </Badge>
                            <span className="text-green-400 font-semibold flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Free
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {filteredGames.length > GAMES_PER_PAGE && (
                  <div className="flex justify-center items-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPcGamesPage(p => Math.max(1, p - 1))}
                      disabled={pcGamesPage === 1}
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full"
                    >
                      Previous
                    </Button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(filteredGames.length / GAMES_PER_PAGE)) }, (_, i) => i + 1).map((pageNum) => (
                        <Button
                          key={pageNum}
                          variant={pageNum === pcGamesPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPcGamesPage(pageNum)}
                          className={`rounded-full w-9 h-9 ${
                            pageNum === pcGamesPage 
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0" 
                              : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                          }`}
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPcGamesPage(p => Math.min(Math.ceil(filteredGames.length / GAMES_PER_PAGE), p + 1))}
                      disabled={pcGamesPage >= Math.ceil(filteredGames.length / GAMES_PER_PAGE)}
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>


          <TabsContent value="favorites" className="space-y-4">
            {favorites.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
                  <Heart className="w-10 h-10 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Favorites Yet</h3>
                <p className="text-white/60">Click the heart icon on any game to add it to your favorites</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {favorites.map((fav, index) => {
                  const game = fav.game_type === 'mobile' 
                    ? mobileGames.find(g => g.id === fav.game_id)
                    : embeddedGames.find(g => g.id === fav.game_id);
                  
                  if (!game) return null;
                  
                  return (
                    <motion.div
                      key={fav.game_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card
                        className="bg-white/5 border-white/10 overflow-hidden hover:border-red-500/50 transition-all cursor-pointer group relative"
                        onClick={() => setSelectedEmbeddedGame(game)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 rounded-full w-8 h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(fav.game_id, fav.game_type);
                          }}
                        >
                          <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                        </Button>
                        <div className="aspect-video bg-gradient-to-br from-red-900/20 to-pink-900/20 flex items-center justify-center overflow-hidden relative">
                          <img 
                            src={game.thumbnail} 
                            alt={game.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <CardContent className="p-3 bg-black/50">
                          <h3 className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors line-clamp-2 mb-2">
                            {game.title}
                          </h3>
                          <Badge className={`text-[10px] ${
                            fav.game_type === 'mobile' 
                              ? "bg-green-500/20 text-green-300 border-green-500/30" 
                              : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          }`}>
                            {fav.game_type === 'mobile' ? 'Mobile' : 'PC'}
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
