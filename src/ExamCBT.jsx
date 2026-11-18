import { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, ZoomIn, ZoomOut, X, LogOut, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Grid, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ExamCBT() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const [step, setStep] = useState('DASHBOARD');
  const [inputToken, setInputToken] = useState('');
  const [exam, setExam] = useState(null);
  const [sessionId, setSessionId] = useState(null); 
  
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [doubtful, setDoubtful] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(3600);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomedImg, setZoomedImg] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);
  
  const [checkDND, setCheckDND] = useState(false);
  const [checkOverlay, setCheckOverlay] = useState(false);
  const [checkFocus, setCheckFocus] = useState(false);

  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);
  const idxRef = useRef(currentIdx);

  useEffect(() => { if (!user.id) navigate('/'); }, [user.id, navigate]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { idxRef.current = currentIdx; }, [currentIdx]);

  const shuffleArray = (array) => {
    let shuffled = [...(array || [])];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return shuffled;
  };

  const cariUjian = async (e) => {
    e.preventDefault(); if (!inputToken) return; setIsLoading(true);
    try {
      const { data: examData, error: examError } = await supabase.from('exams').select('*').eq('token', inputToken.toUpperCase()).eq('is_active', true).single();
      if (examError || !examData) { alert('Token tidak valid, kedaluwarsa, atau ujian ditutup!'); setIsLoading(false); return; }

      if (examData.schedule_date) {
        const now = new Date();
        const start = new Date(`${examData.schedule_date}T${examData.start_time || '00:00'}:00`);
        const end = new Date(`${examData.schedule_date}T${examData.end_time || '23:59'}:00`);
        if (now < start) { alert('Ujian belum dimulai sesuai jadwal!'); setIsLoading(false); return; }
        if (now > end) { alert('Waktu ujian telah berakhir!'); setIsLoading(false); return; }
      }

      const { data: resultData } = await supabase.from('exam_results').select('id').eq('user_id', user.id).eq('exam_id', examData.id).single();
      if (resultData) { alert('Anda sudah pernah mengerjakan ujian ini.'); setIsLoading(false); return; }

      setExam(examData); setTimeLeft(examData.duration_minutes ? examData.duration_minutes * 60 : 3600); setStep('CHECKLIST'); 
    } catch (err) { alert('Gagal terhubung.'); }
    setIsLoading(false);
  };

  const siapkanSoal = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('questions').select('*').eq('exam_id', exam.id);
      if (error || !data || data.length === 0) { alert('Gagal memuat soal.'); setStep('DASHBOARD'); setIsLoading(false); return; }

      let shuffledQuestions = shuffleArray(data).map(q => {
        if (q.type === 'PG' || q.type === 'PGK') return { ...q, options: shuffleArray(q.options) };
        if (q.type === 'M') return { ...q, shuffled_responses: shuffleArray([...q.correct_answer]) }; return q;
      });
      setQuestions(shuffledQuestions);

      const { data: sessionData } = await supabase.from('live_sessions').upsert(
        { user_id: user.id, exam_id: exam.id, status: 'mengerjakan', current_question_index: 0, last_active: new Date().toISOString() }, 
        { onConflict: 'user_id,exam_id' }
      ).select();
      if (sessionData) setSessionId(sessionData[0].id);

      const elem = document.documentElement;
      if (elem.requestFullscreen) elem.requestFullscreen().catch(()=>{});
      setStep('EXAM'); 
    } catch (err) { alert('Gagal menyiapkan ujian.'); setStep('DASHBOARD'); }
    setIsLoading(false);
  };

  useEffect(() => {
    if (step !== 'EXAM' || isSubmitting) return;

    const pingTimer = setInterval(async () => {
      if (sessionId) {
        const { data } = await supabase.from('live_sessions').update({ 
          current_question_index: idxRef.current, last_active: new Date().toISOString() 
        }).eq('id', sessionId).select('status').single();
        
        if (data && data.status === 'dikeluarkan') {
           alert('PENGUMUMAN PENTING:\nAnda telah dikeluarkan secara paksa dari ruang ujian oleh Pengawas/Guru.');
           await supabase.from('live_sessions').delete().eq('id', sessionId); 
           if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
           setExam(null); setInputToken(''); setAnswers({}); setSessionId(null); setStep('DASHBOARD');
        }
      }
    }, 10000);

    const handlePelanggaran = () => { alert('⚠️ PERINGATAN KECURANGAN!\nAnda keluar dari ujian.'); handleSelesaiUjian(true); };
    const handleVisibilityChange = () => { if (document.hidden) handlePelanggaran(); };
    const handleFullscreenChange = () => { if (!document.fullscreenElement && !document.webkitIsFullScreen) handlePelanggaran(); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    
    const timerId = setInterval(() => {
      setTimeLeft((prev) => { if (prev <= 1) { clearInterval(timerId); handleSelesaiUjian(true); return 0; } return prev - 1; });
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      clearInterval(timerId); clearInterval(pingTimer);
    };
  }, [step, isSubmitting, sessionId]);

  const handleSelesaiUjian = async (isForced = false) => {
    if (!isForced) { if (!window.confirm('Akhiri ujian?')) return; }
    setIsSubmitting(true);
    let totalSkorSiswa = 0; let totalSkorMaksimal = 0;
    const currentQ = questionsRef.current; const currentA = answersRef.current;

    currentQ.forEach(q => {
      const maxScore = parseInt(q.bobot) || 1;
      if (q.type !== 'U') {
        totalSkorMaksimal += maxScore; const ans = currentA[q.id]; let obtainedScore = 0;
        const isAnsEmptyArray = Array.isArray(ans) && ans.length === 0;
        const isAnsEmptyObj = typeof ans === 'object' && ans !== null && Object.keys(ans).length === 0;

        if (ans && !isAnsEmptyArray && !isAnsEmptyObj) {
          if (q.type === 'PG') { if (ans === q.correct_answer) obtainedScore = maxScore; } 
          else if (q.type === 'PGK') {
            const ansArray = Array.isArray(ans) ? ans : []; const correctArray = q.correct_answer || [];
            let c = 0, w = 0; ansArray.forEach(val => { if (correctArray.includes(val)) c++; else w++; });
            let ratio = (c - w) / correctArray.length; if (ratio < 0) ratio = 0; obtainedScore = ratio * maxScore;
          } 
          else if (q.type === 'BS') {
            const ansObj = ans || {}; let c = 0; const correctArr = q.correct_answer || [];
            correctArr.forEach((kunci, i) => { if (ansObj[i] === kunci) c++; }); obtainedScore = (c / correctArr.length) * maxScore;
          }
          else if (q.type === 'IS') { if (String(ans).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
          else if (q.type === 'M') {
            const ansObj = ans || {}; let c = 0; const correctArr = q.correct_answer || [];
            correctArr.forEach((kunci, i) => { if (ansObj[i] === kunci) c++; }); obtainedScore = (c / correctArr.length) * maxScore;
          }
        }
        totalSkorSiswa += obtainedScore;
      }
    });
    
    const skorAkhir = totalSkorMaksimal > 0 ? (totalSkorSiswa / totalSkorMaksimal) * 100 : 0;

    await supabase.from('exam_results').insert([{ user_id: user.id, exam_id: exam.id, answers: currentA, score: skorAkhir.toFixed(2) }]);
    if (sessionId) await supabase.from('live_sessions').update({ status: 'selesai', last_active: new Date().toISOString() }).eq('id', sessionId);
    if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(()=>{});

    setStep('SELESAI'); setIsSubmitting(false);
  };

  const toggleDoubt = () => {
    const newDoubtful = new Set(doubtful); const qId = questions[currentIdx].id;
    newDoubtful.has(qId) ? newDoubtful.delete(qId) : newDoubtful.add(qId);
    setDoubtful(newDoubtful);
  };
  const formatTime = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
  const handleContentClick = (e) => { if (e.target.tagName === 'IMG') { setZoomedImg(e.target.src); setZoomScale(1); } };
  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };
  const isReadyToStart = checkDND && checkOverlay && checkFocus;

  // ==== UI: DASHBOARD (KONFIRMASI DATA & INPUT TOKEN - GAYA TKA/ANBK) ====
  if (step === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-[#e9ecef] flex items-center justify-center p-4 font-sans select-none relative">
        <div className="w-full max-w-xl bg-white rounded-lg shadow-xl overflow-hidden relative">
          
          {/* Header Biru */}
          <div className="bg-[#1e40af] p-4 text-white flex justify-between items-center shadow-sm relative z-10">
            <h2 className="font-bold tracking-wide">KONFIRMASI DATA PESERTA</h2>
            <button onClick={handleLogout} className="text-white hover:text-red-200 transition-colors" title="Logout"><LogOut size={20} /></button>
          </div>

          <div className="p-6 md:p-8 relative z-10 bg-white">
            
            <form onSubmit={cariUjian} className="space-y-6">
              
              <div className="space-y-4">
                {/* Kode Peserta / Username */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Kode Peserta</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded font-mono font-bold text-gray-800">{user.username}</div>
                </div>

                {/* Nama Peserta */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nama Peserta</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded font-bold text-gray-800">{user.name}</div>
                </div>

                {/* Kelas */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Kelas</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded font-bold text-gray-800">{user.kelas || '-'}</div>
                </div>

                <hr className="my-2 border-gray-200" />

                {/* Token (Tengah & Menonjol) */}
                <div>
                  <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Token Ujian</label>
                  <input 
                    type="text" required placeholder="Ketikkan token di sini" 
                    className="w-full p-4 bg-blue-50 border border-blue-200 rounded text-center text-xl font-mono font-black uppercase tracking-[0.3em] text-blue-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-sm placeholder:font-medium placeholder:text-gray-400"
                    value={inputToken} onChange={(e) => setInputToken(e.target.value)} maxLength={6} 
                  />
                </div>
              </div>

              {/* Tombol Submit */}
              <button type="submit" disabled={isLoading} className="w-full bg-[#1d4ed8] text-white font-bold py-3.5 rounded shadow hover:bg-[#1e40af] transition-all disabled:opacity-70 text-sm">
                {isLoading ? 'MEMERIKSA...' : 'SUBMIT'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==== UI: CHECKLIST ====
  if (step === 'CHECKLIST') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 md:p-6 select-none w-full">
        <div className="bg-white p-5 md:p-8 rounded-xl shadow-lg border-t-4 border-green-500 mb-6 w-full max-w-md text-left">
          <h2 className="text-xl md:text-2xl font-black text-gray-800 border-b pb-3 mb-4 flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="text-green-500"/> Ujian Ditemukan</span></h2>
          <table className="w-full text-sm md:text-base text-gray-700"><tbody>
            <tr className="border-b"><td className="py-3 font-bold w-1/3">Mata Pelajaran</td><td className="py-3 font-semibold text-blue-900">: {exam.title}</td></tr>
            <tr className="border-b"><td className="py-3 font-bold w-1/3">Waktu Ujian</td><td className="py-3 font-semibold text-blue-900">: {exam.duration_minutes} Menit</td></tr>
          </tbody></table>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-5 md:p-6 rounded-xl w-full max-w-md mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4"><AlertTriangle className="text-yellow-600" size={28} /><h3 className="font-bold text-lg text-yellow-800">Persiapan Perangkat</h3></div>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 bg-white border rounded-lg cursor-pointer"><input type="checkbox" checked={checkDND} onChange={(e) => setCheckDND(e.target.checked)} className="w-5 h-5 accent-blue-600" /><span className="text-sm font-medium text-gray-800">Aktifkan Jangan Ganggu (DND)</span></label>
            <label className="flex items-start gap-3 p-3 bg-white border rounded-lg cursor-pointer"><input type="checkbox" checked={checkOverlay} onChange={(e) => setCheckOverlay(e.target.checked)} className="w-5 h-5 accent-blue-600" /><span className="text-sm font-medium text-gray-800">Matikan Bola Pintas/Jendela Mengambang</span></label>
            <label className="flex items-start gap-3 p-3 bg-white border rounded-lg cursor-pointer"><input type="checkbox" checked={checkFocus} onChange={(e) => setCheckFocus(e.target.checked)} className="w-5 h-5 accent-blue-600" /><span className="text-sm font-medium text-gray-800">Ujian tertutup otomatis jika layar terbelah.</span></label>
          </div>
        </div>
        <button onClick={siapkanSoal} disabled={!isReadyToStart || isLoading} className={`w-full max-w-md px-4 py-4 font-black text-white rounded-lg shadow-xl text-lg ${isReadyToStart ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}>SAYA SIAP MULAI</button>
      </div>
    );
  }

  // ==== UI: SELESAI ====
  if (step === 'SELESAI') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl max-w-lg w-full text-center border-t-8 border-green-600">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><CheckCircle2 size={50} className="text-green-600" /></div>
          <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">Ujian Selesai!</h2>
          <p className="text-gray-600 font-medium bg-gray-50 p-6 rounded-lg border">Silakan tunggu arahan dari Guru Selanjutnya.</p>
        </div>
        <button onClick={() => { setExam(null); setInputToken(''); setAnswers({}); handleLogout(); }} className="mt-8 px-6 py-4 bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:bg-blue-800 flex items-center gap-3"><LogOut size={22} /> KEMBALI KE LOGIN</button>
      </div>
    );
  }

  // ==== UI: ANBK STYLE ====
  return (
    <div className="flex flex-col h-[100dvh] bg-[#f0f2f5] font-sans select-none overflow-hidden relative">
      {zoomedImg && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 right-4 flex gap-3 z-50">
            <button onClick={() => setZoomScale(p => p + 0.3)} className="bg-white text-black p-3 rounded-full font-bold hover:bg-gray-200"><ZoomIn/></button>
            <button onClick={() => setZoomScale(p => Math.max(0.5, p - 0.3))} className="bg-white text-black p-3 rounded-full font-bold hover:bg-gray-200"><ZoomOut/></button>
            <button onClick={() => setZoomedImg(null)} className="bg-red-600 text-white p-3 rounded-full font-bold ml-4"><X/></button>
          </div>
          <div className="overflow-auto w-full h-full flex items-center justify-center">
            <img src={zoomedImg} alt="Zoomed" style={{ width: `${zoomScale * 100}%`, minWidth: '300px' }} className="border-4 border-gray-700 rounded shadow-2xl" />
          </div>
        </div>
      )}

      <header className="flex items-center justify-between p-3 md:px-6 md:py-3 text-white bg-[#1e40af] shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white text-[#1e40af] p-1.5 md:p-2 rounded-lg font-black text-xs md:text-sm">SMAN 1</div>
          <div><h1 className="text-sm md:text-lg font-bold leading-tight truncate max-w-[150px] md:max-w-[300px]">{exam.title}</h1><p className="text-[10px] md:text-xs text-blue-200 font-medium">Ujian Berbasis Komputer</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-sm bg-blue-800 px-3 py-1.5 rounded-full border border-blue-700"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div><span className="font-semibold">{user.name}</span></div>
          <button onClick={() => window.confirm('Anda tidak bisa logout saat ujian berlangsung!')} className="p-2 md:hidden bg-blue-800 rounded"><Menu size={20}/></button>
        </div>
      </header>

      <div className="bg-white border-b shadow-sm shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
           <span className="text-base md:text-xl font-black text-gray-800">Soal Nomor {currentIdx + 1}</span>
           <span className="hidden md:inline-block text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded tracking-wider uppercase">{questions[currentIdx]?.type}</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-mono font-bold text-sm border"><Clock size={16} className={timeLeft <= 300 ? 'text-red-500 animate-pulse' : 'text-gray-600'} /><span className={timeLeft <= 300 ? 'text-red-600' : 'text-gray-800'}>{formatTime(timeLeft)}</span></div>
           <button onClick={() => setShowQuestionGrid(!showQuestionGrid)} className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm hover:bg-blue-200"><Grid size={16} /> <span className="hidden md:inline">Daftar Soal</span></button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative p-2 md:p-6">
        {showQuestionGrid && (
          <div className="absolute top-2 right-2 md:top-6 md:right-6 w-72 md:w-80 bg-white shadow-2xl border rounded-xl z-50 flex flex-col max-h-[80%] overflow-hidden">
             <div className="flex justify-between p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-800">Daftar Soal</h3><button onClick={() => setShowQuestionGrid(false)} className="text-gray-500 hover:text-red-500"><X size={20}/></button></div>
             <div className="p-4 overflow-y-auto flex-1 grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isActive = idx === currentIdx; let bgColor = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100';
                  if (doubtful.has(q.id)) bgColor = 'bg-yellow-400 text-black border-yellow-500'; else if (!!answers[q.id]) bgColor = 'bg-[#1e40af] text-white border-blue-700';
                  return <button key={q.id} onClick={() => { setCurrentIdx(idx); setShowQuestionGrid(false); }} className={`w-full aspect-square text-sm border-2 rounded font-bold ${bgColor} ${isActive ? 'ring-4 ring-black scale-110 z-10' : ''}`}>{idx + 1}</button>;
                })}
             </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border min-h-full flex flex-col max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row flex-1">
            <div className={`p-5 md:p-8 ${questions[currentIdx]?.type === 'M' || questions[currentIdx]?.type === 'BS' ? 'w-full md:w-1/2 md:border-r border-gray-200' : 'w-full'}`}>
              <div className="prose max-w-none text-gray-800 [&_img]:border [&_img]:rounded shadow-sm leading-relaxed" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: questions[currentIdx]?.content }} />
            </div>
            <div className={`p-5 md:p-8 bg-[#fafafa] ${questions[currentIdx]?.type === 'M' || questions[currentIdx]?.type === 'BS' ? 'w-full md:w-1/2' : 'w-full border-t border-gray-200 mt-4 md:mt-0'}`}>
              <div className="space-y-3">
                {questions[currentIdx]?.type === 'PG' && questions[currentIdx].options.map((opt, i) => (
                  <label key={i} className="flex items-start p-4 bg-white border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 shadow-sm">
                    <input type="radio" name="pg" className="w-5 h-5 mt-0.5 mr-4 accent-blue-600 shrink-0" checked={answers[questions[currentIdx].id] === opt} onChange={() => setAnswers({ ...answers, [questions[currentIdx].id]: opt })} />
                    <span className="font-bold mr-3 text-gray-700">{String.fromCharCode(65 + i)}.</span>
                    <span className="flex-1 leading-relaxed text-gray-800" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: opt }}></span>
                  </label>
                ))}
                {questions[currentIdx]?.type === 'PGK' && (
                  <>
                    <p className="text-xs font-bold text-gray-500 mb-3 bg-gray-200 inline-block px-2 py-1 rounded">Pilih maks 3 jawaban:</p>
                    {questions[currentIdx].options.map((opt, i) => {
                      const isChecked = (answers[questions[currentIdx].id] || []).includes(opt);
                      return (
                        <label key={i} className={`flex items-start p-4 bg-white border-2 rounded-xl cursor-pointer shadow-sm ${isChecked ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                          <input type="checkbox" className="w-5 h-5 mt-0.5 mr-4 accent-blue-600 shrink-0" checked={isChecked} onChange={(e) => {
                              const qId = questions[currentIdx].id; let currentAns = answers[qId] || [];
                              if (e.target.checked) { if (currentAns.length >= 3) return alert('Maks 3!'); setAnswers({ ...answers, [qId]: [...currentAns, opt] }); }
                              else setAnswers({ ...answers, [qId]: currentAns.filter(x => x !== opt) });
                            }} />
                          <span className="font-bold mr-3 text-gray-700">{String.fromCharCode(65 + i)}.</span>
                          <span className="flex-1 leading-relaxed text-gray-800" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: opt }}></span>
                        </label>
                      );
                    })}
                  </>
                )}
                {questions[currentIdx]?.type === 'BS' && (
                  <table className="w-full text-sm md:text-base text-left bg-white border rounded-xl overflow-hidden shadow-sm">
                    <thead className="bg-blue-50 border-b"><tr><th className="p-4 text-blue-900">Pernyataan</th><th className="p-4 text-center w-20">Benar</th><th className="p-4 text-center w-20">Salah</th></tr></thead>
                    <tbody>
                      {questions[currentIdx].options.map((opt, i) => {
                        const ansVal = (answers[questions[currentIdx].id] || {})[i];
                        return (
                          <tr key={i} className="border-b"><td className="p-4" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: opt }}></td>
                            <td className="p-4 text-center"><input type="radio" name={`bs_${i}`} className="w-5 h-5 accent-blue-600" checked={ansVal === 'B'} onChange={() => { const qId = questions[currentIdx].id; setAnswers({ ...answers, [qId]: { ...(answers[qId] || {}), [i]: 'B' } }); }} /></td>
                            <td className="p-4 text-center"><input type="radio" name={`bs_${i}`} className="w-5 h-5 accent-blue-600" checked={ansVal === 'S'} onChange={() => { const qId = questions[currentIdx].id; setAnswers({ ...answers, [qId]: { ...(answers[qId] || {}), [i]: 'S' } }); }} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {questions[currentIdx]?.type === 'IS' && (
                  <input type="text" placeholder="Ketik jawaban singkat..." className="w-full md:w-1/2 p-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 font-bold text-gray-800 text-lg shadow-sm outline-none" value={answers[questions[currentIdx].id] || ''} onChange={(e) => setAnswers({ ...answers, [questions[currentIdx].id]: e.target.value })} />
                )}
                {questions[currentIdx]?.type === 'U' && (
                  <textarea placeholder="Ketik jawaban uraian..." rows={8} className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 font-medium text-gray-800 shadow-sm outline-none leading-relaxed" value={answers[questions[currentIdx].id] || ''} onChange={(e) => setAnswers({ ...answers, [questions[currentIdx].id]: e.target.value })} />
                )}
                {questions[currentIdx]?.type === 'M' && (
                  <table className="w-full text-sm md:text-base text-left bg-white border rounded-xl overflow-hidden shadow-sm">
                    <thead className="bg-blue-50 border-b"><tr><th className="p-4 w-1/2 text-blue-900">Pernyataan Kiri</th><th className="p-4 w-1/2 text-blue-900">Pasangan Kanan</th></tr></thead>
                    <tbody>
                      {questions[currentIdx].options.map((premise, i) => {
                        const ansVal = (answers[questions[currentIdx].id] || {})[i] || '';
                        return (
                          <tr key={i} className="border-b"><td className="p-4 font-medium">{i + 1}. {premise}</td>
                            <td className="p-4">
                              <select className="w-full p-3 border-2 border-gray-300 rounded-lg outline-none font-bold text-blue-900" value={ansVal} onChange={(e) => { const qId = questions[currentIdx].id; setAnswers({ ...answers, [qId]: { ...(answers[qId] || {}), [i]: e.target.value } }); }}>
                                <option value="">-- Pilih Jawaban --</option>
                                {questions[currentIdx].shuffled_responses?.map((resp, rIdx) => <option key={rIdx} value={resp}>{resp}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t p-3 md:p-4 shrink-0 shadow-lg z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 md:gap-4">
          <button onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIdx === 0} className="flex-1 md:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 py-3 md:px-8 md:py-4 font-bold text-white bg-red-600 rounded-full hover:bg-red-700 disabled:opacity-40 text-xs md:text-sm shadow-md whitespace-nowrap">
            <ChevronLeft size={18}/> <span className="hidden md:inline">Soal</span> Sebelumnya
          </button>
          <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-3 md:px-10 md:py-4 font-bold text-yellow-900 bg-yellow-400 rounded-full cursor-pointer hover:bg-yellow-500 shadow-md text-xs md:text-sm whitespace-nowrap">
            <input type="checkbox" checked={doubtful.has(questions[currentIdx]?.id)} onChange={toggleDoubt} className="w-4 h-4 accent-yellow-900" /> <HelpCircle size={16} className="hidden md:block"/> Ragu-Ragu
          </label>
          {currentIdx === questions.length - 1 ? (
            <button onClick={() => handleSelesaiUjian(false)} disabled={isSubmitting} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-3 md:px-12 md:py-4 font-black text-white bg-[#1e40af] rounded-full shadow-md hover:bg-blue-800 disabled:opacity-70 text-xs md:text-base whitespace-nowrap">
              {isSubmitting ? 'MENGIRIM...' : 'SELESAI UJIAN'}
            </button>
          ) : (
            <button onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))} className="flex-1 md:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 py-3 md:px-8 md:py-4 font-bold text-white bg-green-600 rounded-full shadow-md hover:bg-green-700 text-xs md:text-sm whitespace-nowrap">
              <span className="hidden md:inline">Soal</span> Selanjutnya <ChevronRight size={18}/>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
