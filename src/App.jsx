import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Admin from './Admin';
import ExamCBT from './ExamCBT';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Hapus sisa sesi lama jika berada di halaman login
  useEffect(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('exam');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      alert('Username atau Password salah!');
      setLoading(false);
      return;
    }

    // Simpan data user (identitas) ke penyimpanan lokal browser
    localStorage.setItem('user', JSON.stringify(data));

    // Arahkan berdasarkan peran (role)
    if (data.role === 'siswa') {
      navigate('/exam'); // Masuk ke Dasbor Murid
    } else {
      navigate('/admin'); // Masuk ke Panel Guru/Admin
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border-t-8 border-blue-900">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-900 mb-2">Portal CBT</h1>
          <p className="text-gray-500 font-medium">SMAN 1 Batudaa Pantai</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
            <input required type="text" className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors font-mono" 
              placeholder="Masukkan username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input required type="password" className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors" 
              placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-700 text-white font-bold py-4 rounded-lg shadow-lg hover:bg-blue-800 transition-transform active:scale-95 mt-4 text-lg">
            {loading ? 'MENGAUTENTIKASI...' : 'MASUK'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/exam" element={<ExamCBT />} />
      </Routes>
    </Router>
  );
}