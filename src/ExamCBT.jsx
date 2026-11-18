import { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, ZoomIn, ZoomOut, X, LogOut, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Grid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ExamCBT() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const [step, setStep] = useState('DASHBOARD');
  
  const [inputToken, setInputToken] = useState('');
  const [exam, setExam] = useState(null);
  
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [doubtful, setDoubtful] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(3600);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [zoomedImg, setZoomedImg] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  
  const [checkDND, setCheckDND] = useState(false);
  const [checkOverlay, setCheckOverlay] = useState(false);
  const [checkFocus, setCheckFocus] = useState(false);
  
  // State untuk Toggle Panel Daftar Soal
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);

  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);

  useEffect(() => {
    if (!user.id) navigate('/');
  }, [user.id, navigate]);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const shuffleArray = (array) => {
    if (!Array.isArray(array)) return array || [];
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const cariUjian = async (e) => {
    e.preventDefault();
    if (!inputToken) return;
    setIsLoading(true);

    try {
      const { data: examData, error: examError } = await supabase
        .from('exams').select('*').eq('token', inputToken.toUpperCase()).eq('is_active', true).single();

      if (examError || !examData) { alert('Token tidak valid atau ujian sudah dinonaktifkan oleh guru!'); setIsLoading(false); return; }

      const { data: resultData } = await supabase
        .from('exam_results').select('id').eq('user_id', user.id).eq('exam_id', examData.id).single();

      if (resultData) { alert('Anda sudah pernah mengerjakan ujian ini. Anda tidak dapat mengulang.'); setIsLoading(false); return; }

      setExam(examData);
      setTimeLeft(examData.duration_minutes ? examData.duration_minutes * 60 : 3600);
      setStep('CHECKLIST'); 
    } catch (err) { alert('Terjadi kesalahan jaringan.'); }
    setIsLoading(false);
  };

  const siapkanSoal = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('questions').select('*').eq('exam_id', exam.id);
      
      if (error || !data || data.length === 0) {
        alert('Gagal memuat soal atau ujian ini masih kosong. Lapor ke pengawas!');
        setStep('DASHBOARD'); setIsLoading(false); return;
      }

      let shuffledQuestions = shuffleArray(data);
      shuffledQuestions = shuffledQuestions.map(q => {
        if (q.type === 'PG' || q.type === 'PGK') return { ...q, options: shuffleArray(q.options) };
        if (q.type === 'M') return { ...q, shuffled_responses: shuffleArray([...q.correct_answer]) }; 
        return q;
      });
      setQuestions(shuffledQuestions);
      
      const elem = document.documentElement;
      if (elem.requestFullscreen) elem.requestFullscreen().catch(() => console.log('Fullscreen ditolak HP.'));
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      
      setStep('EXAM'); 
    } catch (err) { alert('Gagal menyiapkan soal ujian.'); setStep('DASHBOARD'); }
    setIsLoading(false);
  };

  useEffect(() => {
    if (step !== 'EXAM' || isSubmitting) return;

    const handlePelanggaran = () => {
      alert('⚠️ PERINGATAN KECURANGAN!\nAnda keluar dari ujian atau membuka split-screen. Ujian diakhiri otomatis.');
      handleSelesaiUjian(true);
    };

    const handleVisibilityChange = () => { if (document.hidden) handlePelanggaran(); };
    const handleFullscreenChange = () => { if (!document.fullscreenElement && !document.webkitIsFullScreen) handlePelanggaran(); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    
    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          alert('Waktu habis! Jawaban Anda akan disimpan otomatis.');
          handleSelesaiUjian(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      clearInterval(timerId);
    };
  }, [step, isSubmitting]);

  const handleSelesaiUjian = async (isForced = false) => {
    if (!isForced) {
      if (!window.confirm('Yakin ingin mengakhiri ujian? Jawaban tidak bisa diubah lagi.')) return;
    }
    
    setIsSubmitting(true);
    let totalSkorSiswa = 0; let totalSkorMaksimal = 0;
    const currentQ = questionsRef.current; const currentA = answersRef.current;

    currentQ.forEach(q => {
      const bobot = parseInt(q.bobot) || 1;
      if (q.type !== 'U') {
        totalSkorMaksimal += bobot;
        const ans = currentA[q.id];
        if (!ans) return; 
        
        let isCorrect = false;
        if (q.type === 'PG') { if (ans === q.correct_answer) isCorrect = true; } 
        else if (q.type === 'PGK') {
          const correctArr = q.correct_answer || [];
          if (ans.length === correctArr.length && ans.every(val => correctArr.includes(val))) isCorrect = true;
        } 
        else if (q.type === 'BS') {
          let bsBenar = true; const correctArr = q.correct_answer || [];
          correctArr.forEach((kunci, i) => { if (ans[i] !== kunci) bsBenar = false; });
          if (bsBenar) isCorrect = true;
        }
        else if (q.type === 'IS') {
          if (String(ans).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) isCorrect = true;
        }
        else if (q.type === 'M') {
          let matchAll = true; const correctArr = q.correct_answer || [];
          correctArr.forEach((kunci, i) => { if (ans[i] !== kunci) matchAll = false; });
          if (matchAll) isCorrect = true;
        }

        if (isCorrect) totalSkorSiswa += bobot;
      }
    });
    
    const skorAkhir = totalSkorMaksimal > 0 ? (totalSkorSiswa / totalSkorMaksimal) * 100 : 0;

    const { error } = await supabase.from('exam_results').insert([{
      user_id: user.id, exam_id: exam.id, answers: currentA, score: skorAkhir.toFixed(2)
    }]);

    if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(()=>{});

    if (error) {
      alert('Gagal merekam nilai. Hubungi pengawas! ' + error.message);
      setIsSubmitting(false);
    } else {
      setStep('SELESAI');
      setIsSubmitting(false);
    }
  };

  const toggleDoubt = () => {
    const newDoubtful = new Set(doubtful); const qId = questions[currentIdx].id;
    newDoubtful.has(qId) ? newDoubtful.delete(qId) : newDoubtful.add(qId);
    setDoubtful(newDoubtful);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleContentClick = (e) => { if (e.target.tagName === 'IMG') { setZoomedImg(e.target.src); setZoomScale(1); } };
  
  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

  const isReadyToStart = checkDND && checkOverlay && checkFocus;

  // ==== UI FASE 1 & FASE 2 TETAP SAMA (Disembunyikan agar kode ringkas) ====
  if (step === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-gray-200 p-4 flex items-center justify-center font-sans">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-2xl w-full max-w-lg border-t-8 border-blue-700">
          <div className="flex justify-between items-start border-b-2 border-gray-100 pb-4 mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-800">Halo, {user.name}!</h2>
              <p className="text-gray-500 font-medium mt-1">Siswa Kelas {user.kelas || '-'}</p>
            </div>
            <button onClick={handleLogout} className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors" title="Logout"><LogOut size={24} /></button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-blue-900 mb-2">Masuk ke Ruang Ujian</h3>
            <p className="text-sm text-blue-700 mb-6">Silakan minta Token Ujian kepada guru mata pelajaran atau pengawas Anda.</p>
            <form onSubmit={cariUjian} className="flex flex-col gap-4">
              <input type="text" required placeholder="Ketik 6 Digit Token..." className="w-full text-center text-2xl tracking-[0.5em] font-mono font-black uppercase p-4 border-2 border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none" value={inputToken} onChange={(e) => setInputToken(e.target.value)} maxLength={6} />
              <button type="submit" disabled={isLoading} className="w-full bg-blue-700 text-white font-bold py-4 rounded-lg shadow-lg hover:bg-blue-800 transition-transform active:scale-95 text-lg">
                {isLoading ? 'MENCARI UJIAN...' : 'MASUK UJIAN'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'CHECKLIST') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 md:p-6 select-none w-full">
        <div className="bg-white p-5 md:p-8 rounded-xl shadow-lg border-t-4 border-green-500 mb-6 w-full max-w-md text-left">
          <h2 className="text-xl md:text-2xl font-black text-gray-800 border-b pb-3 mb-4 flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="text-green-500"/> Ujian Ditemukan</span></h2>
          <table className="w-full text-sm md:text-base text-gray-700">
            <tbody>
              <tr className="border-b"><td className="py-3 font-bold w-1/3">Mata Pelajaran</td><td className="py-3 font-semibold text-blue-900">: {exam.title}</td></tr>
              <tr className="border-b"><td className="py-3 font-bold w-1/3">Nama Peserta</td><td className="py-3 font-semibold text-blue-900">: {user.name}</td></tr>
              <tr className="border-b"><td className="py-3 font-bold w-1/3">Waktu Ujian</td><td className="py-3 font-semibold text-blue-900">: {exam.duration_minutes} Menit</td></tr>
            </tbody>
          </table>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-5 md:p-6 rounded-xl w-full max-w-md mb-8 text-left shadow-sm">
          <div className="flex items-center gap-3 mb-4"><AlertTriangle className="text-yellow-600" size={28} /><h3 className="font-bold text-lg text-yellow-800">Persiapan Wajib Perangkat</h3></div>
          <p className="text-sm text-gray-700 mb-4">Centang ketiga syarat di bawah ini untuk mengaktifkan tombol mulai ujian:</p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={checkDND} onChange={(e) => setCheckDND(e.target.checked)} className="w-5 h-5 mt-0.5 accent-blue-600" />
              <span className="text-sm font-medium text-gray-800 leading-snug">Saya <strong>TELAH MENGAKTIFKAN</strong> fitur <em>Jangan Ganggu (Do Not Disturb)</em> pada HP.</span>
            </label>
            <label className="flex items-start gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={checkOverlay} onChange={(e) => setCheckOverlay(e.target.checked)} className="w-5 h-5 mt-0.5 accent-blue-600" />
              <span className="text-sm font-medium text-gray-800 leading-snug">Saya <strong>TELAH MEMATIKAN</strong> fitur <em>Bola Pintas</em> dan <em>Jendela Mengambang</em>.</span>
            </label>
            <label className="flex items-start gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={checkFocus} onChange={(e) => setCheckFocus(e.target.checked)} className="w-5 h-5 mt-0.5 accent-blue-600" />
              <span className="text-sm font-medium text-gray-800 leading-snug">Saya mengerti ujian akan <strong>TERTUTUP OTOMATIS</strong> jika layar terbelah atau membuka aplikasi lain.</span>
            </label>
          </div>
        </div>
        <div className="flex gap-4 w-full max-w-md">
          <button onClick={() => setStep('DASHBOARD')} className="px-6 py-4 font-bold text-gray-700 bg-gray-300 rounded-lg hover:bg-gray-400">Batal</button>
          <button onClick={siapkanSoal} disabled={!isReadyToStart || isLoading} className={`flex-1 px-4 py-4 font-black text-white rounded-lg shadow-xl text-lg transition-all transform ${isReadyToStart && !isLoading ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95' : 'bg-gray-400 cursor-not-allowed opacity-70'}`}>
            {isLoading ? 'MEMUAT...' : isReadyToStart ? 'SAYA SIAP MULAI' : 'CENTANG SYARAT'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'SELESAI') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans relative select-none">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl max-w-lg w-full text-center border-t-8 border-green-600 transform transition-all scale-100">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><CheckCircle2 size={50} className="text-green-600" /></div>
          <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">Ujian Selesai!</h2>
          <p className="text-lg text-gray-600 font-medium leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-100 shadow-sm">
            "Selamat Anda telah mengerjakan Ujian sampai selesai, silakan tunggu arahan dari Guru Selanjutnya."
          </p>
        </div>
        <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10">
          <button onClick={() => { setExam(null); setInputToken(''); setAnswers({}); handleLogout(); }} className="px-6 py-4 bg-blue-700 text-white font-bold rounded-xl shadow-[0_10px_25px_-5px_rgba(29,78,216,0.5)] hover:bg-blue-800 hover:-translate-y-1 transition-all flex items-center gap-3"><LogOut size={22} /> KEMBALI KE LOGIN</button>
        </div>
      </div>
    );
  }

  // ==== UI: FASE 3 (UJIAN BERLANGSUNG - DESAIN ANBK STYLE) ====
  return (
    <div className="flex flex-col h-[100dvh] bg-[#f0f2f5] font-sans select-none overflow-hidden relative">
      
      {/* ZOOM GAMBAR (MODAL) */}
      {zoomedImg && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 md:top-8 right-4 md:right-8 flex gap-3 z-50">
            <button onClick={() => setZoomScale(p => p + 0.3)} className="bg-white text-black p-3 rounded-full font-bold hover:bg-gray-200"><ZoomIn size={24}/></button>
            <button onClick={() => setZoomScale(p => Math.max(0.5, p - 0.3))} className="bg-white text-black p-3 rounded-full font-bold hover:bg-gray-200"><ZoomOut size={24}/></button>
            <button onClick={() => setZoomedImg(null)} className="bg-red-600 text-white p-3 rounded-full font-bold hover:bg-red-700 ml-4"><X size={24}/></button>
          </div>
          <div className="overflow-auto w-full h-full flex items-center justify-center">
            <img src={zoomedImg} alt="Zoomed" style={{ width: `${zoomScale * 100}%`, minWidth: '300px', transition: 'width 0.2s ease-out' }} className="max-w-none border-4 border-gray-700 rounded shadow-2xl" />
          </div>
        </div>
      )}

      {/* HEADER APLIKASI (MIRIP PUSMENJAR) */}
      <header className="flex items-center justify-between p-3 md:px-6 md:py-3 text-white bg-blue-900 shrink-0 shadow-md">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-white text-blue-900 p-1.5 md:p-2 rounded-lg font-black text-xs md:text-sm">SMAN 1</div>
          <div>
            <h1 className="text-sm md:text-lg font-bold leading-tight truncate max-w-[150px] md:max-w-[300px]">{exam.title}</h1>
            <p className="text-[10px] md:text-xs text-blue-200 font-medium">Ujian Berbasis Komputer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-sm bg-blue-800 px-3 py-1.5 rounded-full border border-blue-700">
             <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
             <span className="font-semibold text-blue-100">{user.name} ({user.username})</span>
          </div>
          <button onClick={() => window.confirm('Anda tidak bisa logout saat ujian berlangsung!')} className="p-2 md:p-0 md:hidden bg-blue-800 rounded">
             <Menu size={20}/>
          </button>
        </div>
      </header>

      {/* SUB-HEADER: INFORMASI SOAL & TOMBOL TOGGLE */}
      <div className="bg-white border-b shadow-sm shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 md:gap-4">
           <span className="text-base md:text-xl font-black text-gray-800">Soal Nomor {currentIdx + 1}</span>
           <span className="hidden md:inline-block text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded tracking-wider uppercase">
              {questions[currentIdx]?.type === 'PG' ? 'Pilihan Ganda' : 
               questions[currentIdx]?.type === 'PGK' ? 'Ganda Kompleks' : 
               questions[currentIdx]?.type === 'BS' ? 'Benar / Salah' : 
               questions[currentIdx]?.type === 'IS' ? 'Isian Singkat' : 
               questions[currentIdx]?.type === 'M' ? 'Menjodohkan' : 'Uraian'}
           </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
           <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-mono font-bold text-sm md:text-base border border-gray-200">
             <Clock size={16} className={timeLeft <= 300 ? 'text-red-500 animate-pulse' : 'text-gray-600'} />
             <span className={timeLeft <= 300 ? 'text-red-600' : 'text-gray-800'}>{formatTime(timeLeft)}</span>
           </div>
           <button onClick={() => setShowQuestionGrid(!showQuestionGrid)} className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm hover:bg-blue-200 transition-colors">
              <Grid size={16} /> <span className="hidden md:inline">Daftar Soal</span>
           </button>
        </div>
      </div>

      {/* AREA UTAMA KONTEN (FLEX GROW) */}
      <main className="flex-1 overflow-y-auto relative bg-[#f0f2f5] p-2 md:p-6">
        
        {/* PANEL DAFTAR SOAL MENGAMBANG (OFF-CANVAS) */}
        {showQuestionGrid && (
          <div className="absolute top-2 right-2 md:top-6 md:right-6 w-72 md:w-80 bg-white shadow-2xl border rounded-xl z-50 flex flex-col max-h-[80%] overflow-hidden">
             <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h3 className="font-bold text-gray-800">Daftar Soal ({questions.length})</h3>
                <button onClick={() => setShowQuestionGrid(false)} className="text-gray-500 hover:text-red-500"><X size={20}/></button>
             </div>
             <div className="p-4 overflow-y-auto flex-1 grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isDoubt = doubtful.has(q.id);
                  const isActive = idx === currentIdx;
                  
                  let bgColor = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'; // Belum dijawab (Putih)
                  if (isDoubt) bgColor = 'bg-yellow-400 text-black border-yellow-500'; // Ragu-ragu (Kuning)
                  else if (isAnswered) bgColor = 'bg-blue-600 text-white border-blue-700'; // Sudah dijawab (Biru)
                  
                  return (
                    <button key={q.id} onClick={() => { setCurrentIdx(idx); setShowQuestionGrid(false); }}
                      className={`w-full aspect-square text-sm border-2 rounded font-bold transition-all flex items-center justify-center ${bgColor} ${isActive ? 'ring-4 ring-black scale-110 z-10' : ''}`}>
                      {idx + 1}
                    </button>
                  );
                })}
             </div>
             <div className="p-3 bg-gray-100 text-xs font-bold text-gray-600 grid grid-cols-3 text-center border-t gap-1">
                <div className="flex items-center justify-center gap-1"><div className="w-3 h-3 bg-white border border-gray-400 rounded-sm"></div> Kosong</div>
                <div className="flex items-center justify-center gap-1"><div className="w-3 h-3 bg-yellow-400 border border-yellow-500 rounded-sm"></div> Ragu</div>
                <div className="flex items-center justify-center gap-1"><div className="w-3 h-3 bg-blue-600 border border-blue-700 rounded-sm"></div> Terjawab</div>
             </div>
          </div>
        )}

        {/* CONTAINER SOAL & JAWABAN */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-full flex flex-col overflow-hidden max-w-6xl mx-auto">
          
          <div className="flex flex-col md:flex-row flex-1">
            
            {/* BAGIAN KIRI: STIMULUS SOAL */}
            <div className={`p-5 md:p-8 ${questions[currentIdx]?.type === 'M' || questions[currentIdx]?.type === 'BS' ? 'w-full md:w-1/2 md:border-r border-gray-200' : 'w-full'}`}>
              <div 
                className="prose prose-sm md:prose-base max-w-none text-gray-800 [&_img]:cursor-zoom-in [&_img]:border [&_img]:border-gray-300 [&_img]:rounded [&_img]:shadow-sm [&_img]:max-w-full leading-relaxed" 
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: questions[currentIdx]?.content }} 
              />
            </div>

            {/* BAGIAN KANAN / BAWAH: AREA JAWABAN */}
            <div className={`p-5 md:p-8 bg-[#fafafa] ${questions[currentIdx]?.type === 'M' || questions[currentIdx]?.type === 'BS' ? 'w-full md:w-1/2' : 'w-full border-t border-gray-200 mt-4 md:mt-0'}`}>
              <div className="space-y-3">
                {/* 1. Pilihan Ganda */}
                {questions[currentIdx]?.type === 'PG' && Array.isArray(questions[currentIdx].options) && questions[currentIdx].options.map((opt, i) => (
                  <label key={i} className="flex items-start p-4 bg-white border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 transition-all shadow-sm">
                    <input type="radio" name="pg" className="w-5 h-5 md:w-6 md:h-6 mt-0.5 mr-4 accent-blue-600 shrink-0" 
                      checked={answers[questions[currentIdx].id] === opt} onChange={() => setAnswers({ ...answers, [questions[currentIdx].id]: opt })} />
                    <span className="font-bold mr-3 text-base md:text-lg text-gray-700">{String.fromCharCode(65 + i)}.</span>
                    <span className="flex-1 leading-relaxed text-sm md:text-base break-words text-gray-800" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: opt }}></span>
                  </label>
                ))}

                {/* 2. Pilihan Ganda Kompleks */}
                {questions[currentIdx]?.type === 'PGK' && (
                  <>
                    <p className="text-xs font-bold text-gray-500 mb-3 bg-gray-200 inline-block px-2 py-1 rounded">Pilih maksimal 3 jawaban yang benar:</p>
                    {Array.isArray(questions[currentIdx].options) && questions[currentIdx].options.map((opt, i) => {
                      const isChecked = (answers[questions[currentIdx].id] || []).includes(opt);
                      return (
                        <label key={i} className={`flex items-start p-4 bg-white border-2 rounded-xl cursor-pointer transition-all shadow-sm ${isChecked ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                          <input type="checkbox" className="w-5 h-5 md:w-6 md:h-6 mt-0.5 mr-4 accent-blue-600 shrink-0" 
                            checked={isChecked} onChange={(e) => {
                              const qId = questions[currentIdx].id; let currentAns = answers[qId] || [];
                              if (e.target.checked) { if (currentAns.length >= 3) return alert('Maksimal 3 jawaban!'); setAnswers({ ...answers, [qId]: [...currentAns, opt] }); }
                              else setAnswers({ ...answers, [qId]: currentAns.filter(x => x !== opt) });
                            }} />
                          <span className="font-bold mr-3 text-base md:text-lg text-gray-700">{String.fromCharCode(65 + i)}.</span>
                          <span className="flex-1 leading-relaxed text-sm md:text-base break-words text-gray-800" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: opt }}></span>
                        </label>
                      );
                    })}
                  </>
                )}

                {/* 3. Benar / Salah (Tabel Mirip ANBK) */}
                {questions[currentIdx]?.type === 'BS' && (
                  <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm md:text-base text-left">
                      <thead className="bg-blue-50 border-b">
                        <tr><th className="p-3 md:p-4 text-blue-900">Pernyataan</th><th className="p-3 md:p-4 text-center text-blue-900 w-16 md:w-20">Benar</th><th className="p-3 md:p-4 text-center text-blue-900 w-16 md:w-20">Salah</th></tr>
                      </thead>
                      <tbody>
                        {Array.isArray(questions[currentIdx].options) && questions[currentIdx].options.map((opt, i) => {
                          const ansVal = (answers[questions[currentIdx].id] || {})[i];
                          return (
                            <tr key={i} className="border-b hover:bg-gray-50">
                              <td className="p-3 md:p-4 align-top" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: opt }}></td>
                              <td className="p-3 md:p-4 text-center align-middle">
                                <input type="radio" name={`bs_${i}`} className="w-5 h-5 accent-blue-600 cursor-pointer" checked={ansVal === 'B'} onChange={() => {
                                   const qId = questions[currentIdx].id; let currentAns = answers[qId] || {};
                                   setAnswers({ ...answers, [qId]: { ...currentAns, [i]: 'B' } });
                                }} />
                              </td>
                              <td className="p-3 md:p-4 text-center align-middle">
                                <input type="radio" name={`bs_${i}`} className="w-5 h-5 accent-blue-600 cursor-pointer" checked={ansVal === 'S'} onChange={() => {
                                   const qId = questions[currentIdx].id; let currentAns = answers[qId] || {};
                                   setAnswers({ ...answers, [qId]: { ...currentAns, [i]: 'S' } });
                                }} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 4. Isian Singkat */}
                {questions[currentIdx]?.type === 'IS' && (
                  <div className="mt-2">
                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Ketik Jawaban Singkat Anda:</p>
                    <input type="text" placeholder="Jawaban..." 
                      className="w-full md:w-1/2 p-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 font-bold text-gray-800 text-lg shadow-sm outline-none transition-colors"
                      value={answers[questions[currentIdx].id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [questions[currentIdx].id]: e.target.value })} 
                    />
                  </div>
                )}

                {/* 5. Uraian */}
                {questions[currentIdx]?.type === 'U' && (
                  <div className="mt-2">
                     <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Ketik Penjelasan Uraian Anda:</p>
                    <textarea placeholder="Ketik jawaban lengkap di sini..." rows={8}
                      className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 font-medium text-gray-800 shadow-sm outline-none transition-colors leading-relaxed resize-y"
                      value={answers[questions[currentIdx].id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [questions[currentIdx].id]: e.target.value })} 
                    />
                  </div>
                )}

                {/* 6. Menjodohkan (Dropdown Table Style) */}
                {questions[currentIdx]?.type === 'M' && (
                  <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm md:text-base text-left">
                      <thead className="bg-blue-50 border-b">
                        <tr><th className="p-3 md:p-4 text-blue-900 w-1/2">Pernyataan / Premis Kiri</th><th className="p-3 md:p-4 text-blue-900 w-1/2">Pasangan Jawaban Kanan</th></tr>
                      </thead>
                      <tbody>
                        {Array.isArray(questions[currentIdx].options) && questions[currentIdx].options.map((premise, i) => {
                          const ansVal = (answers[questions[currentIdx].id] || {})[i] || '';
                          return (
                            <tr key={i} className="border-b hover:bg-gray-50">
                              <td className="p-3 md:p-4 align-middle font-medium text-gray-800 leading-snug">{i + 1}. {premise}</td>
                              <td className="p-3 md:p-4 align-middle">
                                <select className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white focus:border-blue-600 font-bold text-blue-900 outline-none cursor-pointer transition-colors"
                                  value={ansVal}
                                  onChange={(e) => {
                                    const qId = questions[currentIdx].id; const currentAns = answers[qId] || {};
                                    setAnswers({ ...answers, [qId]: { ...currentAns, [i]: e.target.value } });
                                  }}>
                                  <option value="">-- Pilih Jawaban --</option>
                                  {questions[currentIdx].shuffled_responses?.map((resp, rIdx) => (
                                    <option key={rIdx} value={resp}>{resp}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER NAVIGASI HORIZONTAL BAWAH (MIRIP ANBK) */}
      <footer className="bg-white border-t border-gray-200 p-3 md:p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 md:gap-4">
          
          {/* Tombol Sebelumnya (Merah) */}
          <button 
            onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} 
            disabled={currentIdx === 0} 
            className="flex-1 md:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 py-3 md:px-8 md:py-4 font-bold text-white bg-red-600 rounded-full hover:bg-red-700 disabled:opacity-40 transition-colors shadow-md text-xs md:text-sm whitespace-nowrap"
          >
            <ChevronLeft size={18} className="shrink-0"/> <span className="hidden md:inline">Soal</span> Sebelumnya
          </button>
          
          {/* Tombol Ragu-Ragu (Kuning) */}
          <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-3 md:px-10 md:py-4 font-bold text-yellow-900 bg-yellow-400 rounded-full cursor-pointer hover:bg-yellow-500 transition-colors shadow-md text-xs md:text-sm whitespace-nowrap">
            <input type="checkbox" checked={doubtful.has(questions[currentIdx]?.id)} onChange={toggleDoubt} className="w-4 h-4 md:w-5 md:h-5 accent-yellow-900 rounded" /> 
            <HelpCircle size={16} className="hidden md:block"/> Ragu-Ragu
          </label>
          
          {/* Tombol Selanjutnya (Hijau) / Selesai */}
          {currentIdx === questions.length - 1 ? (
            <button 
              onClick={() => handleSelesaiUjian(false)} 
              disabled={isSubmitting} 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-3 md:px-12 md:py-4 font-black text-white bg-blue-600 rounded-full shadow-md hover:bg-blue-700 transition-colors disabled:opacity-70 text-xs md:text-base whitespace-nowrap"
            >
              {isSubmitting ? 'MENGIRIM...' : 'SELESAI UJIAN'}
            </button>
          ) : (
            <button 
              onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))} 
              className="flex-1 md:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 py-3 md:px-8 md:py-4 font-bold text-white bg-green-600 rounded-full shadow-md hover:bg-green-700 transition-colors text-xs md:text-sm whitespace-nowrap"
            >
              <span className="hidden md:inline">Soal</span> Selanjutnya <ChevronRight size={18} className="shrink-0"/>
            </button>
          )}

        </div>
      </footer>
    </div>
  );
}
