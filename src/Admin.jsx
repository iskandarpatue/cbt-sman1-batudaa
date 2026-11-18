import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, PlusCircle, CheckCircle, XCircle, AlertTriangle, Edit, Trash2, UserPlus, BarChart2, Upload, Download, Menu, X, ShieldCheck, LogOut, Printer, Filter, Key, Activity, Calendar, Clock as ClockIcon, RefreshCw, XSquare } from 'lucide-react';
import JoditEditor from 'jodit-react';

export default function Admin() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeTab, setActiveTab] = useState('jadwal'); 
  const [exams, setExams] = useState([]);
  const [activeExamId, setActiveExamId] = useState(null);
  const [token, setToken] = useState('');
  const [results, setResults] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showAnalisisKelas, setShowAnalisisKelas] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrintingCards, setIsPrintingCards] = useState(false);

  const [liveSessions, setLiveSessions] = useState([]);
  const [activeProctorExam, setActiveProctorExam] = useState(null);

  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamGuruId, setNewExamGuruId] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamStart, setNewExamStart] = useState('');
  const [newExamEnd, setNewExamEnd] = useState('');
  const [newExamKelas, setNewExamKelas] = useState('');
  const [isEditingExam, setIsEditingExam] = useState(false);
  const [editExamId, setEditExamId] = useState(null);
  const [examDuration, setExamDuration] = useState(60);

  const [tipeSoal, setTipeSoal] = useState('PG');
  const [bobotSoal, setBobotSoal] = useState(1);
  const [soalText, setSoalText] = useState('');
  const [opsiPG, setOpsiPG] = useState(['', '', '', '', '']);
  const [kunciPG, setKunciPG] = useState(0);
  const [opsiPGK, setOpsiPGK] = useState(['', '', '', '', '']);
  const [kunciPGK, setKunciPGK] = useState([]);
  const [opsiBS, setOpsiBS] = useState(['', '', '']);
  const [kunciBS, setKunciBS] = useState(['B', 'B', 'B']);
  const [kunciIS, setKunciIS] = useState('');
  const [kunciU, setKunciU] = useState('');
  const [pasanganM, setPasanganM] = useState([{kiri: '', kanan: ''}, {kiri: '', kanan: ''}]);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestionId, setEditQuestionId] = useState(null);

  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelasSiswa, setKelasSiswa] = useState('');
  const [usernameSiswa, setUsernameSiswa] = useState('');
  const [passwordSiswa, setPasswordSiswa] = useState('');
  const [isEditingSiswa, setIsEditingSiswa] = useState(false);
  const [editSiswaId, setEditSiswaId] = useState(null);
  const [filterKelas, setFilterKelas] = useState(''); 

  const [namaGuru, setNamaGuru] = useState('');
  const [mapelGuru, setMapelGuru] = useState('');
  const [usernameGuru, setUsernameGuru] = useState('');
  const [passwordGuru, setPasswordGuru] = useState('');
  const [isEditingGuru, setIsEditingGuru] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [isUploadingSoalCSV, setIsUploadingSoalCSV] = useState(false);

  const editor = useRef(null);
  const editorConfig = { readonly: false, height: 350, uploader: { insertImageAsBase64URI: true }, buttons: ['bold', 'italic', 'underline', 'superscript', 'subscript', 'ul', 'ol', 'image', 'table', 'symbol'] };

  useEffect(() => {
    if (!loggedInUser.id) { navigate('/'); return; }
    fetchExamsList();
    if (loggedInUser.role === 'admin') fetchUsers();
  }, [navigate]);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => { setCurrentTime(new Date()); }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let poller;
    if (activeTab === 'pantau' && activeProctorExam) {
       fetchLiveSessions(activeProctorExam);
       poller = setInterval(() => fetchLiveSessions(activeProctorExam), 5000);
    }
    return () => clearInterval(poller);
  }, [activeTab, activeProctorExam]);

  const fetchExamsList = async () => {
    let query = supabase.from('exams').select('*').order('schedule_date', { ascending: false });
    if (loggedInUser.role !== 'admin') query = query.eq('guru_id', loggedInUser.id);
    const { data } = await query;
    if (data) {
      setExams(data);
      if (data.length > 0 && !activeExamId) changeActiveExam(data[0].id, data[0].token);
      data.forEach(ex => checkAndRotateToken(ex));
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('name', { ascending: true });
    if (data) { setStudents(data.filter(u => u.role === 'siswa')); setTeachers(data.filter(u => u.role === 'guru' || u.role === 'admin')); }
  };

  const uniqueKelas = [...new Set(students.map(s => s.kelas).filter(Boolean))].sort();
  const filteredStudents = filterKelas ? students.filter(s => s.kelas === filterKelas) : students;

  const changeActiveExam = async (examId, examToken) => {
    try {
      setActiveExamId(examId); setToken(examToken); setShowAnalisisKelas(false);
      const curExam = exams.find(e => String(e.id) === String(examId));
      if (curExam) setExamDuration(curExam.duration_minutes || 60);

      const { data: qData } = await supabase.from('questions').select('*').eq('exam_id', examId).order('id', { ascending: true });
      setQuestions(qData || []);
      const { data: rData } = await supabase.from('exam_results').select('*, users(name, username, kelas)').eq('exam_id', examId).order('score', { ascending: false });
      setResults(rData || []);
      resetForm();
    } catch (err) { console.error(err); }
  };

  const updateDurasiUjian = async () => {
    if (!activeExamId) return;
    const { error } = await supabase.from('exams').update({ duration_minutes: parseInt(examDuration) }).eq('id', activeExamId);
    if (!error) { alert('Durasi diperbarui!'); fetchExamsList(); }
  };

  const generateRandom6Digit = () => Math.floor(100000 + Math.random() * 900000).toString();

  const checkAndRotateToken = async (ex) => {
    if (!ex.is_active) return;
    const now = new Date(); const expiresAt = ex.token_expires_at ? new Date(ex.token_expires_at) : new Date(0);
    if (now >= expiresAt) {
      const newToken = generateRandom6Digit(); const newExpiresAt = new Date(now.getTime() + 15 * 60000);
      await supabase.from('exams').update({ token: newToken, token_expires_at: newExpiresAt.toISOString() }).eq('id', ex.id);
    }
  };

  const forceRotateToken = async (examId) => {
    const newToken = generateRandom6Digit(); const newExpiresAt = new Date(new Date().getTime() + 15 * 60000);
    const { error } = await supabase.from('exams').update({ token: newToken, token_expires_at: newExpiresAt.toISOString() }).eq('id', examId);
    if (!error) { fetchExamsList(); alert('Token berhasil diperbarui!'); }
  };

  const toggleStatusUjian = async (examId, currentStatus) => {
    await supabase.from('exams').update({ is_active: !currentStatus }).eq('id', examId);
    fetchExamsList();
  };

  const fetchLiveSessions = async (examId) => {
    const { data } = await supabase.from('live_sessions').select('*, users(name, username, kelas)').eq('exam_id', examId);
    if (data) setLiveSessions(data);
  };

  const resetSiswa = async (sess) => {
    const isDone = sess.status === 'selesai';
    const msg = isDone ? `Reset ujian ${sess.users?.name}? Nilai akan dihapus.` : `Keluarkan ${sess.users?.name} dari ujian saat ini?`;
    if (!window.confirm(msg)) return;
    
    if (isDone) {
      await supabase.from('exam_results').delete().eq('user_id', sess.user_id).eq('exam_id', sess.exam_id);
      await supabase.from('live_sessions').delete().eq('id', sess.id);
    } else {
      await supabase.from('live_sessions').update({ status: 'dikeluarkan' }).eq('id', sess.id);
    }
    fetchLiveSessions(activeProctorExam);
  };

  const getStatusText = (ex) => {
    if (!ex.is_active) return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">Ditutup</span>;
    if (!ex.schedule_date) return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">Terbuka Bebas</span>;
    const now = new Date(); const start = new Date(`${ex.schedule_date}T${ex.start_time || '00:00'}:00`); const end = new Date(`${ex.schedule_date}T${ex.end_time || '23:59'}:00`);
    if (now < start) return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold border border-yellow-300">Belum Mulai</span>;
    if (now > end) return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-300">Selesai / Lewat</span>;
    return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">Berlangsung</span>;
  };

  const formatCountdown = (expiresAtStr) => {
    if (!expiresAtStr) return "00:00";
    const diff = Math.max(0, Math.floor((new Date(expiresAtStr).getTime() - currentTime.getTime()) / 1000));
    return `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
  };

  const simpanUjian = async (e) => {
    e.preventDefault(); if (!newExamGuruId) return alert('Pilih Guru Pengampu!');
    const payload = { title: newExamTitle, duration_minutes: newExamDuration, guru_id: newExamGuruId, schedule_date: newExamDate || null, start_time: newExamStart || null, end_time: newExamEnd || null, target_kelas: newExamKelas || null };
    if (isEditingExam) {
      await supabase.from('exams').update(payload).eq('id', editExamId); alert('Data diperbarui!'); batalkanEditUjian(); fetchExamsList();
    } else {
      payload.token = generateRandom6Digit(); payload.is_active = true; payload.token_expires_at = new Date(new Date().getTime() + 15 * 60000).toISOString();
      await supabase.from('exams').insert([payload]); alert('Ujian dibuat!'); batalkanEditUjian(); fetchExamsList();
    }
  };

  const handleEditExamClick = (ex) => {
    setNewExamTitle(ex.title); setNewExamGuruId(ex.guru_id); setNewExamDuration(ex.duration_minutes || 60); setNewExamDate(ex.schedule_date || ''); setNewExamStart(ex.start_time || ''); setNewExamEnd(ex.end_time || ''); setNewExamKelas(ex.target_kelas || ''); setIsEditingExam(true); setEditExamId(ex.id); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const batalkanEditUjian = () => { setIsEditingExam(false); setEditExamId(null); setNewExamTitle(''); setNewExamGuruId(''); setNewExamDuration(60); setNewExamDate(''); setNewExamStart(''); setNewExamEnd(''); setNewExamKelas(''); };
  const hapusUjian = async (id, tokenDelete) => {
    if (!window.confirm(`Yakin menghapus ujian ini permanen?`)) return;
    await supabase.from('exam_results').delete().eq('exam_id', id); await supabase.from('questions').delete().eq('exam_id', id); await supabase.from('live_sessions').delete().eq('exam_id', id); await supabase.from('exams').delete().eq('id', id); fetchExamsList();
  };
  
  const simpanSiswa = async (e) => {
    e.preventDefault(); const payload = { name: namaSiswa, kelas: kelasSiswa, username: usernameSiswa, password: passwordSiswa, role: 'siswa' };
    if (isEditingSiswa) { await supabase.from('users').update(payload).eq('id', editSiswaId); resetFormSiswa(); fetchUsers(); } else { await supabase.from('users').insert([payload]); resetFormSiswa(); fetchUsers(); }
  };
  const resetFormSiswa = () => { setNamaSiswa(''); setKelasSiswa(''); setUsernameSiswa(''); setPasswordSiswa(''); setIsEditingSiswa(false); setEditSiswaId(null); };
  const handleEditSiswaClick = (s) => { setNamaSiswa(s.name); setKelasSiswa(s.kelas || ''); setUsernameSiswa(s.username); setPasswordSiswa(s.password); setIsEditingSiswa(true); setEditSiswaId(s.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  
  const simpanGuru = async (e) => {
    e.preventDefault(); const payload = { name: namaGuru, kelas: mapelGuru, username: usernameGuru, password: passwordGuru, role: 'guru' };
    if (isEditingGuru) { await supabase.from('users').update(payload).eq('id', editGuruId); resetFormGuru(); fetchUsers(); } else { await supabase.from('users').insert([payload]); resetFormGuru(); fetchUsers(); }
  };
  const resetFormGuru = () => { setNamaGuru(''); setMapelGuru(''); setUsernameGuru(''); setPasswordGuru(''); setIsEditingGuru(false); setEditGuruId(null); };
  const handleEditGuruClick = (g) => { setNamaGuru(g.name); setMapelGuru(g.kelas || ''); setUsernameGuru(g.username); setPasswordGuru(g.password); setIsEditingGuru(true); setEditGuruId(g.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  
  const hapusUser = async (id, roleName) => { if(window.confirm(`Yakin hapus akun ${roleName} ini?`)) { await supabase.from('users').delete().eq('id', id); fetchUsers(); } };

  // FUNGSI EKSPOR 
  const unduhLaporanKlasikalWord = () => {
    if (results.length === 0) return alert('Belum ada data nilai.');
    const curExam = exams.find(e => String(e.id) === String(activeExamId));
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Laporan Hasil Ujian</title><style>body { font-family: 'Times New Roman', Times, serif; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; text-align: left; } th { background-color: #f2f2f2; text-align: center; } .text-center { text-align: center; }</style></head><body><h2 class="text-center">LAPORAN HASIL UJIAN CBT</h2><p><b>Mata Pelajaran:</b> ${curExam?.title || '-'}<br/><b>Total Siswa:</b> ${results.length}</p><h3>A. Daftar Nilai Siswa</h3><table><tr><th width="5%">No</th><th width="45%">Nama Siswa</th><th width="30%">Kelas</th><th width="20%">Nilai (Skala 100)</th></tr>`;
    results.forEach((r, idx) => { html += `<tr><td class="text-center">${idx + 1}</td><td>${r.users?.name}</td><td class="text-center">${r.users?.kelas || '-'}</td><td class="text-center"><b>${r.score}</b></td></tr>`; });
    html += `</table><br/><br/><h3>B. Analisis Butir Soal (Klasikal)</h3><table><tr><th>No. Soal</th><th>Tipe Soal</th><th>Bobot</th><th>Benar Penuh</th><th>Benar Parsial</th><th>Salah</th><th>Kosong</th></tr>`;
    questions.forEach((q, idx) => {
      let benarPenuh = 0; let benarParsial = 0; let salah = 0; let kosong = 0; const maxScore = parseInt(q.bobot) || 1;
      results.forEach(res => {
        const studentAns = res.answers[q.id]; let obtainedScore = 0;
        if (!studentAns || (Array.isArray(studentAns) && studentAns.length === 0) || (typeof studentAns === 'object' && Object.keys(studentAns).length === 0)) { kosong++; } else {
          if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
          else if (q.type === 'PGK') { const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[]; let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; }); let ratio = (c - w) / cA.length; obtainedScore = (ratio < 0 ? 0 : ratio) * maxScore; }
          else if (q.type === 'BS') { const aO = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; }
          else if (q.type === 'IS') { if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
          else if (q.type === 'M') { const aM = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; }
          if (q.type === 'U') { kosong++; } else { if (obtainedScore >= maxScore * 0.99) benarPenuh++; else if (obtainedScore > 0) benarParsial++; else salah++; }
        }
      });
      html += `<tr><td class="text-center">${idx + 1}</td><td class="text-center">${q.type}</td><td class="text-center">${maxScore}</td><td class="text-center">${q.type==='U'?'-':benarPenuh}</td><td class="text-center">${q.type==='U'?'-':benarParsial}</td><td class="text-center">${q.type==='U'?'Cek Manual':salah}</td><td class="text-center">${kosong}</td></tr>`;
    });
    html += `</table></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Laporan_Ujian.doc`; link.click();
  };

  const unduhAnalisisIndividuWord = (res) => {
    const curExam = exams.find(e => String(e.id) === String(activeExamId));
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Analisis Hasil</title><style>body { font-family: 'Times New Roman', Times, serif; font-size: 12px; } .box { border: 1px solid black; padding: 10px; margin-bottom: 15px; } .correct { color: green; font-weight: bold; } .partial { color: #b45309; font-weight: bold; } .wrong { color: red; font-weight: bold; }</style></head><body><h2 style="text-align:center;">LEMBAR EVALUASI SISWA</h2><p><b>Nama Siswa:</b> ${res.users?.name}<br/><b>Kelas:</b> ${res.users?.kelas || '-'}<br/><b>Mata Pelajaran:</b> ${curExam?.title || '-'}<br/><b>Nilai Akhir:</b> <span style="font-size:16px; font-weight:bold;">${res.score}</span></p><hr/><h3>Rincian Jawaban:</h3>`;
    questions.forEach((q, idx) => {
      const studentAns = res.answers[q.id]; const maxScore = parseInt(q.bobot) || 1; let obtainedScore = 0; let displayStudentAns = studentAns;
      if (studentAns && !(Array.isArray(studentAns) && studentAns.length === 0) && !(typeof studentAns === 'object' && Object.keys(studentAns).length === 0)) {
        if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
        else if (q.type === 'PGK') { const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[]; let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; }); let ratio = (c - w) / cA.length; obtainedScore = (ratio < 0 ? 0 : ratio) * maxScore; displayStudentAns = aA.join(', '); }
        else if (q.type === 'BS') { const aO = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; displayStudentAns = q.options.map((opt, i) => `${opt} (${aO[i] || '-'})`).join(', '); }
        else if (q.type === 'IS') { if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
        else if (q.type === 'M') { const aM = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; displayStudentAns = q.options.map((opt, i) => `${opt} ➜ ${aM[i] || '-'}`).join(' | '); }
      }
      let statusHtml = "";
      if (q.type === 'U') statusHtml = `<b>[KOREKSI MANUAL]</b>`; else if (!studentAns || (Array.isArray(studentAns) && studentAns.length === 0)) statusHtml = `<span class="wrong">[KOSONG - SKOR: 0 / ${maxScore}]</span>`; else if (obtainedScore >= maxScore * 0.99) statusHtml = `<span class="correct">[BENAR - SKOR: ${maxScore} / ${maxScore}]</span>`; else if (obtainedScore > 0) statusHtml = `<span class="partial">[PARSIAL - SKOR: ${Number(obtainedScore.toFixed(2))} / ${maxScore}]</span>`; else statusHtml = `<span class="wrong">[SALAH - SKOR: 0 / ${maxScore}]</span>`;
      let keyStr = ""; if (q.type === 'BS') keyStr = q.options.map((opt, i) => `${opt} (${q.correct_answer[i]})`).join(', '); else if (q.type === 'M') keyStr = q.options.map((opt, i) => `${opt} ➜ ${q.correct_answer[i]}`).join(' | '); else if (Array.isArray(q.correct_answer)) keyStr = q.correct_answer.join(', '); else keyStr = q.correct_answer;
      html += `<div class="box"><p><b>Soal No. ${idx + 1}</b> (Tipe: ${q.type}) ${statusHtml}</p><div>${q.content}</div><p><b>Jawaban Siswa:</b> ${displayStudentAns || '<i>Tidak dijawab</i>'}</p><p><b>Kunci Jawaban:</b> ${keyStr}</p></div>`;
    });
    html += `</body></html>`; const blob = new Blob(['\ufeff', html], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Hasil_${res.users?.name}.doc`; link.click();
  };

  const unduhTemplateCSV = () => {
    const isiCSV = "Nama Lengkap,Kelas,Username,Password\nBudi Santoso,XII IPA 1,siswa01,123456"; const blob = new Blob([isiCSV], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Template_Akun_Siswa.csv'; a.click();
  };

  const handleUploadCSV = (e) => {
    const file = e.target.files[0]; if (!file) return; setIsUploadingCSV(true); const reader = new FileReader();
    reader.onload = async (event) => {
      const rows = event.target.result.split('\n').filter(row => row.trim() !== ''); let startIndex = rows[0].toLowerCase().includes('nama') ? 1 : 0; const newStudents = [];
      for (let i = startIndex; i < rows.length; i++) { const cols = rows[i].split(','); if (cols.length >= 4) newStudents.push({ name: cols[0].trim(), kelas: cols[1].trim(), username: cols[2].trim(), password: cols[3].trim(), role: 'siswa' }); }
      if (newStudents.length > 0) { await supabase.from('users').insert(newStudents); fetchUsers(); alert('Upload Berhasil!'); }
      setIsUploadingCSV(false); e.target.value = null;
    }; reader.readAsText(file);
  };

  const unduhKartuWord = () => {
    if (filteredStudents.length === 0) return alert('Kosong.');
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Kartu</title><style>body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; } .card { border: 1.5px solid black; padding: 3px 5px; margin-bottom: 5px; width: 48%; float: left; margin-right: 2%; box-sizing: border-box; height: 110px; overflow: hidden; } .card:nth-child(even) { margin-right: 0; } .header { text-align: center; border-bottom: 1.5px solid black; padding-bottom: 1px; margin-bottom: 2px; font-weight: bold; font-size: 10px; line-height: 1.1; } table { width: 100%; font-size: 9px; border-collapse: collapse; line-height: 0.9; } td { padding: 0; } .foto { border: 1px solid black; width: 24px; height: 36px; text-align: center; line-height: 36px; font-size: 8px; color: #555; background-color: #f9f9f9; } .ttd { text-align: center; font-size: 8.5px; vertical-align: bottom; line-height: 1; } .clear { clear: both; } .page-break { page-break-before: always; clear: both; }</style></head><body><div style='width: 100%;'>`;
    let body = ""; filteredStudents.forEach((s, idx) => { if (idx > 0 && idx % 10 === 0) body += `<div class="page-break"></div>`; body += `<div class="card"><div class="header">KARTU PESERTA UJIAN CBT<br/>SMAN 1 BATUDAA PANTAI</div><table><tr><td width="55" style="font-weight:bold;">Nama</td><td>: ${s.name}</td></tr><tr><td style="font-weight:bold;">Kelas</td><td>: ${s.kelas || '-'}</td></tr><tr><td style="font-weight:bold;">Username</td><td>: <b>${s.username}</b></td></tr><tr><td style="font-weight:bold;">Password</td><td>: <b>${s.password}</b></td></tr></table><table style="margin-top: 2px;"><tr><td width="50%"><div class="foto">2x3</div></td><td width="50%" class="ttd">Panitia Ujian<br/><br/><br/>________________</td></tr></table></div>`; if ((idx + 1) % 2 === 0) body += "<div class='clear'></div>"; });
    const blob = new Blob(['\ufeff', header + body + "</div></body></html>"], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'Kartu_Ujian.doc'; link.click();
  };

  const unduhTemplateSoalCSV = () => {
    const blob = new Blob(["Tipe,Pertanyaan,Opsi A / Pernyataan 1,Opsi B / Pernyataan 2,Opsi C / Pernyataan 3,Opsi D,Opsi E,Kunci Jawaban,Bobot\nPG,Ibukota Indonesia adalah?,Jakarta,Bandung,Surabaya,Medan,Bali,Jakarta,2\nPGK,Pilih yang termasuk hewan mamalia!,Sapi,Ayam,Kambing,Kucing,Burung,Sapi;Kambing;Kucing,4"], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Template_Bank_Soal.csv'; a.click();
  };

  const handleUploadSoalCSV = (e) => {
    const file = e.target.files[0]; if (!file || !activeExamId) return; setIsUploadingSoalCSV(true); const reader = new FileReader();
    reader.onload = async (event) => {
      const rows = event.target.result.split('\n').filter(row => row.trim() !== ''); let startIndex = rows[0].toLowerCase().includes('tipe') ? 1 : 0; const newQuestions = [];
      for (let i = startIndex; i < rows.length; i++) {
        const rawCols = rows[i].split(',').map(col => col.replace(/^"(.*)"$/, '$1').trim());
        if (rawCols.length >= 8) {
          const tipe = rawCols[0].toUpperCase(); const pertanyaan = rawCols[1]; const bobot = parseInt(rawCols[8]) || 1; const kunciRaw = rawCols[7]; let options = []; let correct_answer = null;
          if (tipe === 'PG') { options = [rawCols[2], rawCols[3], rawCols[4], rawCols[5]||'', rawCols[6]||''].filter(o => o !== ''); correct_answer = kunciRaw; } 
          else if (tipe === 'PGK') { options = [rawCols[2], rawCols[3], rawCols[4], rawCols[5]||'', rawCols[6]||''].filter(o => o !== ''); correct_answer = kunciRaw.split(';').map(k => k.trim()); } 
          else if (tipe === 'BS') { options = [rawCols[2], rawCols[3], rawCols[4]].filter(o => o !== ''); correct_answer = kunciRaw.split(';').map(k => k.trim().toUpperCase()); }
          else if (tipe === 'IS' || tipe === 'U') { correct_answer = kunciRaw; }
          if (pertanyaan) newQuestions.push({ exam_id: activeExamId, type: tipe, content: `<p>${pertanyaan}</p>`, options: options, correct_answer: correct_answer, bobot: bobot });
        }
      }
      if (newQuestions.length > 0) { await supabase.from('questions').insert(newQuestions); changeActiveExam(activeExamId, token); alert('Soal Massal Terupload!'); }
      setIsUploadingSoalCSV(false); e.target.value = null;
    }; reader.readAsText(file);
  };

  const hapusHasilUjian = async (resultId, nama) => {
    if(!window.confirm(`Hapus hasil ujian atas nama "${nama}"?`)) return;
    await supabase.from('exam_results').delete().eq('id', resultId); setResults(results.filter(r => r.id !== resultId));
  };

  const handleSmartPaste = (e, currentIdx, setOpsiArray, currentOpsi) => {
    const pasteText = e.clipboardData.getData('text');
    if (pasteText.includes('\n')) {
      e.preventDefault(); const lines = pasteText.split('\n').map(line => line.replace(/^[A-Ea-e][.)]\s*/, '').trim()).filter(line => line !== '');
      const newOpsi = [...currentOpsi]; for (let i = 0; i < lines.length && (currentIdx + i) < newOpsi.length; i++) newOpsi[currentIdx + i] = lines[i];
      setOpsiArray(newOpsi);
    }
  };

  const resetForm = () => { setTipeSoal('PG'); setBobotSoal(1); setSoalText(''); setOpsiPG(['', '', '', '', '']); setKunciPG(0); setOpsiPGK(['', '', '', '', '']); setKunciPGK([]); setOpsiBS(['', '', '']); setKunciBS(['B', 'B', 'B']); setKunciIS(''); setKunciU(''); setPasanganM([{kiri: '', kanan: ''}, {kiri: '', kanan: ''}]); setIsEditing(false); setEditQuestionId(null); };

  const handleSimpanSoal = async (e) => {
    e.preventDefault(); if (!activeExamId || !soalText) return alert('Pilih Token & isi soal!');
    let optionsToSave = [], answerToSave = null;
    if (tipeSoal === 'PG') { optionsToSave = opsiPG; answerToSave = opsiPG[kunciPG]; }
    else if (tipeSoal === 'PGK') { if (kunciPGK.length === 0 || kunciPGK.length > 3) return alert('Pilih maks 3 jawaban!'); optionsToSave = opsiPGK; answerToSave = kunciPGK.map(idx => opsiPGK[idx]); } 
    else if (tipeSoal === 'BS') { optionsToSave = opsiBS; answerToSave = kunciBS; }
    else if (tipeSoal === 'IS' || tipeSoal === 'U') { answerToSave = tipeSoal==='IS'?kunciIS:kunciU; }
    else if (tipeSoal === 'M') { optionsToSave = pasanganM.map(p => p.kiri); answerToSave = pasanganM.map(p => p.kanan); }

    const payload = { exam_id: activeExamId, type: tipeSoal, content: soalText, options: optionsToSave, correct_answer: answerToSave, bobot: parseInt(bobotSoal) || 1 };
    if (isEditing) { await supabase.from('questions').update(payload).eq('id', editQuestionId); alert('Soal diperbarui!'); } 
    else { await supabase.from('questions').insert([payload]); alert('Soal ditambahkan!'); }
    resetForm(); changeActiveExam(activeExamId, token);
  };

  const handleEditClick = (q) => {
    setTipeSoal(q.type); setBobotSoal(q.bobot || 1); setSoalText(q.content); setIsEditing(true); setEditQuestionId(q.id);
    if (q.type === 'PG') { setOpsiPG(q.options); setKunciPG(q.options.indexOf(q.correct_answer)); }
    else if (q.type === 'PGK') { setOpsiPGK(q.options); setKunciPGK(q.correct_answer.map(ans => q.options.indexOf(ans))); }
    else if (q.type === 'BS') { setOpsiBS(q.options); setKunciBS(q.correct_answer); }
    else if (q.type === 'IS') { setKunciIS(q.correct_answer); }
    else if (q.type === 'U') { setKunciU(q.correct_answer); }
    else if (q.type === 'M') { setPasanganM(q.options.map((opt, i) => ({ kiri: opt, kanan: q.correct_answer[i] }))); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHapusSoal = async (id) => { if (window.confirm('Hapus soal ini?')) { await supabase.from('questions').delete().eq('id', id); changeActiveExam(activeExamId, token); } };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl text-sm font-bold transition-all ${activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'}`}>
      <Icon size={20}/> <span>{label}</span>
    </button>
  );

  if (isPrintingCards) {
    return (
      <div className="bg-gray-100 min-h-screen text-black print:bg-white">
        <div className="print:hidden p-4 bg-white flex justify-between items-center shadow-md mb-6 sticky top-0 z-50">
          <div><h2 className="text-xl font-bold">Pratinjau Cetak Kartu ({filteredStudents.length} Siswa)</h2></div>
          <div className="flex gap-3">
             <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Print / PDF</button>
             <button onClick={() => setIsPrintingCards(false)} className="px-6 py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700 flex items-center gap-2"><X size={18}/> Tutup</button>
          </div>
        </div>
        <div className="p-4 print:p-0 print:m-0 w-full max-w-[210mm] mx-auto bg-white print:bg-transparent shadow-lg print:shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 print:gap-1.5">
            {filteredStudents.map((s, idx) => (
               <div key={s.id} className="border border-black p-1.5 bg-white break-inside-avoid h-[50mm] flex flex-col justify-between">
                  <div>
                    <div className="text-center font-bold text-[8.5px] border-b border-black pb-0.5 mb-0.5 uppercase">KARTU PESERTA UJIAN CBT<br/>SMAN 1 BATUDAA PANTAI</div>
                    <table className="w-full text-[8px] table-fixed" style={{ lineHeight: '1.1' }}>
                      <tbody>
                        <tr><td className="w-12 font-bold p-0">Nama</td><td className="p-0 truncate">: {s.name}</td></tr>
                        <tr><td className="font-bold p-0">Kelas</td><td className="p-0 truncate">: {s.kelas || '-'}</td></tr>
                        <tr><td className="font-bold p-0">Username</td><td className="font-mono font-bold text-blue-800 print:text-black p-0 truncate">: {s.username}</td></tr>
                        <tr><td className="font-bold p-0">Password</td><td className="font-mono font-bold text-red-700 print:text-black p-0 truncate">: {s.password}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-end mt-auto pt-0.5">
                     <div className="w-6 h-9 border border-gray-400 flex items-center justify-center text-[6px] text-gray-500 font-bold bg-gray-50">2x3</div>
                     <div className="text-center text-[7px] font-bold leading-none">Panitia Ujian<br/><br/><br/>__________________</div>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f4f7fb] font-sans print:bg-white">
      <div className="md:hidden bg-white p-4 flex justify-between items-center border-b shadow-sm sticky top-0 z-30 print:hidden">
         <div className="flex items-center gap-2"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-inner"><ShieldCheck className="text-white" size={20}/></div><h1 className="font-black text-gray-800">CBT Admin</h1></div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600 bg-gray-100 rounded-lg">{isMobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>

      <div className={`w-full md:w-64 bg-white border-r shadow-sm shrink-0 flex-col h-screen md:sticky md:top-0 print:hidden transition-all duration-300 absolute md:relative z-20 ${isMobileMenuOpen ? 'flex left-0' : 'hidden md:flex'}`}>
        <div className="p-6 border-b hidden md:block">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-inner"><ShieldCheck className="text-white" size={24}/></div>
             <div><h1 className="text-base font-black text-gray-800 leading-tight">Portal Ujian</h1><p className="text-[10px] text-gray-500 font-bold uppercase">SMAN 1 Batudaa Pantai</p></div>
          </div>
        </div>
        
        <div className="p-4 flex-1 space-y-2 overflow-y-auto">
          <NavItem id="jadwal" icon={Key} label="Jadwal & Token" />
          <NavItem id="pantau" icon={Activity} label="Pantau Peserta" />
          <NavItem id="hasil" icon={BarChart2} label="Analisis Hasil" />
          
          {/* DIPERBAIKI: Bank Soal kini tersedia untuk Admin DAN Guru */}
          <NavItem id="soal" icon={FileText} label="Bank Soal" />
          
          {loggedInUser.role === 'admin' && (
            <>
              <NavItem id="siswa" icon={Users} label="Akun Siswa" />
              <NavItem id="guru" icon={ShieldCheck} label="Akun Guru" />
            </>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
           <div className="mb-3 px-2 hidden md:block"><p className="font-bold text-sm text-gray-800">{loggedInUser.name}</p><p className="text-xs text-gray-500 font-semibold">{loggedInUser.role === 'admin' ? 'Administrator' : 'Pengawas/Guru'}</p></div>
           <button onClick={() => { localStorage.removeItem('user'); navigate('/'); }} className="w-full p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold flex items-center justify-center gap-2 border border-red-200"><LogOut size={16}/> Keluar</button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-10 overflow-y-auto print:p-0 print:overflow-visible">
        
        {/* === TAB 1: JADWAL & TOKEN === */}
        {activeTab === 'jadwal' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div><h2 className="text-2xl font-black text-gray-800">Jadwal & Token Ujian</h2><p className="text-gray-500 font-medium text-sm md:text-base">Token akan diperbarui otomatis setiap 15 menit.</p></div>
            {loggedInUser.role === 'admin' && (
              <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="text-lg font-bold text-gray-800">{isEditingExam ? 'Edit Jadwal Ujian' : 'Buat Sesi Ujian Baru'}</h3>
                  {isEditingExam && <button onClick={batalkanEditUjian} className="text-red-500 font-bold text-sm">Batal</button>}
                </div>
                <form onSubmit={simpanUjian} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Mata Pelajaran / Judul</label>
                    <input required type="text" className="w-full p-2.5 border rounded-lg bg-gray-50 focus:bg-white outline-none focus:border-indigo-500 font-medium" value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Guru Pengampu</label>
                    <select required className="w-full p-2.5 border rounded-lg bg-gray-50 outline-none focus:border-indigo-500 font-medium" value={newExamGuruId} onChange={(e) => setNewExamGuruId(e.target.value)}>
                      <option value="">- Pilih Guru -</option><option value={loggedInUser.id}>Admin (Saya)</option>
                      {teachers.filter(t => t.role === 'guru').map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Target Kelas</label>
                    <input type="text" placeholder="Cth: XII IPA 1" className="w-full p-2.5 border rounded-lg bg-gray-50 outline-none focus:border-indigo-500 font-medium" value={newExamKelas} onChange={(e) => setNewExamKelas(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tanggal Ujian</label>
                    <input type="date" className="w-full p-2.5 border rounded-lg bg-gray-50 outline-none font-medium" value={newExamDate} onChange={(e) => setNewExamDate(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Jam Mulai</label>
                    <input type="time" className="w-full p-2.5 border rounded-lg bg-gray-50 outline-none font-medium" value={newExamStart} onChange={(e) => setNewExamStart(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Jam Selesai</label>
                    <input type="time" className="w-full p-2.5 border rounded-lg bg-gray-50 outline-none font-medium" value={newExamEnd} onChange={(e) => setNewExamEnd(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Durasi</label>
                    <div className="flex border rounded-lg overflow-hidden bg-gray-50"><input required type="number" className="w-full p-2.5 bg-transparent outline-none font-medium text-center" value={newExamDuration} onChange={(e) => setNewExamDuration(e.target.value)} /><span className="bg-gray-200 px-3 flex items-center text-xs font-bold text-gray-600">Mnt</span></div>
                  </div>
                  <div className="md:col-span-4 flex justify-end mt-2">
                     <button type="submit" className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-colors">{isEditingExam ? 'Simpan Perubahan' : 'Generate Sesi Ujian'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="space-y-4">
               {exams.map(ex => (
                 <div key={ex.id} className={`bg-white border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${!ex.is_active ? 'opacity-60 grayscale' : 'hover:border-indigo-300 hover:shadow-md'}`}>
                    <div className="flex-1">
                       <div className="flex items-center gap-3 mb-1"><h3 className="text-xl font-black text-gray-800">{ex.title}</h3>{getStatusText(ex)}</div>
                       <p className="text-sm text-gray-500 font-medium flex flex-wrap items-center gap-1.5"><Users size={14}/> Kelas: {ex.target_kelas || 'Semua'} <span className="mx-2 hidden md:inline">•</span><br className="md:hidden"/> <Calendar size={14}/> {ex.schedule_date || '-'} <span className="mx-2">•</span> <ClockIcon size={14}/> Sesi: {ex.start_time || '--:--'} - {ex.end_time || '--:--'} ({ex.duration_minutes} Mnt)</p>
                       <div className="flex flex-wrap gap-2 mt-4">
                          {loggedInUser.role === 'admin' && (
                             <>
                               <button onClick={() => handleEditExamClick(ex)} className="px-3 py-1.5 bg-gray-100 text-gray-700 font-bold rounded border hover:bg-gray-200 text-xs flex items-center gap-1"><Edit size={14}/> Edit</button>
                               <button onClick={() => hapusUjian(ex.id, ex.token)} className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded border border-red-200 hover:bg-red-100 text-xs flex items-center gap-1"><Trash2 size={14}/> Hapus</button>
                             </>
                          )}
                          <button onClick={() => toggleStatusUjian(ex.id, ex.is_active)} className={`px-3 py-1.5 font-bold rounded border text-xs flex items-center gap-1 ${ex.is_active ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                             <XSquare size={14}/> {ex.is_active ? 'Tutup Ujian' : 'Buka Ujian'}
                          </button>
                          <button onClick={() => { setActiveProctorExam(ex.id); setActiveTab('pantau'); setIsMobileMenuOpen(false); }} className="px-4 py-1.5 bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-200 text-xs flex items-center gap-1 ml-auto md:ml-4"><Activity size={16}/> Live Pantau</button>
                       </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl min-w-[200px]">
                       <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Token Ujian</span>
                       {ex.is_active ? (
                          <>
                            <span className="text-3xl md:text-4xl font-black font-mono text-indigo-900 tracking-[0.2em] leading-none mb-2">{ex.token}</span>
                            <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1"><RefreshCw size={12} className={formatCountdown(ex.token_expires_at) === '00:00' ? 'animate-spin' : ''}/> Ganti dalam {formatCountdown(ex.token_expires_at)}</span>
                            <button onClick={() => forceRotateToken(ex.id)} className="text-[10px] text-indigo-500 font-bold underline mt-2 hover:text-indigo-700">Ganti Sekarang</button>
                          </>
                       ) : (<span className="text-xl font-bold text-gray-400 mt-2">DITUTUP</span>)}
                    </div>
                 </div>
               ))}
               {exams.length === 0 && <p className="text-center p-10 text-gray-500 font-bold">Belum ada jadwal ujian.</p>}
            </div>
          </div>
        )}

        {/* === TAB 2: PANTAU PESERTA (LIVE PROKTOR) === */}
        {activeTab === 'pantau' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
               <div><h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Activity className="text-indigo-600"/> Live Proktor</h2><p className="text-gray-500 font-medium">Pantau dan kelola aktivitas peserta ujian.</p></div>
               <button onClick={() => { if(activeProctorExam) fetchLiveSessions(activeProctorExam); }} className="w-full md:w-auto px-4 py-2 bg-white border shadow-sm rounded-lg font-bold text-sm text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50"><RefreshCw size={16}/> Segarkan Data</button>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
               <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Ujian yang Sedang Berlangsung:</label>
               <select value={activeProctorExam || ''} onChange={(e) => setActiveProctorExam(e.target.value)} className="w-full p-3 border-2 border-indigo-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-900 bg-indigo-50 cursor-pointer text-base md:text-lg">
                 <option value="">-- Pilih Mata Pelajaran --</option>
                 {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title} (Kelas: {ex.target_kelas || 'Semua'})</option>)}
               </select>
            </div>

            {activeProctorExam && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                   <h3 className="font-bold text-gray-800">Daftar Peserta Login ({liveSessions.length})</h3>
                   <div className="flex flex-wrap gap-3 md:gap-4 text-xs font-bold">
                     <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Mengerjakan</span>
                     <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Selesai</span>
                     <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Offline/Keluar</span>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs tracking-wider">
                      <tr><th className="p-4">Nama Siswa</th><th className="p-4">Kelas</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Posisi Soal</th><th className="p-4 text-right">Aksi Tindakan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {liveSessions.map(sess => {
                        const isOffline = (new Date().getTime() - new Date(sess.last_active).getTime()) > 30000; 
                        const isDone = sess.status === 'selesai';
                        let dotColor = 'bg-green-500 animate-pulse'; let statusLabel = 'Sedang Mengerjakan';
                        if (isDone) { dotColor = 'bg-blue-500'; statusLabel = 'Telah Selesai'; } else if (isOffline) { dotColor = 'bg-red-500'; statusLabel = 'Offline / Terputus'; }

                        return (
                          <tr key={sess.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="p-4 font-bold text-gray-800">{sess.users?.name} <span className="block text-[10px] text-gray-400 font-mono font-normal">{sess.users?.username}</span></td>
                            <td className="p-4 text-gray-600 font-medium">{sess.users?.kelas || '-'}</td>
                            <td className="p-4">
                               <div className="flex items-center justify-center gap-2 border px-3 py-1 rounded-full bg-white shadow-sm w-fit mx-auto">
                                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div> <span className="text-xs font-bold text-gray-700">{statusLabel}</span>
                               </div>
                            </td>
                            <td className="p-4 text-center font-black text-indigo-600">{isDone ? '-' : `No. ${sess.current_question_index + 1}`}</td>
                            <td className="p-4 text-right">
                               <button onClick={() => resetSiswa(sess)} className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded-lg border border-red-200 hover:bg-red-100 text-xs flex items-center justify-center gap-1 w-24 ml-auto transition-colors">
                                  {isDone ? <RefreshCw size={14}/> : <XSquare size={14}/>} {isDone ? 'Reset Ujian' : 'Keluarkan'}
                               </button>
                            </td>
                          </tr>
                        );
                      })}
                      {liveSessions.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-bold italic">Belum ada siswa yang masuk (login) ke ujian ini.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === TAB HASIL === */}
        {activeTab === 'hasil' && (
          <div className="space-y-6 print:space-y-0">
            <div className="bg-white p-4 md:p-6 rounded-lg shadow print:shadow-none print:p-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-100 pb-4 print:hidden">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 border-l-4 border-indigo-600 pl-3">Hasil Ujian</h2>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select value={activeExamId ? String(activeExamId) : ''} onChange={(e) => { const s = exams.find(x => String(x.id) === e.target.value); if (s) changeActiveExam(s.id, s.token); }} className="p-2 bg-indigo-50 border border-indigo-300 rounded-lg text-indigo-900 font-bold cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm flex-1 md:flex-none">
                    {exams.length === 0 && <option value="">Belum ada ujian</option>}
                    {exams.map(ex => (<option key={ex.id} value={String(ex.id)}>{ex.title} ({ex.target_kelas || 'Semua'})</option>))}
                  </select>
                  <button onClick={() => changeActiveExam(activeExamId, token)} className="px-3 py-2 bg-gray-200 text-gray-800 rounded font-bold hover:bg-gray-300 text-sm">Refresh</button>
                  <button onClick={() => setShowAnalisisKelas(!showAnalisisKelas)} className="px-3 py-2 bg-purple-100 text-purple-800 rounded font-bold hover:bg-purple-200 flex items-center gap-1 text-sm"><BarChart2 size={16}/> Analisis Klasikal</button>
                  <button onClick={() => window.print()} className="px-3 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 flex items-center gap-1 text-sm"><Printer size={16}/> Cetak PDF</button>
                  <button onClick={unduhLaporanKlasikalWord} className="px-3 py-2 bg-indigo-800 text-white rounded font-bold hover:bg-indigo-900 flex items-center gap-1 text-sm"><FileText size={16}/> Ekspor Word</button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-6"><h2 className="text-2xl font-bold">LAPORAN HASIL UJIAN CBT</h2><p className="text-lg">Mata Pelajaran: {exams.find(e => String(e.id) === String(activeExamId))?.title || '-'}</p><hr className="border-black mt-2"/></div>
              
              {showAnalisisKelas && (
                <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-xl print:border-none print:p-0 print:bg-transparent print:mb-4">
                  <h3 className="text-xl font-bold text-purple-900 mb-6 border-b border-purple-200 pb-2 print:text-black">A. Analisis Butir Soal Keseluruhan (Total Peserta: {results.length})</h3>
                  {results.length === 0 ? (<p className="text-gray-500 italic">Belum ada siswa yang mengerjakan ujian ini.</p>) : (
                    <div className="space-y-6 print:space-y-4">
                      {questions.map((q, idx) => {
                        let benarPenuh = 0; let benarParsial = 0; let salah = 0; let kosong = 0; const maxScore = parseInt(q.bobot) || 1;
                        results.forEach(res => {
                          const studentAns = res.answers[q.id]; let obtainedScore = 0;
                          if (!studentAns || (Array.isArray(studentAns) && studentAns.length === 0) || (typeof studentAns === 'object' && Object.keys(studentAns).length === 0)) { kosong++; } else {
                            if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
                            else if (q.type === 'PGK') { const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[]; let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; }); let ratio = (c - w) / cA.length; obtainedScore = (ratio < 0 ? 0 : ratio) * maxScore; }
                            else if (q.type === 'BS') { const aO = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; }
                            else if (q.type === 'IS') { if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
                            else if (q.type === 'M') { const aM = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; }
                            
                            if (q.type === 'U') { kosong++; } else { if (obtainedScore >= maxScore * 0.99) benarPenuh++; else if (obtainedScore > 0) benarParsial++; else salah++; }
                          }
                        });

                        const totalSiswa = results.length; const p1 = totalSiswa ? Math.round((benarPenuh / totalSiswa) * 100) : 0; const bp = totalSiswa ? Math.round((benarParsial / totalSiswa) * 100) : 0; const p2 = p1 + bp; const ps = totalSiswa ? Math.round((salah / totalSiswa) * 100) : 0; const p3 = p2 + ps; let pk = totalSiswa ? (100 - p1 - bp - ps) : 0; if (pk < 0) pk = 0;
                        const conicGradient = `conic-gradient(#22c55e 0% ${p1}%, #eab308 ${p1}% ${p2}%, #ef4444 ${p2}% ${p3}%, #9ca3af ${p3}% 100%)`;

                        return (
                          <div key={q.id} className="p-5 bg-white border rounded-xl shadow-sm print:shadow-none print:border-black print:break-inside-avoid">
                            <div className="flex justify-between items-center mb-4 border-b pb-3 print:border-black"><span className="font-bold text-lg print:text-base">Soal No. {idx + 1} <span className="text-sm font-normal text-gray-500 print:text-gray-800">({q.type} - Bobot: {maxScore})</span></span><span className={`text-xs font-bold px-3 py-1 rounded-full print:border print:border-black ${q.type === 'U' ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-800'}`}>{q.type === 'U' ? 'Manual Check' : 'Auto-Grade'}</span></div>
                            {q.type === 'U' ? ( <div className="text-gray-500 italic p-4 bg-gray-50 rounded text-center print:border print:border-gray-300">Soal uraian dinilai manual.</div> ) : (
                              <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex-1 w-full"><div className="prose max-w-none text-sm md:text-base text-gray-700 print:text-black" dangerouslySetInnerHTML={{ __html: q.content }} /></div>
                                <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100 w-full md:w-auto shrink-0 print:border-black print:bg-transparent">
                                   <div className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center shadow-md shrink-0 relative print:shadow-none print:border print:border-gray-200" style={{ background: conicGradient }}>
                                      <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-full flex items-center justify-center shadow-inner absolute print:bg-white print:border print:border-gray-300"><span className="text-xs md:text-sm font-bold text-gray-500 print:text-black">{totalSiswa} Siswa</span></div>
                                   </div>
                                   <div className="flex flex-col gap-2 text-xs md:text-sm font-bold">
                                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Benar: {benarPenuh} ({p1}%)</span></div>
                                      {benarParsial > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Parsial: {benarParsial} ({bp}%)</span></div>}
                                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Salah: {salah} ({ps}%)</span></div>
                                      {kosong > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Kosong: {kosong} ({pk}%)</span></div>}
                                   </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto border rounded-lg mt-4 print:border-none print:mt-0">
                <h3 className="hidden print:block text-xl font-bold mb-2">B. Daftar Nilai Siswa (Skala 100)</h3>
                <table className="w-full text-left border-collapse text-sm md:text-base print:border print:border-black">
                  <thead><tr className="bg-gray-100 border-b-2 border-gray-200 print:border-black print:bg-transparent">
                      <th className="p-2 md:p-4 print:border print:border-black">Nama</th><th className="p-2 md:p-4 print:border print:border-black hidden md:table-cell">Kelas</th><th className="p-2 md:p-4 print:border print:border-black text-center">Nilai Auto-Grade</th><th className="p-2 md:p-4 text-right print:hidden">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {results.map((res) => (
                      <tr key={res.id} className="border-b hover:bg-gray-50 transition-colors print:border-black">
                        <td className="p-2 md:p-4 font-semibold text-gray-800 print:border print:border-black print:text-black">{res.users?.name} <div className="text-xs text-gray-500 md:hidden">{res.users?.kelas}</div></td>
                        <td className="p-2 md:p-4 hidden md:table-cell text-gray-600 print:border print:border-black print:text-black">{res.users?.kelas || '-'}</td>
                        <td className="p-2 md:p-4 text-center font-bold text-xl md:text-2xl text-indigo-600 print:border print:border-black print:text-black print:text-lg">{res.score}</td>
                        <td className="p-2 md:p-4 text-right flex justify-end gap-1 md:gap-2 items-center print:hidden">
                          <button onClick={() => setSelectedResult(res)} className="px-2 py-1.5 md:px-4 md:py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 text-xs md:text-sm">Analisis Rinci</button>
                          <button onClick={() => hapusHasilUjian(res.id, res.users?.name)} className="p-1.5 md:p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (<tr><td colSpan="4" className="p-6 md:p-8 text-center text-gray-500 italic print:border print:border-black">Belum ada data nilai masuk.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedResult && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[9999] print:absolute print:inset-0 print:bg-transparent print:p-0 print:block">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:w-full print:m-0">
              <div className="flex justify-between items-center mb-6 border-b pb-4 print:hidden">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Evaluasi: {selectedResult.users?.name}</h2>
                <div className="flex gap-2 items-center"><button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white font-bold rounded shadow hover:bg-green-700 flex items-center gap-2"><Printer size={16}/> Cetak</button><button onClick={() => unduhAnalisisIndividuWord(selectedResult)} className="px-4 py-2 bg-indigo-800 text-white font-bold rounded shadow hover:bg-indigo-900 flex items-center gap-2"><FileText size={16}/> Ekspor Word</button><button onClick={() => setSelectedResult(null)} className="ml-2 text-red-500 hover:bg-red-50 p-2 rounded-full font-bold"><X size={24}/></button></div>
              </div>
              <div className="hidden print:block text-center mb-6"><h2 className="text-2xl font-bold">LEMBAR EVALUASI SISWA</h2><p className="text-lg">Mata Pelajaran: {exams.find(e => String(e.id) === String(activeExamId))?.title || '-'}</p><hr className="border-black my-4"/><table className="w-full text-left font-bold text-lg mb-6"><tbody><tr><td width="20%">Nama Siswa</td><td>: {selectedResult.users?.name}</td><td rowSpan="2" className="text-right text-3xl">Nilai: {selectedResult.score}</td></tr><tr><td>Kelas</td><td>: {selectedResult.users?.kelas || '-'}</td></tr></tbody></table></div>
              
              <div className="space-y-6 print:space-y-4">
                {questions.map((q, idx) => {
                  const studentAns = selectedResult.answers[q.id]; const maxScore = parseInt(q.bobot) || 1; let obtainedScore = 0; let displayStudentAns = studentAns;
                  if (studentAns && !(Array.isArray(studentAns) && studentAns.length === 0) && !(typeof studentAns === 'object' && Object.keys(studentAns).length === 0)) {
                    if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
                    else if (q.type === 'PGK') { const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[]; let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; }); let ratio = (c - w) / cA.length; obtainedScore = (ratio < 0 ? 0 : ratio) * maxScore; displayStudentAns = aA.join(', '); }
                    else if (q.type === 'BS') { const aO = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; displayStudentAns = q.options.map((opt, i) => `${opt} (${aO[i] || '-'})`).join(', '); }
                    else if (q.type === 'IS') { if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
                    else if (q.type === 'M') { const aM = studentAns || {}; let c = 0; q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; }); obtainedScore = (c / q.correct_answer.length) * maxScore; displayStudentAns = q.options.map((opt, i) => `${opt} ➜ ${aM[i] || '-'}`).join(' | '); }
                  }
                  
                  let boxBorder = 'border-red-300 bg-red-50'; let statusIcon = <XCircle size={18} className="text-red-600 shrink-0 print:hidden"/>; let badge = <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-300 print:text-black print:border-black">Skor: 0 / {maxScore}</span>;
                  if (q.type === 'U') { boxBorder = 'border-blue-300 bg-blue-50'; statusIcon = <CheckCircle size={18} className="text-blue-600 shrink-0 print:hidden"/>; badge = <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-300 print:text-black print:border-black">Menunggu Koreksi</span>; } 
                  else if (!studentAns || (Array.isArray(studentAns) && studentAns.length === 0)) { badge = <span className="text-xs font-bold bg-gray-200 text-gray-800 px-2 py-0.5 rounded border border-gray-400 print:text-black print:border-black">Kosong (Skor: 0 / {maxScore})</span>; } 
                  else if (obtainedScore >= maxScore * 0.99) { boxBorder = 'border-green-300 bg-green-50'; statusIcon = <CheckCircle size={18} className="text-green-600 shrink-0 print:hidden"/>; badge = <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-300 print:text-black print:border-black">Skor: {maxScore} / {maxScore} (Sempurna)</span>; } 
                  else if (obtainedScore > 0) { boxBorder = 'border-yellow-300 bg-yellow-50'; statusIcon = <AlertTriangle size={18} className="text-yellow-600 shrink-0 print:hidden"/>; badge = <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-400 print:text-black print:border-black">Skor: {Number(obtainedScore.toFixed(2))} / {maxScore} (Parsial)</span>; }

                  let keyStr = ""; if (q.type === 'BS') keyStr = q.options.map((opt, i) => `${opt} (${q.correct_answer[i]})`).join(', '); else if (q.type === 'M') keyStr = q.options.map((opt, i) => `${opt} ➜ ${q.correct_answer[i]}`).join('  |  '); else if (Array.isArray(q.correct_answer)) keyStr = q.correct_answer.join(', '); else keyStr = q.correct_answer;
                  return (
                    <div key={q.id} className={`p-4 md:p-5 border rounded-lg ${boxBorder} print:bg-transparent print:border-black print:break-inside-avoid`}><div className="flex gap-2 font-semibold text-gray-800 border-b pb-3 mb-3 print:border-black"><span>{idx + 1}.</span><div className="w-full"><div className="flex justify-between items-center w-full mb-2"><span className="text-xs font-bold text-gray-500 print:text-black">Tipe: {q.type}</span>{badge}</div><div className="prose max-w-none text-sm md:text-base print:text-black" dangerouslySetInnerHTML={{ __html: q.content }} /></div></div>
                      <div className="text-sm grid grid-cols-1 md:grid-cols-2 gap-4"><div><p className="text-gray-600 mb-1 font-bold print:text-black">Jawaban Siswa:</p><p className="font-medium flex items-start gap-2 print:text-black">{statusIcon}<span className="break-words font-bold">{displayStudentAns || 'Tidak dijawab'}</span></p></div><div><p className="text-gray-600 mb-1 font-bold print:text-black">Kunci Benar:</p><p className="font-medium text-indigo-700 break-words print:text-black">{keyStr}</p></div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* === TAB SOAL (REVISI: TERBUKA JUGA UNTUK GURU) === */}
        {activeTab === 'soal' && (
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-
