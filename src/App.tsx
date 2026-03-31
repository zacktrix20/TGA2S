/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, loginWithGoogle, logout, loginAnonymously, handleFirestoreError, OperationType, signinWithEmail, signupWithEmail } from './firebase';
import { localAuth, LocalUser } from './localAuth';
import { doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { UserProfile, Post, WeatherData } from './types';
import { cn, formatDate } from './lib/utils';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Droplets, 
  MessageSquare, 
  ThumbsUp, 
  Share2, 
  Plus, 
  Send, 
  User as UserIcon,
  LogOut,
  Bell,
  AlertTriangle,
  TrendingUp,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  MapPin,
  Leaf,
  CheckCircle,
  Users,
  Zap,
  Globe,
  ArrowRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchWeatherData } from './services/weatherService';
import { getAgriculturalAdvice, getSpeechFromText } from './services/geminiService';
import { TANZANIA_REGIONS } from './constants';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Kuna tatizo limetokea. Tafadhali pakia upya ukurasa.";
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = `Tatizo la Kanzidata: ${parsed.error}`;
          }
        }
      } catch (e) {
        // Not JSON, use default or error.message
        if (this.state.error?.message) errorMessage = this.state.error.message;
      }

      return (
        <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-red-900 mb-2">Oops! Hitilafu Imetokea</h2>
          <p className="text-red-700 mb-8 max-w-md">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
          >
            Jaribu Tena
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
  >
    <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-red-500/20">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm font-bold leading-tight">{message}</p>
      </div>
      <button 
        onClick={onClose}
        className="p-2 hover:bg-white/10 rounded-xl transition-colors"
      >
        <Plus className="w-5 h-5 rotate-45" />
      </button>
    </div>
  </motion.div>
);

