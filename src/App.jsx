import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

// Import Halaman Lain
import Admin from './Admin';
import ExamCBT from './ExamCBT';

// --- KOMPONEN DESAIN LOGIN ---
function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      if (user.role === 'siswa') navigate('/exam');
      else navigate('/admin');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        setErrorMsg('Username atau password salah!');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('user', JSON.stringify(data));
      if (data.role === 'siswa') navigate('/exam');
      else navigate('/admin');
      
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-[#f0f2f5] font-sans flex flex-col relative overflow-hidden">
      
      {/* Latar Belakang Biru Atas (Gaya ANBK) */}
      <div className="absolute top-0 left-0 w-full h-64 bg-[#1e40af] rounded-b-[40px] md:rounded-b-[80px] shadow-lg z-0"></div>

      {/* Kotak Login Tengah */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10">
        
        <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-8 md:p-10 transform transition-all">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black text-gray-800 mb-2 tracking-tight">Selamat Datang</h1>
            <p className="text-sm text-gray-500 font-medium">Silakan login dengan menggunakan username dan password yang diberikan.</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 animate-pulse">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-bold leading-tight">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <User size={20} />
              </div>
              <input 
                type="text" required placeholder="Username" 
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all placeholder:font-medium placeholder:text-gray-400"
                value={username} onChange={(e) => setUsername(e.target.value)} 
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Lock size={20} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} required placeholder="Password" 
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all placeholder:font-medium placeholder:text-gray-400"
                value={password} onChange={(e) => setPassword(e.target.value)} 
              />
              <button 
                type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button 
              type="submit" disabled={isLoading} 
              className="w-full py-4 mt-4 bg-[#1d4ed8] text-white font-bold rounded-2xl shadow-lg hover:bg-[#1e40af] hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0 text-base tracking-wide"
            >
              {isLoading ? 'MEMPROSES...' : 'LOGIN'}
            </button>
          </form>
        </div>
      </main>

      {/* Footer Watermark Khusus Sesuai Permintaan */}
      <footer className="w-full text-center py-6 text-[10px] md:text-xs font-bold text-gray-400 z-10 shrink-0">
        Created Pk Guru Iskandar-TimItSmanBatPan
      </footer>

    </div>
  );
}

// --- PENGATUR JALAN UTAMA (ROUTER DI SINI) ---
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/exam" element={<ExamCBT />} />
      </Routes>
    </BrowserRouter>
  );
}
