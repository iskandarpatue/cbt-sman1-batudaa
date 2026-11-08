import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Eye, EyeOff } from 'lucide-react'; // Penambahan ikon mata

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  
  // State baru untuk mengontrol tampilan password
  const [showPassword, setShowPassword] = useState(false); 
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (userError || !user) {
      console.error("Detail Error:", userError);
      return setError('Username atau password salah.');
    }

    if (user.role === 'admin') {
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/admin');
    } else {
      const { data: exam } = await supabase
        .from('exams')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!exam) return setError('Token ujian tidak valid atau ujian belum aktif.');
      
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('exam', JSON.stringify(exam));
      navigate('/cbt');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-xl w-96 border-t-4 border-blue-600">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">CBT TKA Sumatif</h2>
        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" placeholder="Username" required
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setUsername(e.target.value)} 
          />
          
          {/* Input Password yang Dimodifikasi */}
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" required
              className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              onChange={(e) => setPassword(e.target.value)} 
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-blue-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <input 
            type="text" placeholder="Token Ujian (Khusus Siswa)"
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setToken(e.target.value)} 
          />
          <button type="submit" className="w-full p-3 font-bold text-white bg-blue-600 rounded hover:bg-blue-700">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}