const LoginModal = ({ isOpen, onClose, onSubmit, isLoading, error }: { isOpen: boolean; onClose: () => void; onSubmit: (email: string, password: string, isSignup: boolean) => Promise<void>; isLoading: boolean; error: string | null }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !password) {
      setLocalError('Tafadhali jaza sehemu zote');
      return;
    }
    try {
      await onSubmit(email, password, isSignup);
      setEmail('');
      setPassword('');
      onClose();
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-green-900">{isSignup ? 'Jandali Mpya' : 'Ingia'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Barua Pepe</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                disabled={isLoading}
              />
              {isSignup && <p className="text-xs text-gray-500 mt-1">Jina lako la mkulima litakuwa kutoka barua pepe yako.</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nenosiri</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                disabled={isLoading}
              />
            </div>

            {(error || localError) && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600 font-bold">
                {error || localError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-2xl transition-all active:scale-95"
            >
              {isLoading ? 'Inapokea...' : (isSignup ? 'Jandali' : 'Ingia')}
            </button>

            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setLocalError(null); }}
              disabled={isLoading}
              className="w-full text-green-600 font-bold py-2 hover:bg-green-50 rounded-2xl transition-colors"
            >
              {isSignup ? 'Una akaunti tayari? Ingia' : 'Sina akaunti. Jandali'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Navbar = ({ user, onLogout, onLogin, onGoHome }: { user: UserProfile | null; onLogout: () => void; onLogin: () => void; onGoHome: () => void }) => (
  <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-green-100 px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-2 cursor-pointer group" onClick={onGoHome}>
      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200 group-hover:scale-110 transition-transform">
        <Leaf className="w-6 h-6" />
      </div>
      <div className="flex flex-col">
        <h1 className="font-black text-xl text-green-900 leading-none">TGAS</h1>
        <span className="text-[8px] font-bold text-green-600 uppercase tracking-tighter">Tanzania Green Agri System</span>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <button 
        onClick={onGoHome}
        className="text-sm font-bold text-gray-500 hover:text-green-600 transition-colors hidden sm:block"
      >
        Nyumbani
      </button>
      {user ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Profile" className="w-6 h-6 rounded-full" />
            <span className="text-sm font-medium text-green-800 hidden sm:block">{user.displayName}</span>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button 
          onClick={onLogin}
          className="bg-green-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95"
        >
          Ingia
        </button>
      )}
    </div>
  </nav>
);

const HeroSlider = () => {
  const images = [
    "https://images.unsplash.com/photo-1590682680695-43b964a3ae17?q=80&w=1920&auto=format&fit=crop", // Tanzanian landscape/farming
    "https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=1920&auto=format&fit=crop", // Green fields
    "https://images.unsplash.com/photo-1592919016382-7450f7a88ad4?q=80&w=1920&auto=format&fit=crop", // African agriculture
    "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=1920&auto=format&fit=crop"  // Farming hands
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden z-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-black/50 z-10" />
          <img 
            src={images[index]} 
            alt="Tanzania Agriculture" 
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const LandingPage = ({ onLogin, onGoDashboard, onDemoLogin }: { onLogin: () => void; onGoDashboard: () => void; onDemoLogin: () => void }) => (
  <div className="min-h-screen relative flex flex-col">
    <HeroSlider />
    
    {/* Header */}
    <nav className="relative z-20 p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-xl">
          <Leaf className="w-7 h-7" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black text-white leading-none tracking-tighter">TGAS</span>
          <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Tanzania Green Agri System</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={onGoDashboard}
          className="text-white font-bold hover:text-green-400 transition-colors hidden sm:block"
        >
          Dashboard
        </button>
        <button 
          onClick={onLogin}
          className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-2.5 rounded-full font-bold hover:bg-white hover:text-green-900 transition-all active:scale-95"
        >
          Ingia
        </button>
      </div>
    </nav>

    {/* Hero Content */}
    <main className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-tight">
          Mapinduzi ya Kilimo <br />
          <span className="text-green-400">Kiganjani Mwako</span>
        </h1>
        <p className="text-xl text-gray-200 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
          Ungana na wakulima wenzako, pata ushauri wa AI, na fuatilia hali ya hewa kwa ajili ya mavuno bora nchini Tanzania.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={onDemoLogin}
            className="bg-green-600 text-white px-10 py-5 rounded-[2rem] font-black text-xl shadow-2xl shadow-green-900/50 hover:bg-green-500 transition-all flex items-center justify-center gap-3 group active:scale-95"
          >
            Anza Sasa Mkulima <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 w-full"
      >
        {[
          { label: 'Wakulima', value: '10k+', icon: Users },
          { label: 'Mikoa', value: '26+', icon: Globe },
          { label: 'Ushauri AI', value: '24/7', icon: Zap },
          { label: 'Mavuno', value: '+40%', icon: TrendingUp },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-green-400 mb-2">
              <stat.icon className="w-5 h-5" />
            </div>
            <span className="text-2xl font-black text-white">{stat.value}</span>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{stat.label}</span>
          </div>
        ))}
      </motion.div>
    </main>

    {/* Features Section */}
    <section className="relative z-20 bg-white py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 tracking-tighter">Kwanini Uchague TGAS?</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Tunatumia teknolojia ya kisasa kusaidia wakulima wa Tanzania kuongeza tija na kupunguza hasara.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: 'Ushauri wa AI', desc: 'AI yetu inatambua magonjwa ya mimea na kutoa ushauri wa kitaalamu wa Kiswahili.', icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
            { title: 'Hali ya Hewa', desc: 'Pata taarifa sahihi za hali ya hewa kwa kila mkoa wa Tanzania kulingana na zao lako.', icon: CloudRain, color: 'bg-blue-50 text-blue-600' },
            { title: 'Soko la Mazao', desc: 'Fuatilia bei za masoko mbalimbali nchini Tanzania kila siku bila gharama.', icon: TrendingUp, color: 'bg-green-50 text-green-600' },
          ].map((feat, i) => (
            <div key={i} className="p-8 rounded-[2.5rem] border border-gray-100 hover:border-green-100 hover:shadow-xl transition-all group">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform", feat.color)}>
                <feat.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">{feat.title}</h3>
              <p className="text-gray-500 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="relative z-20 bg-gray-50 py-12 px-6 border-t border-gray-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-600" />
          <span className="font-black text-gray-900">TGAS 2026</span>
        </div>
        <div className="flex gap-8 text-sm font-bold text-gray-400 uppercase tracking-widest">
          <a href="#" className="hover:text-green-600">Masharti</a>
          <a href="#" className="hover:text-green-600">Faragha</a>
          <a href="#" className="hover:text-green-600">Msaada</a>
        </div>
        <p className="text-gray-400 text-xs">Imetengenezwa kwa ajili ya Wakulima wa Tanzania 🇹🇿</p>
      </div>
    </footer>
  </div>
);

const WeatherCard = ({ weather, onRegionChange }: { weather: WeatherData | null; onRegionChange: (region: any) => void }) => {
  console.log('☀️ WeatherCard rendered. Weather data:', weather);
  
  if (!weather) return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-bold text-gray-700">⏳ Inakubali data ya hali ya hewa...</p>
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-12 w-24 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-32 w-full bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  );

  try {
    // Safe property access with defaults
    const currentTemp = weather.current?.temp || 0;
    const description = weather.current?.description || 'Hakuna maelezo';
    const icon = weather.current?.icon || '01d';
    const humidity = weather.current?.humidity || 0;
    const windSpeed = weather.current?.windSpeed || 0;
    const feelsLike = weather.current?.feelsLike || currentTemp;
    const daily = (weather as any).daily || [];
    const hourly = weather.hourly || [];
    
    const soilStatus = (weather as any).insights?.soilMoistureStatus || 'moderate';
    const farmingAdvice = (weather as any).insights?.farmingAdvice || 'Jaribu kuboresha udongo wako.';
    const bestMonth = (weather as any).insights?.bestPlantingMonth || 'Januari-Februari';

    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-1 text-gray-500 text-sm mb-1">
                <MapPin className="w-3 h-3 text-green-600" />
                <select 
                  className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer"
                  onChange={(e) => {
                    const region = TANZANIA_REGIONS.find(r => r.name === e.target.value);
                    if (region) onRegionChange(region);
                  }}
                >
                  {TANZANIA_REGIONS.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{currentTemp}°C</h2>
              <p className="text-gray-500 capitalize text-sm">{description}</p>
              <p className="text-[10px] text-gray-400 mt-1">Inayohisi: {feelsLike}°C</p>
            </div>
            <img 
              src={`https://openweathermap.org/img/wn/${icon}@2x.png`} 
              alt="Weather" 
              className="w-16 h-16"
            />
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-blue-50 p-3 rounded-2xl text-center">
              <Droplets className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <p className="text-[9px] text-blue-600 font-bold">Unyevu</p>
              <p className="font-black text-blue-900 text-sm">{humidity}%</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-2xl text-center">
              <Wind className="w-4 h-4 text-orange-600 mx-auto mb-1" />
              <p className="text-[9px] text-orange-600 font-bold">Upepo</p>
              <p className="font-black text-orange-900 text-sm">{windSpeed}m/s</p>
            </div>
            <div className="bg-green-50 p-3 rounded-2xl text-center border border-green-200">
              <Leaf className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-[9px] font-bold text-green-600">Udongo</p>
              <p className="font-black text-xs text-green-900">{soilStatus === 'dry' ? 'Kavu' : soilStatus === 'wet' ? 'Wenye' : 'Nzuri'}</p>
            </div>
          </div>

          {/* Hourly Chart */}
          {hourly.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Mwenendo wa Joto</p>
              <div className="h-40 w-full bg-white rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                    <Line type="monotone" dataKey="temp" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Daily Forecast */}
          {daily.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Siku 5 Ijayo</p>
              <div className="space-y-2">
                {daily.slice(0, 3).map((day: any, i: number) => (
                  <div key={i} className="bg-gray-50 p-3 rounded-2xl flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1">
                      <img src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`} alt="f" className="w-6 h-6" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-700">{day.description}</p>
                        <p className="text-[10px] text-gray-500">{day.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900">{day.tempMax}°/{day.tempMin}°</p>
                      <p className="text-[9px] text-blue-600">{day.precipitationProbability}% mvua</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advice Section */}
        <div className="bg-green-50 border-t border-green-100 p-4">
          <p className="text-[10px] text-green-700 font-black mb-2">💡 USHAURI WA UPANDAJI</p>
          <p className="text-xs text-green-900 leading-relaxed mb-2">{farmingAdvice}</p>
          <p className="text-[9px] text-green-600">📅 Wakati bora: <span className="font-bold">{bestMonth}</span></p>
        </div>
      </div>
    );
  } catch (error) {
    console.error('WeatherCard Error:', error);
    return (
      <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm bg-red-50">
        <p className="text-sm text-red-600 font-bold">⚠️ Hitilafu katika kuonyesha hali ya hewa</p>
        <p className="text-xs text-red-500 mt-2">{String(error)}</p>
      </div>
    );
  }
};

const AlertBanner = ({ alerts }: { alerts: WeatherData['alerts'] }) => {
  if (alerts.length === 0) return null;

  const getSeverityColor = (severity: string | undefined) => {
    switch(severity) {
      case 'high': return 'bg-red-50 border-red-100 text-red-900';
      case 'medium': return 'bg-yellow-50 border-yellow-100 text-yellow-900';
      case 'low': return 'bg-blue-50 border-blue-100 text-blue-900';
      default: return 'bg-red-50 border-red-100 text-red-900';
    }
  };

  const getSeverityBg = (severity: string | undefined) => {
    switch(severity) {
      case 'high': return 'bg-red-100 text-red-600';
      case 'medium': return 'bg-yellow-100 text-yellow-600';
      case 'low': return 'bg-blue-100 text-blue-600';
      default: return 'bg-red-100 text-red-600';
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div key={i} className={cn("border p-4 rounded-2xl flex gap-4 items-start animate-in fade-in slide-in-from-top-4 duration-500", getSeverityColor(alert.severity))}>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getSeverityBg(alert.severity))}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm mb-1">{alert.event}</h3>
            <p className="text-sm opacity-90 mb-2">{alert.description}</p>
            {alert.cropRecommendation && (
              <div className="bg-white/50 p-2 rounded-lg mt-2 border-l-2 border-current/30">
                <p className="text-xs font-bold opacity-75">🌾 {alert.cropRecommendation}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const PostCard = ({ post, onLike, onComment }: { post: Post; onLike: () => void; onComment: () => void }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6 group">
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img 
          src={post.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
          alt="Author" 
          className="w-10 h-10 rounded-full border-2 border-green-50" 
        />
        <div>
          <h4 className="font-bold text-gray-900 text-sm">{post.authorName}</h4>
          <p className="text-[10px] text-gray-400 font-medium">{formatDate(post.createdAt)}</p>
        </div>
      </div>
      <div className={cn(
        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
        post.type === 'success' ? "bg-green-100 text-green-700" : 
        post.type === 'question' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
      )}>
        {post.type === 'success' ? 'Mafanikio' : post.type === 'question' ? 'Swali' : 'Habari'}
      </div>
    </div>
    
    <div className="px-4 pb-4">
      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
    </div>

    {post.imageUrl && (
      <div className="px-4 pb-4">
        <img 
          src={post.imageUrl} 
          alt="Post" 
          className="w-full h-64 object-cover rounded-2xl"
          referrerPolicy="no-referrer"
        />
      </div>
    )}

    <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-6 border-t border-gray-50">
      <button 
        onClick={onLike}
        className="flex items-center gap-1.5 text-gray-500 hover:text-green-600 transition-colors group/btn"
      >
        <ThumbsUp className="w-4 h-4 group-active/btn:scale-125 transition-transform" />
        <span className="text-xs font-bold">{post.likesCount}</span>
      </button>
      <button 
        onClick={onComment}
        className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-bold">{post.commentsCount}</span>
      </button>
      <button className="flex items-center gap-1.5 text-gray-500 hover:text-purple-600 transition-colors ml-auto">
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const AIAdvisor = ({ user }: { user: UserProfile }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAsk = async () => {
    if (!query.trim() && !image) return;
    setLoading(true);
    setResponse('');
    
    let base64 = '';
    let mime = '';
    if (image) {
      const parts = image.split(';');
      mime = parts[0].split(':')[1];
      base64 = parts[1].split(',')[1];
    }

    const advice = await getAgriculturalAdvice(query || "Nieleze nini kinaonekana kwenye picha hii na jinsi ya kukitibu.", base64, mime);
    setResponse(advice || 'Samahani, sijapata jibu.');
    setLoading(false);
  };

  const handleSpeak = async () => {
    if (!response || isSpeaking) return;
    setIsSpeaking(true);
    const audioBase64 = await getSpeechFromText(response);
    if (audioBase64) {
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.onended = () => setIsSpeaking(false);
      audio.play();
    } else {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="bg-green-900 rounded-3xl p-6 text-white shadow-xl shadow-green-200/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-800 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Mshauri wa AI</h3>
            <p className="text-green-300 text-xs">Uliza au tuma picha</p>
          </div>
        </div>
        {response && (
          <button 
            onClick={handleSpeak}
            disabled={isSpeaking}
            className={cn(
              "p-2 rounded-xl transition-all",
              isSpeaking ? "bg-green-500 animate-pulse" : "bg-green-800 hover:bg-green-700"
            )}
          >
            <Wind className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {image && (
          <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-green-700">
            <img src={image} alt="Upload" className="w-full h-full object-cover" />
            <button onClick={() => setImage(null)} className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full"><Plus className="w-4 h-4 rotate-45" /></button>
          </div>
        )}

        {response && (
          <div className="bg-green-800/50 p-4 rounded-2xl text-sm leading-relaxed border border-green-700/50 animate-in fade-in zoom-in-95 duration-300">
            <div className="prose prose-invert prose-sm max-w-none">
              <Markdown>{response}</Markdown>
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Uliza chochote..."
            className="w-full bg-green-800/30 border border-green-700 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-green-600/50 resize-none h-24"
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <label className="w-10 h-10 bg-green-800 hover:bg-green-700 rounded-xl flex items-center justify-center cursor-pointer transition-colors">
              <ImageIcon className="w-5 h-5 text-green-400" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <button 
              onClick={handleAsk}
              disabled={loading}
              className="w-10 h-10 bg-green-500 hover:bg-green-400 disabled:bg-green-800 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-green-900/50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MarketPrices = () => {
  const prices = [
    { name: 'Mahindi', price: '750', trend: 'up', location: 'Kariakoo' },
    { name: 'Mpunga', price: '1200', trend: 'down', location: 'Mbeya' },
    { name: 'Maharage', price: '2100', trend: 'up', location: 'Arusha' },
    { name: 'Ulezi', price: '1800', trend: 'stable', location: 'Dodoma' },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-green-600" />
        Bei za Masoko Leo
      </h3>
      <div className="space-y-3">
        {prices.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl hover:bg-green-50 transition-colors cursor-default">
            <div>
              <span className="font-bold text-sm text-gray-700">{item.name}</span>
              <p className="text-[10px] text-gray-400">{item.location}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-sm text-gray-900">TZS {item.price}/kg</p>
              <p className={cn(
                "text-[10px] font-bold uppercase", 
                item.trend === 'up' ? "text-green-600" : item.trend === 'down' ? "text-red-600" : "text-gray-400"
              )}>
                {item.trend === 'up' ? '↑ Inapanda' : item.trend === 'down' ? '↓ Inashuka' : '→ Tulivu'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlantingCalendar = () => {
  const crops = [
    { name: 'Mahindi', planted: '2026-01-15', stage: 'Kupalilia', progress: 45 },
    { name: 'Maharage', planted: '2026-02-10', stage: 'Kuweka Mbolea', progress: 20 },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Bell className="w-4 h-4 text-orange-500" />
        Kalenda ya Kilimo
      </h3>
      <div className="space-y-4">
        {crops.map((crop, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">{crop.name}</span>
              <span className="text-[10px] font-bold text-orange-600 uppercase">{crop.stage}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full transition-all" style={{ width: `${crop.progress}%` }} />
            </div>
            <p className="text-[10px] text-gray-400">Ilipandwa: {crop.planted}</p>
          </div>
        ))}
        <button className="w-full py-2 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-xs font-bold hover:border-green-300 hover:text-green-600 transition-all">
          + Ongeza Zao Jipya
        </button>
      </div>
    </div>
  );
};

const SoilDataInput = () => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Droplets className="w-4 h-4 text-blue-500" />
        Hali ya Udongo
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-blue-50 rounded-2xl">
          <p className="text-[10px] text-blue-600 font-bold uppercase">pH ya Udongo</p>
          <p className="text-lg font-black text-blue-900">6.5</p>
        </div>
        <div className="p-3 bg-green-50 rounded-2xl">
          <p className="text-[10px] text-green-600 font-bold uppercase">Nitrogen</p>
          <p className="text-lg font-black text-green-900">Wastani</p>
        </div>
      </div>
      <button className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
        Sasisha Vipimo
      </button>
    </div>
  );
};

const FarmMap = () => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-red-500" />
        Ramani ya Shamba
      </h3>
      <div className="relative w-full h-48 bg-gray-100 rounded-2xl overflow-hidden mb-4">
        <img 
          src="https://picsum.photos/seed/farm-map/800/600" 
          alt="Farm Map Placeholder" 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl text-center">
            <p className="text-xs font-bold text-gray-900 mb-1">Ukubwa wa Shamba</p>
            <p className="text-xl font-black text-green-600">Ekari 2.5</p>
          </div>
        </div>
      </div>
      <button className="w-full border-2 border-gray-100 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
        Chora Mipaka
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, loadingAuth] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState(TANZANIA_REGIONS[0]);
  const [newPostContent, setNewPostContent] = useState('');
  const [postType, setPostType] = useState<'success' | 'question' | 'general'>('general');
  const [isPosting, setIsPosting] = useState(false);
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleDemoLogin = async () => {
    console.log('🎬 Going to dashboard as guest...');
    setView('dashboard');
  };

  const handleLogout = () => {
    localAuth.logout();
    setLocalUser(null);
    setProfile(null);
    setView('landing');
  };

  const handleLogin = () => {
    setShowLoginModal(true);
    setLoginError(null);
  };

  // Check for existing local user on app load
  useEffect(() => {
    const existingUser = localAuth.getCurrentUser();
    if (existingUser) {
      console.log('✅ Found existing user:', existingUser.name);
      setLocalUser(existingUser);
      setProfile({
        uid: existingUser.id,
        displayName: existingUser.name,
        email: existingUser.email,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${existingUser.id}`,
        createdAt: existingUser.createdAt,
      });
      setView('dashboard');
    }
  }, []);

  const handleEmailLogin = async (email: string, password: string, isSignup: boolean) => {
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      console.log('🔐 Login attempt - isSignup:', isSignup, 'email:', email);
      
      let user: LocalUser;
      if (isSignup) {
        // Extract name from email (part before @)
        const name = email.split('@')[0];
        console.log('📝 Creating new account:', name);
        user = localAuth.signup(name, email, password);
        console.log('✅ Account created:', user);
      } else {
        console.log('🔑 Signing in existing account:', email);
        user = localAuth.signin(email, password);
        console.log('✅ Signed in:', user);
      }
      
      console.log('📊 Setting local user state:', user.name);
      setLocalUser(user);
      setProfile({
        uid: user.id,
        displayName: user.name,
        email: user.email,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        createdAt: user.createdAt,
      });
      
      console.log('🚀 Closing modal and navigating to dashboard');
      setShowLoginModal(false);
      setTimeout(() => {
        console.log('📍 Setting view to dashboard');
        setView('dashboard');
      }, 100);
      
    } catch (error: any) {
      console.error('❌ Login error:', error.message);
      setLoginError(error.message || "Imeshindwa kuingia");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Auth & Profile Sync
  useEffect(() => {
    console.log('👤 Auth state changed - local user:', localUser?.name, 'Firebase user:', user?.email);
    
    // If local user is logged in, profile is already set
    if (localUser) {
      return;
    }
    
    // If guest mode (neither local nor Firebase user)
    if (!user && !localUser) {
      const guestProfile: UserProfile = {
        uid: 'guest-' + Math.random(),
        displayName: 'Mkulima Mkuu',
        email: 'guest@tgas.local',
        photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
        createdAt: new Date().toISOString(),
      };
      setProfile(guestProfile);
      return;
    }
    
    // If Firebase user is logged in (unlikely given our constraints, but handle it)
    if (user && view === 'landing') {
      console.log('🔄 Switching to dashboard...');
      setView('dashboard');
    }
  }, [user, localUser]);

  // Weather Sync - Trigger when user logs in OR region changes
  useEffect(() => {
    // Fetch weather always (guest mode included)
    const updateWeather = async () => {
      console.log('🌤️ Fetching weather for region:', selectedRegion.name, selectedRegion.lat, selectedRegion.lng);
      try {
        const data = await fetchWeatherData(selectedRegion.lat, selectedRegion.lng);
        console.log('✅ Weather data received:', data);
        if (data) {
          setWeather(data);
        } else {
          console.warn('⚠️ No weather data returned');
        }
      } catch (error) {
        console.error('❌ Weather fetch error:', error);
      }
    };
    
    // Fetch immediately
    updateWeather();
    
    // And then every 30 mins
    const interval = setInterval(updateWeather, 1000 * 60 * 30);
    return () => clearInterval(interval);
  }, [selectedRegion]);

  // Posts Sync - Works in guest mode
  useEffect(() => {
    const path = 'posts';
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(postsData);
    }, (error) => {
      console.warn('Could not fetch posts in guest mode:', error);
    });
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async () => {
    if (!user) {
      setErrorMessage("Tafadhali ingia (Login) ili uweze kuchapisha.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    if (!newPostContent.trim()) return;
    setIsPosting(true);
    const path = 'posts';
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL,
        content: newPostContent,
        type: postType,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      });
      setNewPostContent('');
      setPostType('general');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      setErrorMessage("Tafadhali ingia (Login) ili uweze kupenda (Like) chapisho.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    const path = `posts/${postId}/likes/${user.uid}`;
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', user.uid);
      const likeSnap = await getDoc(likeRef);
      
      if (likeSnap.exists()) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, 'posts', postId), { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { userId: user.uid, createdAt: new Date().toISOString() });
        await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  const displayUser = profile || (user ? { 
    uid: user.uid, 
    displayName: user.displayName || 'Mkulima', 
    email: user.email || '', 
    photoURL: user.photoURL || '', 
    createdAt: '' 
  } : null);

  // Show landing page if requested
  if (view === 'landing') {
    return (
      <>
        <AnimatePresence>
          {errorMessage && (
            <Toast message={errorMessage} onClose={() => setErrorMessage(null)} />
          )}
        </AnimatePresence>
        <LandingPage onLogin={handleLogin} onGoDashboard={() => setView('dashboard')} onDemoLogin={handleDemoLogin} />
        <LoginModal 
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSubmit={handleEmailLogin}
          isLoading={isLoggingIn}
          error={loginError}
        />
      </>
    );
  }

  // Default: Show dashboard
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAF9] pb-20">
        <Navbar user={displayUser} onLogout={handleLogout} onLogin={handleLogin} onGoHome={() => setView('landing')} />
        <AnimatePresence>
          {errorMessage && (
            <Toast message={errorMessage} onClose={() => setErrorMessage(null)} />
          )}
        </AnimatePresence>
        <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <WeatherCard weather={weather} onRegionChange={setSelectedRegion} />
            <AlertBanner alerts={weather?.alerts || []} />
            <AIAdvisor user={displayUser!} />
            <MarketPrices />
          </div>

          {/* Middle Column: Social Feed */}
          <div className="lg:col-span-6 space-y-6">
            {/* Create Post */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex gap-4 mb-4">
                <img 
                  src={displayUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'guest'}`} 
                  alt="Me" 
                  className="w-10 h-10 rounded-full" 
                />
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder={user ? "Shiriki mafanikio au uliza swali..." : "Ingia ili ushiriki mafanikio yako..."}
                  disabled={!user}
                  className="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-green-500 resize-none h-24 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(['general', 'success', 'question'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPostType(type)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                        postType === type 
                          ? "bg-green-600 text-white shadow-lg shadow-green-200" 
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {type === 'general' ? 'Habari' : type === 'success' ? 'Mafanikio' : 'Swali'}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={handleCreatePost}
                  disabled={isPosting || !newPostContent.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white px-6 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-green-100"
                >
                  {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Chapisha
                </button>
              </div>
            </div>

            {/* Feed */}
            <div className="space-y-6">
              {posts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onLike={() => handleLike(post.id)} 
                  onComment={() => {}} 
                />
              ))}
            </div>
          </div>

          {/* Right Column: Farm Management */}
          <div className="lg:col-span-3 space-y-6">
            <PlantingCalendar />
            <SoilDataInput />
            <FarmMap />
            
            <div className="bg-gradient-to-br from-green-500 to-green-700 p-6 rounded-3xl text-white shadow-xl shadow-green-200">
              <h3 className="font-bold text-lg mb-2">Kidokezo cha Wiki</h3>
              <p className="text-sm text-green-100 leading-relaxed mb-4">
                "Kutumia mbolea ya asili (mboji) huongeza rutuba ya udongo kwa muda mrefu kuliko mbolea za chumvichumvi pekee."
              </p>
              <button className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-xl text-xs font-bold transition-colors">
                Soma Zaidi
              </button>
            </div>
          </div>
        </main>

        {/* Mobile Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between lg:hidden z-50">
          <button className="p-2 text-green-600 bg-green-50 rounded-xl">
            <Sun className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400">
            <MessageSquare className="w-6 h-6" />
          </button>
          <button className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200 -mt-10 border-4 border-white">
            <Plus className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400">
            <Bell className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400">
            <UserIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
