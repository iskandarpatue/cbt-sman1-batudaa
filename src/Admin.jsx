import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, PlusCircle, CheckCircle, XCircle, AlertTriangle, Edit, Trash2, UserPlus, BarChart2, Upload, Download, Menu, X, ShieldCheck, LogOut, Printer, Filter } from 'lucide-react';
import JoditEditor from 'jodit-react';

export default function Admin() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeTab, setActiveTab] = useState('hasil');
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

  // Form Pembuatan & Edit Ujian
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamGuruId, setNewExamGuruId] = useState('');
  const [isEditingExam, setIsEditingExam] = useState(false);
  const [editExamId, setEditExamId] = useState(null);

  const [examDuration, setExamDuration] = useState(60);

  // Form Bank Soal 
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

  // STATE USER
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelasSiswa, setKelasSiswa] = useState('');
  const [usernameSiswa, setUsernameSiswa] = useState('');
  const [passwordSiswa, setPasswordSiswa] = useState('');
  const [isEditingSiswa, setIsEditingSiswa] = useState(false);
  const [editSiswaId, setEditSiswaId] = useState(null);
  const [filterKelas, setFilterKelas] = useState(''); // Filter Kelas State

  const [namaGuru, setNamaGuru] = useState('');
  const [mapelGuru, setMapelGuru] = useState('');
  const [usernameGuru, setUsernameGuru] = useState('');
  const [passwordGuru, setPasswordGuru] = useState('');
  const [isEditingGuru, setIsEditingGuru] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [isUploadingSoalCSV, setIsUploadingSoalCSV] = useState(false);

  const editor = useRef(null);
  const editorConfig = { 
    readonly: false, height: 350, uploader: { insertImageAsBase64URI: true }, 
    buttons: ['bold', 'italic', 'underline', 'superscript', 'subscript', 'ul', 'ol', 'image', 'table', 'symbol'] 
  };

  useEffect(() => {
    if (!loggedInUser.id) { navigate('/'); return; }
    fetchExamsList();
    if (loggedInUser.role === 'admin') fetchUsers();
  }, [navigate]);

  const fetchExamsList = async () => {
    let query = supabase.from('exams').select('*').order('id', { ascending: false });
    if (loggedInUser.role !== 'admin') query = query.eq('guru_id', loggedInUser.id);
    const { data } = await query;
    if (data) {
      setExams(data);
      if (data.length > 0 && !activeExamId) changeActiveExam(data[0].id, data[0].token);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('name', { ascending: true });
    if (data) {
      setStudents(data.filter(u => u.role === 'siswa'));
      setTeachers(data.filter(u => u.role === 'guru' || u.role === 'admin'));
    }
  };

  // LOGIKA FILTER KELAS SISWA
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
    } catch (err) { console.error("Error switching token:", err); }
  };

  const updateDurasiUjian = async () => {
    if (!activeExamId) return;
    const { error } = await supabase.from('exams').update({ duration_minutes: parseInt(examDuration) }).eq('id', activeExamId);
    if (!error) { alert('Durasi waktu ujian berhasil diperbarui!'); fetchExamsList(); } else alert('Gagal memperbarui durasi: ' + error.message);
  };

  const simpanUjian = async (e) => {
    e.preventDefault();
    if (!newExamGuruId) return alert('Pilih Guru Pengampu terlebih dahulu!');
    
    if (isEditingExam) {
      const { error } = await supabase.from('exams').update({ 
        title: newExamTitle, duration_minutes: newExamDuration, guru_id: newExamGuruId 
      }).eq('id', editExamId);
      
      if (!error) {
        alert('Data ujian berhasil diperbarui!');
        batalkanEditUjian(); fetchExamsList();
      } else alert('Gagal memperbarui ujian: ' + error.message);
    } else {
      const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase.from('exams').insert([{ 
        title: newExamTitle, token: newToken, is_active: true, duration_minutes: newExamDuration, guru_id: newExamGuruId 
      }]).select();
      
      if (data && !error) {
        alert(`Ujian "${newExamTitle}" berhasil dibuat dengan Token: ${newToken}`);
        batalkanEditUjian(); fetchExamsList(); changeActiveExam(data[0].id, data[0].token);
      } else alert('Gagal membuat ujian baru: ' + (error?.message || 'Error database'));
    }
  };

  const handleEditExamClick = (ex) => {
    setNewExamTitle(ex.title);
    setNewExamGuruId(ex.guru_id);
    setNewExamDuration(ex.duration_minutes || 60);
    setIsEditingExam(true);
    setEditExamId(ex.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const batalkanEditUjian = () => {
    setIsEditingExam(false); setEditExamId(null);
    setNewExamTitle(''); setNewExamGuruId(''); setNewExamDuration(60);
  };

  const hapusUjian = async (id, tokenDelete) => {
    const konfirmasi = window.confirm(`AWAS! Yakin menghapus Token: ${tokenDelete}?\n\nSemua soal pada token ini akan terhapus permanen.`);
    if (!konfirmasi) return;
    await supabase.from('exam_results').delete().eq('exam_id', id);
    await supabase.from('questions').delete().eq('exam_id', id);
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (!error) {
      fetchExamsList();
      if (String(activeExamId) === String(id)) { setQuestions([]); setResults([]); setToken(''); setActiveExamId(null); }
    } else alert('Gagal menghapus token: ' + error.message);
  };

  const ubahPemilikUjian = async (examId, newGuruId) => {
    const { error } = await supabase.from('exams').update({ guru_id: newGuruId }).eq('id', examId);
    if (!error) { alert('Kepemilikan Ujian/Token berhasil dipindahkan ke Guru tersebut!'); fetchExamsList(); } else alert('Gagal memindahkan kepemilikan: ' + error.message);
  };

  const simpanSiswa = async (e) => {
    e.preventDefault();
    const payload = { name: namaSiswa, kelas: kelasSiswa, username: usernameSiswa, password: passwordSiswa, role: 'siswa' };
    if (isEditingSiswa) {
      const { error } = await supabase.from('users').update(payload).eq('id', editSiswaId);
      if (!error) { alert('Akun Siswa diperbarui!'); resetFormSiswa(); fetchUsers(); } else alert('Gagal update: ' + error.message);
    } else {
      const { error } = await supabase.from('users').insert([payload]);
      if (!error) { alert('Akun Siswa berhasil dibuat!'); resetFormSiswa(); fetchUsers(); } else alert('Gagal membuat akun: ' + error.message);
    }
  };

  const resetFormSiswa = () => { setNamaSiswa(''); setKelasSiswa(''); setUsernameSiswa(''); setPasswordSiswa(''); setIsEditingSiswa(false); setEditSiswaId(null); };

  const handleEditSiswaClick = (s) => {
    setNamaSiswa(s.name); setKelasSiswa(s.kelas || ''); setUsernameSiswa(s.username); setPasswordSiswa(s.password); setIsEditingSiswa(true); setEditSiswaId(s.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const simpanGuru = async (e) => {
    e.preventDefault();
    const payload = { name: namaGuru, kelas: mapelGuru, username: usernameGuru, password: passwordGuru, role: 'guru' };
    if (isEditingGuru) {
      const { error } = await supabase.from('users').update(payload).eq('id', editGuruId);
      if (!error) { alert('Akun Guru diperbarui!'); resetFormGuru(); fetchUsers(); } else alert('Gagal update: ' + error.message);
    } else {
      const { error } = await supabase.from('users').insert([payload]);
      if (!error) { alert('Akun Guru berhasil dibuat!'); resetFormGuru(); fetchUsers(); } else alert('Gagal membuat akun: ' + error.message);
    }
  };

  const resetFormGuru = () => { setNamaGuru(''); setMapelGuru(''); setUsernameGuru(''); setPasswordGuru(''); setIsEditingGuru(false); setEditGuruId(null); };

  const handleEditGuruClick = (g) => {
    setNamaGuru(g.name); setMapelGuru(g.kelas || ''); setUsernameGuru(g.username); setPasswordGuru(g.password); setIsEditingGuru(true); setEditGuruId(g.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hapusUser = async (id, roleName) => {
    if(!window.confirm(`Yakin hapus akun ${roleName} ini?`)) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if(!error) fetchUsers();
  };

  // FUNGSI EKSPOR LAPORAN KESELURUHAN (KLASIKAL) KE WORD
  const unduhLaporanKlasikalWord = () => {
    if (results.length === 0) return alert('Belum ada data nilai.');
    const curExam = exams.find(e => String(e.id) === String(activeExamId));
    
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Laporan Hasil Ujian</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid black; padding: 5px; text-align: left; }
        th { background-color: #f2f2f2; text-align: center; }
        .text-center { text-align: center; }
      </style></head><body>
      <h2 class="text-center">LAPORAN HASIL UJIAN CBT</h2>
      <p><b>Mata Pelajaran:</b> ${curExam?.title || '-'}<br/><b>Total Siswa:</b> ${results.length}</p>
      
      <h3>A. Daftar Nilai Siswa</h3>
      <table>
        <tr><th width="5%">No</th><th width="45%">Nama Siswa</th><th width="30%">Kelas</th><th width="20%">Nilai (Skala 100)</th></tr>`;
    
    results.forEach((r, idx) => {
      html += `<tr><td class="text-center">${idx + 1}</td><td>${r.users?.name}</td><td class="text-center">${r.users?.kelas || '-'}</td><td class="text-center"><b>${r.score}</b></td></tr>`;
    });
    
    html += `</table><br/><br/><h3>B. Analisis Butir Soal (Klasikal)</h3><table>
      <tr><th>No. Soal</th><th>Tipe Soal</th><th>Bobot</th><th>Benar Penuh</th><th>Benar Parsial</th><th>Salah</th><th>Kosong</th></tr>`;
    
    questions.forEach((q, idx) => {
      let benarPenuh = 0; let benarParsial = 0; let salah = 0; let kosong = 0;
      const maxScore = parseInt(q.bobot) || 1;

      results.forEach(res => {
        const studentAns = res.answers[q.id];
        let obtainedScore = 0;
        
        const isAnsEmptyArray = Array.isArray(studentAns) && studentAns.length === 0;
        const isAnsEmptyObj = typeof studentAns === 'object' && studentAns !== null && Object.keys(studentAns).length === 0;
        
        if (!studentAns || isAnsEmptyArray || isAnsEmptyObj) { 
          kosong++; 
        } else {
          if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
          else if (q.type === 'PGK') {
            const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[];
            let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; });
            let ratio = (c - w) / cA.length; if (ratio < 0) ratio = 0;
            obtainedScore = ratio * maxScore;
          }
          else if (q.type === 'BS') {
            const aO = studentAns || {}; let c = 0;
            q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; });
            obtainedScore = (c / q.correct_answer.length) * maxScore;
          }
          else if (q.type === 'IS') { if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
          else if (q.type === 'M') {
            const aM = studentAns || {}; let c = 0;
            q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; });
            obtainedScore = (c / q.correct_answer.length) * maxScore;
          }
          
          if (q.type === 'U') { 
             kosong++; 
          } else {
             if (obtainedScore >= maxScore * 0.99) benarPenuh++;
             else if (obtainedScore > 0) benarParsial++;
             else salah++;
          }
        }
      });

      const bp = q.type === 'U' ? '-' : benarPenuh;
      const bpar = q.type === 'U' ? '-' : benarParsial;
      const s = q.type === 'U' ? 'Cek Manual' : salah;
      html += `<tr><td class="text-center">${idx + 1}</td><td class="text-center">${q.type}</td><td class="text-center">${maxScore}</td><td class="text-center">${bp}</td><td class="text-center">${bpar}</td><td class="text-center">${s}</td><td class="text-center">${kosong}</td></tr>`;
    });

    html += `</table></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `Laporan_Ujian_${curExam?.title}.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // FUNGSI EKSPOR ANALISIS INDIVIDU (BAHAN REMEDIAL) KE WORD
  const unduhAnalisisIndividuWord = (res) => {
    const curExam = exams.find(e => String(e.id) === String(activeExamId));
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Analisis Hasil Ujian</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 12px; }
        .box { border: 1px solid black; padding: 10px; margin-bottom: 15px; }
        .correct { color: green; font-weight: bold; }
        .partial { color: #b45309; font-weight: bold; }
        .wrong { color: red; font-weight: bold; }
      </style></head><body>
      <h2 style="text-align:center;">LEMBAR HASIL UJIAN & EVALUASI SISWA</h2>
      <p><b>Nama Siswa:</b> ${res.users?.name}<br/><b>Kelas:</b> ${res.users?.kelas || '-'}<br/>
      <b>Mata Pelajaran:</b> ${curExam?.title || '-'}<br/><b>Nilai Akhir:</b> <span style="font-size:16px; font-weight:bold;">${res.score}</span></p>
      <hr/><h3>Rincian Jawaban:</h3>`;

    questions.forEach((q, idx) => {
      const studentAns = res.answers[q.id];
      const maxScore = parseInt(q.bobot) || 1;
      let obtainedScore = 0;
      let displayStudentAns = studentAns;

      const isAnsEmptyArray = Array.isArray(studentAns) && studentAns.length === 0;
      const isAnsEmptyObj = typeof studentAns === 'object' && studentAns !== null && Object.keys(studentAns).length === 0;
      
      if (studentAns && !isAnsEmptyArray && !isAnsEmptyObj) {
        if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
        else if (q.type === 'PGK') {
          const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[];
          let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; });
          let ratio = (c - w) / cA.length; if (ratio < 0) ratio = 0;
          obtainedScore = ratio * maxScore;
          displayStudentAns = aA.join(', ');
        }
        else if (q.type === 'BS') {
          const aO = studentAns || {}; let c = 0;
          q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; });
          obtainedScore = (c / q.correct_answer.length) * maxScore;
          displayStudentAns = q.options.map((opt, i) => `${opt} (${aO[i] || '-'})`).join(', ');
        }
        else if (q.type === 'IS') { 
          if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; 
        }
        else if (q.type === 'M') {
          const aM = studentAns || {}; let c = 0;
          q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; });
          obtainedScore = (c / q.correct_answer.length) * maxScore;
          displayStudentAns = q.options.map((opt, i) => `${opt} ➜ ${aM[i] || '-'}`).join(' | ');
        }
      }

      const scoreText = Number(obtainedScore.toFixed(2));
      let statusHtml = "";

      if (q.type === 'U') {
        statusHtml = `<b>[MENUNGGU KOREKSI GURU]</b>`;
      } else if (!studentAns || isAnsEmptyArray || isAnsEmptyObj) {
        statusHtml = `<span class="wrong">[KOSONG - SKOR: 0 / ${maxScore}]</span>`;
      } else if (obtainedScore >= maxScore * 0.99) {
        statusHtml = `<span class="correct">[BENAR - SKOR: ${maxScore} / ${maxScore}]</span>`;
      } else if (obtainedScore > 0) {
        statusHtml = `<span class="partial">[PARSIAL - SKOR: ${scoreText} / ${maxScore}]</span>`;
      } else {
        statusHtml = `<span class="wrong">[SALAH - SKOR: 0 / ${maxScore}]</span>`;
      }

      let keyStr = "";
      if (q.type === 'BS') keyStr = q.options.map((opt, i) => `${opt} (${q.correct_answer[i]})`).join(', ');
      else if (q.type === 'M') keyStr = q.options.map((opt, i) => `${opt} ➜ ${q.correct_answer[i]}`).join(' | ');
      else if (Array.isArray(q.correct_answer)) keyStr = q.correct_answer.join(', ');
      else keyStr = q.correct_answer;

      html += `<div class="box">
        <p><b>Soal No. ${idx + 1}</b> (Tipe: ${q.type}) ${statusHtml}</p>
        <div>${q.content}</div>
        <p><b>Jawaban Siswa:</b> ${displayStudentAns || '<i>Tidak dijawab</i>'}</p>
        <p><b>Kunci Jawaban:</b> ${keyStr}</p>
      </div>`;
    });

    html += `</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `Hasil_Ujian_${res.users?.name}.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const unduhTemplateCSV = () => {
    const isiCSV = "Nama Lengkap,Kelas,Username,Password\nBudi Santoso,XII IPA 1,siswa01,123456\nSiti Aminah,XII IPA 2,siswa02,123456";
    const blob = new Blob([isiCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Template_Akun_Siswa.csv'; a.click(); window.URL.revokeObjectURL(url);
  };

  const handleUploadCSV = (e) => {
    const file = e.target.files[0]; if (!file) return; setIsUploadingCSV(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result; const rows = text.split('\n').filter(row => row.trim() !== '');
      let startIndex = 0; if (rows[0].toLowerCase().includes('nama') || rows[0].toLowerCase().includes('username')) startIndex = 1;
      const newStudents = [];
      for (let i = startIndex; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length >= 4) newStudents.push({ name: cols[0].trim(), kelas: cols[1].trim(), username: cols[2].trim(), password: cols[3].trim(), role: 'siswa' });
      }
      if (newStudents.length > 0) {
        const { error } = await supabase.from('users').insert(newStudents);
        if (!error) { alert(`Berhasil mengunggah ${newStudents.length} akun siswa secara massal!`); fetchUsers(); } else alert('Gagal menyimpan data: ' + error.message);
      } else alert('Format CSV salah atau kosong.');
      setIsUploadingCSV(false); e.target.value = null;
    };
    reader.readAsText(file);
  };

  // CETAK KARTU BERDASARKAN FILTER KELAS
  const unduhKartuWord = () => {
    if (filteredStudents.length === 0) return alert('Belum ada data siswa untuk dicetak.');
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Kartu Peserta Ujian</title><style>
        body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; }
        .card { border: 1.5px solid black; padding: 4px 6px; margin-bottom: 6px; width: 48%; float: left; margin-right: 2%; box-sizing: border-box; height: 130px; overflow: hidden; }
        .card:nth-child(even) { margin-right: 0; }
        .header { text-align: center; border-bottom: 1.5px solid black; padding-bottom: 2px; margin-bottom: 3px; font-weight: bold; font-size: 10.5px; line-height: 1.1; }
        table { width: 100%; font-size: 9px; border-collapse: collapse; line-height: 1; }
        td { padding: 0.5px 0; }
        .foto { border: 1px solid black; width: 32px; height: 42px; text-align: center; line-height: 42px; font-size: 8px; color: #555; background-color: #f9f9f9; }
        .ttd { text-align: center; font-size: 9px; vertical-align: bottom; }
        .clear { clear: both; } .page-break { page-break-before: always; clear: both; }
      </style></head><body>`;
    
    let body = `<div style='width: 100%;'>`;
    filteredStudents.forEach((s, idx) => {
       if (idx > 0 && idx % 10 === 0) body += `<div class="page-break"></div>`;
       body += `<div class="card"><div class="header">KARTU PESERTA UJIAN CBT<br/>SMAN 1 BATUDAA PANTAI</div>
         <table><tr><td width="55" style="font-weight:bold;">Nama</td><td>: ${s.name}</td></tr><tr><td style="font-weight:bold;">Kelas</td><td>: ${s.kelas || '-'}</td></tr>
         <tr><td style="font-weight:bold;">Username</td><td>: <b>${s.username}</b></td></tr><tr><td style="font-weight:bold;">Password</td><td>: <b>${s.password}</b></td></tr></table>
         <table style="margin-top: 3px;"><tr><td width="50%"><div class="foto">3x4</div></td><td width="50%" class="ttd">Panitia Ujian<br/><br/><br/>________________</td></tr></table></div>`;
       if ((idx + 1) % 2 === 0) body += "<div class='clear'></div>";
    });
    const footer = "</div></body></html>";
    const blob = new Blob(['\ufeff', header + body + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'Kartu_Ujian_10_Per_Halaman.doc'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const unduhTemplateSoalCSV = () => {
    const header = "Tipe,Pertanyaan,Opsi A / Pernyataan 1,Opsi B / Pernyataan 2,Opsi C / Pernyataan 3,Opsi D,Opsi E,Kunci Jawaban,Bobot\n";
    const rowPG = "PG,Ibukota Indonesia adalah?,Jakarta,Bandung,Surabaya,Medan,Bali,Jakarta,2\n";
    const rowPGK = "PGK,Pilih yang termasuk hewan mamalia!,Sapi,Ayam,Kambing,Kucing,Burung,Sapi;Kambing;Kucing,4\n";
    const rowBS = "BS,Jawab Benar atau Salah pernyataan ini:,Bumi itu bulat,Matahari terbit dari barat,Es itu panas,,,B;S;S,3\n";
    const rowIS = "IS,Siapakah penemu gaya gravitasi?,,,,,,Isaac Newton,2\n";
    const rowU = "U,Sebutkan ciri-ciri makhluk hidup!,,,,,,Bernapas berkembang biak tumbuh dll,5";
    const blob = new Blob([header + rowPG + rowPGK + rowBS + rowIS + rowU], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Template_Bank_Soal.csv'; a.click(); window.URL.revokeObjectURL(url);
  };

  const handleUploadSoalCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!activeExamId) { alert("Pilih token ujian terlebih dahulu!"); e.target.value = null; return; }
    setIsUploadingSoalCSV(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result; const rows = text.split('\n').filter(row => row.trim() !== '');
      let startIndex = 0; if (rows[0].toLowerCase().includes('tipe') || rows[0].toLowerCase().includes('pertanyaan')) startIndex = 1;
      const newQuestions = [];
      for (let i = startIndex; i < rows.length; i++) {
        const rawCols = rows[i].split(',').map(col => col.replace(/^"(.*)"$/, '$1').trim());
        if (rawCols.length >= 8) {
          const tipe = rawCols[0].toUpperCase(); const pertanyaan = rawCols[1];
          const opsiA = rawCols[2]; const opsiB = rawCols[3]; const opsiC = rawCols[4]; const opsiD = rawCols[5] || ''; const opsiE = rawCols[6] || '';
          const kunciRaw = rawCols[7];
          const bobotRaw = parseInt(rawCols[8]); const bobot = isNaN(bobotRaw) ? 1 : bobotRaw;

          let options = []; let correct_answer = null;
          if (tipe === 'PG') { options = [opsiA, opsiB, opsiC, opsiD, opsiE].filter(o => o !== ''); correct_answer = kunciRaw; } 
          else if (tipe === 'PGK') { options = [opsiA, opsiB, opsiC, opsiD, opsiE].filter(o => o !== ''); correct_answer = kunciRaw.split(';').map(k => k.trim()); } 
          else if (tipe === 'BS') { options = [opsiA, opsiB, opsiC].filter(o => o !== ''); correct_answer = kunciRaw.split(';').map(k => k.trim().toUpperCase()); }
          else if (tipe === 'IS' || tipe === 'U') { options = []; correct_answer = kunciRaw; }

          if ((tipe === 'PG' || tipe === 'PGK' || tipe === 'BS' || tipe === 'IS' || tipe === 'U') && pertanyaan) {
            newQuestions.push({ exam_id: activeExamId, type: tipe, content: `<p>${pertanyaan}</p>`, options: options, correct_answer: correct_answer, bobot: bobot });
          }
        }
      }
      if (newQuestions.length > 0) {
        const { error } = await supabase.from('questions').insert(newQuestions);
        if (!error) { alert(`Berhasil mengunggah ${newQuestions.length} soal massal!`); changeActiveExam(activeExamId, token); }
        else alert('Gagal menyimpan soal: ' + error.message);
      } else alert('Gagal memproses file CSV.');
      setIsUploadingSoalCSV(false); e.target.value = null;
    };
    reader.readAsText(file);
  };

  const hapusHasilUjian = async (resultId, nama) => {
    if(!window.confirm(`Hapus hasil ujian atas nama "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    const { error } = await supabase.from('exam_results').delete().eq('id', resultId);
    if (!error) { setResults(results.filter(r => r.id !== resultId)); } else alert('Gagal menghapus hasil: ' + error.message);
  };

  const handleSmartPaste = (e, currentIdx, setOpsiArray, currentOpsi) => {
    const pasteText = e.clipboardData.getData('text');
    if (pasteText.includes('\n')) {
      e.preventDefault();
      const lines = pasteText.split('\n').map(line => line.replace(/^[A-Ea-e][.)]\s*/, '').trim()).filter(line => line !== '');
      const newOpsi = [...currentOpsi];
      for (let i = 0; i < lines.length && (currentIdx + i) < newOpsi.length; i++) newOpsi[currentIdx + i] = lines[i];
      setOpsiArray(newOpsi);
    }
  };

  const resetForm = () => {
    setTipeSoal('PG'); setBobotSoal(1); setSoalText(''); 
    setOpsiPG(['', '', '', '', '']); setKunciPG(0);
    setOpsiPGK(['', '', '', '', '']); setKunciPGK([]); 
    setOpsiBS(['', '', '']); setKunciBS(['B', 'B', 'B']);
    setKunciIS(''); setKunciU(''); setPasanganM([{kiri: '', kanan: ''}, {kiri: '', kanan: ''}]);
    setIsEditing(false); setEditQuestionId(null);
  };

  const handleSimpanSoal = async (e) => {
    e.preventDefault();
    if (!activeExamId || !soalText) return alert('Pilih Token dan isikan soal terlebih dahulu!');
    let optionsToSave = [], answerToSave = null;

    if (tipeSoal === 'PG') { optionsToSave = opsiPG; answerToSave = opsiPG[kunciPG]; }
    else if (tipeSoal === 'PGK') {
      if (kunciPGK.length === 0 || kunciPGK.length > 3) return alert('Pilih maks 3 jawaban!');
      optionsToSave = opsiPGK; answerToSave = kunciPGK.map(idx => opsiPGK[idx]);
    } else if (tipeSoal === 'BS') { optionsToSave = opsiBS; answerToSave = kunciBS; }
    else if (tipeSoal === 'IS') { optionsToSave = []; answerToSave = kunciIS; }
    else if (tipeSoal === 'U') { optionsToSave = []; answerToSave = kunciU; }
    else if (tipeSoal === 'M') { optionsToSave = pasanganM.map(p => p.kiri); answerToSave = pasanganM.map(p => p.kanan); }

    const payload = { 
      exam_id: activeExamId, type: tipeSoal, content: soalText, 
      options: optionsToSave, correct_answer: answerToSave, bobot: parseInt(bobotSoal) || 1 
    };

    if (isEditing) {
      const { error } = await supabase.from('questions').update(payload).eq('id', editQuestionId);
      if (!error) { alert('Soal diperbarui!'); resetForm(); changeActiveExam(activeExamId, token); }
    } else {
      const { error } = await supabase.from('questions').insert([payload]);
      if (!error) { alert('Soal ditambahkan!'); resetForm(); changeActiveExam(activeExamId, token); }
    }
  };

  const handleEditClick = (q) => {
    setTipeSoal(q.type); setBobotSoal(q.bobot || 1); setSoalText(q.content); setIsEditing(true); setEditQuestionId(q.id);
    if (q.type === 'PG') { setOpsiPG(q.options); setKunciPG(q.options.indexOf(q.correct_answer)); }
    else if (q.type === 'PGK') { setOpsiPGK(q.options); setKunciPGK(q.correct_answer.map(ans => q.options.indexOf(ans))); }
    else if (q.type === 'BS') { setOpsiBS(q.options); setKunciBS(q.correct_answer); }
    else if (q.type === 'IS') { setKunciIS(q.correct_answer); }
    else if (q.type === 'U') { setKunciU(q.correct_answer); }
    else if (q.type === 'M') {
      const pairs = q.options.map((opt, i) => ({ kiri: opt, kanan: q.correct_answer[i] }));
      setPasanganM(pairs);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHapusSoal = async (id) => {
    if (window.confirm('Hapus soal ini?')) {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (!error) changeActiveExam(activeExamId, token);
    }
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-center md:justify-start gap-2 p-3 rounded text-sm md:text-base ${activeTab === id ? 'bg-blue-700 font-bold' : 'hover:bg-blue-800'}`}>
      <Icon size={18}/> <span className="hidden md:inline">{label}</span><span className="md:hidden text-xs">{label.split(' ')[0]}</span>
    </button>
  );

  if (isPrintingCards) {
    return (
      <div className="bg-gray-100 min-h-screen text-black print:bg-white">
        <div className="print:hidden p-4 bg-white flex justify-between items-center shadow-md mb-6 sticky top-0 z-50 border-t-4 border-blue-600">
          <div><h2 className="text-xl font-bold text-gray-800">Pratinjau Cetak Kartu ({filteredStudents.length} Siswa)</h2></div>
          <div className="flex gap-3">
             <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Print / PDF</button>
             <button onClick={() => setIsPrintingCards(false)} className="px-6 py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700 flex items-center gap-2"><X size={18}/> Tutup</button>
          </div>
        </div>
        <div className="p-4 print:p-0 print:m-0 w-full max-w-[210mm] mx-auto bg-white print:bg-transparent shadow-lg print:shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 print:gap-2">
            {filteredStudents.map((s, idx) => (
               <div key={s.id} className="border-2 border-black p-2 bg-white break-inside-avoid shadow-sm print:shadow-none h-[54mm] flex flex-col justify-between">
                  <div>
                    <div className="text-center font-bold text-[9px] md:text-[10px] border-b border-black pb-1 mb-1 leading-none uppercase">KARTU PESERTA UJIAN CBT<br/>SMAN 1 BATUDAA PANTAI</div>
                    <table className="w-full text-[8.5px] md:text-[9px] leading-none mb-1">
                      <tbody>
                        <tr><td className="w-14 font-bold p-0">Nama</td><td className="p-0 truncate">: {s.name}</td></tr>
                        <tr><td className="font-bold p-0">Kelas</td><td className="p-0 truncate">: {s.kelas || '-'}</td></tr>
                        <tr><td className="font-bold p-0">Username</td><td className="font-mono font-bold text-blue-800 print:text-black p-0 truncate">: {s.username}</td></tr>
                        <tr><td className="font-bold p-0">Password</td><td className="font-mono font-bold text-red-700 print:text-black p-0 truncate">: {s.password}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-end mt-auto">
                     <div className="w-8 h-10 border border-gray-400 flex items-center justify-center text-[7px] text-gray-500 font-bold bg-gray-50">3x4</div>
                     <div className="text-center text-[8px] md:text-[9px] font-bold leading-tight">Panitia Ujian<br/><br/><br/>__________________</div>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100 font-sans print:bg-white">
      {/* SIDEBAR ADMIN */}
      <div className="w-full md:w-64 bg-blue-900 text-white p-4 md:p-6 shrink-0 flex flex-col md:h-screen md:sticky top-0 z-20 shadow-md print:hidden">
        <div className="flex justify-between items-center mb-0 md:mb-8">
          <div><h1 className="text-xl md:text-2xl font-bold">Portal Guru</h1><p className="text-xs text-blue-300 font-medium">Masuk: {loggedInUser.name} {loggedInUser.role === 'admin' ? '(Admin)' : ''}</p></div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-white bg-blue-800 rounded">{isMobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}</button>
        </div>
        <nav className={`${isMobileMenuOpen ? 'grid' : 'hidden'} ${loggedInUser.role === 'admin' ? 'grid-cols-5' : 'grid-cols-2'} md:grid-cols-1 gap-1 mt-4 md:mt-0 md:flex md:flex-col md:space-y-2 flex-1 transition-all`}>
          <NavItem id="hasil" icon={Users} label="Hasil Ujian" />
          <NavItem id="soal" icon={PlusCircle} label="Bank Soal" />
          {loggedInUser.role === 'admin' && ( 
            <>
              <NavItem id="ujian" icon={FileText} label="Manajemen Ujian" />
              <NavItem id="siswa" icon={UserPlus} label="Akun Siswa" />
              <NavItem id="guru" icon={ShieldCheck} label="Akun Guru" />
            </> 
          )}
        </nav>
        <div className="mt-4 md:mt-auto pt-4 border-t border-blue-700">
          <button onClick={() => { localStorage.removeItem('user'); navigate('/'); }} className="w-full p-3 bg-red-600 rounded-lg hover:bg-red-700 font-bold flex items-center justify-center gap-2 shadow-lg transition-colors mt-2"><LogOut size={20}/> LOGOUT</button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto print:p-0 print:overflow-visible">
        
        {/* === TAB HASIL === */}
        {activeTab === 'hasil' && (
          <div className="space-y-6 print:space-y-0">
            <div className="bg-white p-4 md:p-6 rounded-lg shadow print:shadow-none print:p-0">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-100 pb-4 print:hidden">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 border-l-4 border-blue-600 pl-3">Hasil Ujian</h2>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select value={activeExamId ? String(activeExamId) : ''} onChange={(e) => { const s = exams.find(x => String(x.id) === e.target.value); if (s) changeActiveExam(s.id, s.token); }} className="p-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 font-bold cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 shadow-sm flex-1 md:flex-none">
                    {exams.length === 0 && <option value="">Belum ada ujian</option>}
                    {exams.map(ex => (<option key={ex.id} value={String(ex.id)}>{ex.title} ({ex.token})</option>))}
                  </select>
                  <button onClick={() => changeActiveExam(activeExamId, token)} className="px-3 py-2 bg-gray-200 text-gray-800 rounded font-bold hover:bg-gray-300 text-sm">Refresh</button>
                  <button onClick={() => setShowAnalisisKelas(!showAnalisisKelas)} className="px-3 py-2 bg-purple-100 text-purple-800 rounded font-bold hover:bg-purple-200 flex items-center gap-1 text-sm"><BarChart2 size={16}/> Analisis Klasikal</button>
                  
                  <button onClick={() => window.print()} className="px-3 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 flex items-center gap-1 text-sm"><Printer size={16}/> Cetak PDF</button>
                  <button onClick={unduhLaporanKlasikalWord} className="px-3 py-2 bg-blue-800 text-white rounded font-bold hover:bg-blue-900 flex items-center gap-1 text-sm"><FileText size={16}/> Ekspor Word</button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-6">
                 <h2 className="text-2xl font-bold">LAPORAN HASIL UJIAN CBT</h2>
                 <p className="text-lg">Mata Pelajaran: {exams.find(e => String(e.id) === String(activeExamId))?.title || '-'}</p>
                 <hr className="border-black mt-2"/>
              </div>
              
              {showAnalisisKelas && (
                <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-xl print:border-none print:p-0 print:bg-transparent print:mb-4">
                  <h3 className="text-xl font-bold text-purple-900 mb-6 border-b border-purple-200 pb-2 print:text-black">A. Analisis Butir Soal Keseluruhan (Total Peserta: {results.length})</h3>
                  {results.length === 0 ? (<p className="text-gray-500 italic">Belum ada siswa yang mengerjakan ujian ini.</p>) : (
                    <div className="space-y-6 print:space-y-4">
                      {questions.map((q, idx) => {
                        let benarPenuh = 0; let benarParsial = 0; let salah = 0; let kosong = 0;
                        const maxScore = parseInt(q.bobot) || 1;

                        results.forEach(res => {
                          const studentAns = res.answers[q.id];
                          let obtainedScore = 0;
                          
                          const isAnsEmptyArray = Array.isArray(studentAns) && studentAns.length === 0;
                          const isAnsEmptyObj = typeof studentAns === 'object' && studentAns !== null && Object.keys(studentAns).length === 0;
                          
                          if (!studentAns || isAnsEmptyArray || isAnsEmptyObj) { 
                            kosong++; 
                          } else {
                            if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
                            else if (q.type === 'PGK') {
                              const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[];
                              let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; });
                              let ratio = (c - w) / cA.length; if (ratio < 0) ratio = 0;
                              obtainedScore = ratio * maxScore;
                            }
                            else if (q.type === 'BS') {
                              const aO = studentAns || {}; let c = 0;
                              q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; });
                              obtainedScore = (c / q.correct_answer.length) * maxScore;
                            }
                            else if (q.type === 'IS') { if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; }
                            else if (q.type === 'M') {
                              const aM = studentAns || {}; let c = 0;
                              q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; });
                              obtainedScore = (c / q.correct_answer.length) * maxScore;
                            }
                            
                            if (q.type === 'U') { 
                               kosong++; 
                            } else {
                               if (obtainedScore >= maxScore * 0.99) benarPenuh++;
                               else if (obtainedScore > 0) benarParsial++;
                               else salah++;
                            }
                          }
                        });

                        const totalSiswa = results.length;
                        const persenBenarPenuh = totalSiswa ? Math.round((benarPenuh / totalSiswa) * 100) : 0;
                        const persenBenarParsial = totalSiswa ? Math.round((benarParsial / totalSiswa) * 100) : 0;
                        const persenSalah = totalSiswa ? Math.round((salah / totalSiswa) * 100) : 0;
                        
                        let persenKosong = totalSiswa ? (100 - persenBenarPenuh - persenBenarParsial - persenSalah) : 0;
                        if (persenKosong < 0) persenKosong = 0;

                        const p1 = persenBenarPenuh;
                        const p2 = p1 + persenBenarParsial;
                        const p3 = p2 + persenSalah;
                        const conicGradient = `conic-gradient(#22c55e 0% ${p1}%, #eab308 ${p1}% ${p2}%, #ef4444 ${p2}% ${p3}%, #9ca3af ${p3}% 100%)`;

                        return (
                          <div key={q.id} className="p-5 bg-white border rounded-xl shadow-sm print:shadow-none print:border-black print:break-inside-avoid">
                            <div className="flex justify-between items-center mb-4 border-b pb-3 print:border-black">
                              <span className="font-bold text-lg print:text-base">Soal No. {idx + 1} <span className="text-sm font-normal text-gray-500 print:text-gray-800">({q.type} - Bobot: {maxScore})</span></span>
                              <span className={`text-xs font-bold px-3 py-1 rounded-full print:border print:border-black ${q.type === 'U' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>{q.type === 'U' ? 'Manual Check' : 'Auto-Grade'}</span>
                            </div>
                            
                            {q.type === 'U' ? (
                              <div className="text-gray-500 italic p-4 bg-gray-50 rounded text-center print:border print:border-gray-300">
                                Soal uraian dinilai secara manual oleh guru. Diagram klasikal otomatis tidak tersedia untuk soal ini.
                              </div>
                            ) : (
                              <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex-1 w-full">
                                  <div className="prose max-w-none text-sm md:text-base text-gray-700 print:text-black" dangerouslySetInnerHTML={{ __html: q.content }} />
                                </div>
                                <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100 w-full md:w-auto shrink-0 print:border-black print:bg-transparent">
                                   <div className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center shadow-md shrink-0 relative print:shadow-none print:border print:border-gray-200" style={{ background: conicGradient }}>
                                      <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-full flex items-center justify-center shadow-inner absolute print:bg-white print:border print:border-gray-300">
                                         <span className="text-xs md:text-sm font-bold text-gray-500 print:text-black">{totalSiswa} Siswa</span>
                                      </div>
                                   </div>
                                   <div className="flex flex-col gap-2 text-xs md:text-sm font-bold">
                                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Benar: {benarPenuh} ({persenBenarPenuh}%)</span></div>
                                      {benarParsial > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Parsial: {benarParsial} ({persenBenarParsial}%)</span></div>}
                                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Salah: {salah} ({persenSalah}%)</span></div>
                                      {kosong > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400 print:border print:border-black"></div> <span className="text-gray-700 print:text-black">Kosong: {kosong} ({persenKosong}%)</span></div>}
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
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-200 print:border-black print:bg-transparent">
                      <th className="p-2 md:p-4 print:border print:border-black">Nama</th>
                      <th className="p-2 md:p-4 print:border print:border-black hidden md:table-cell">Kelas</th>
                      <th className="p-2 md:p-4 print:border print:border-black text-center">Nilai Auto-Grade</th>
                      <th className="p-2 md:p-4 text-right print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((res) => (
                      <tr key={res.id} className="border-b hover:bg-gray-50 transition-colors print:border-black">
                        <td className="p-2 md:p-4 font-semibold text-gray-800 print:border print:border-black print:text-black">{res.users?.name} <div className="text-xs text-gray-500 md:hidden">{res.users?.kelas}</div></td>
                        <td className="p-2 md:p-4 hidden md:table-cell text-gray-600 print:border print:border-black print:text-black">{res.users?.kelas || '-'}</td>
                        <td className="p-2 md:p-4 text-center font-bold text-xl md:text-2xl text-blue-600 print:border print:border-black print:text-black print:text-lg">{res.score}</td>
                        <td className="p-2 md:p-4 text-right flex justify-end gap-1 md:gap-2 items-center print:hidden">
                          <button onClick={() => setSelectedResult(res)} className="px-2 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 text-xs md:text-sm">Analisis Rinci</button>
                          <button onClick={() => hapusHasilUjian(res.id, res.users?.name)} className="p-1.5 md:p-2 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Hapus Hasil"><Trash2 size={16}/></button>
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

        {/* MODAL ANALISIS INDIVIDU */}
        {selectedResult && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[9999] print:absolute print:inset-0 print:bg-transparent print:p-0 print:block">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:w-full print:m-0">
              
              <div className="flex justify-between items-center mb-6 border-b pb-4 print:hidden">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Evaluasi: {selectedResult.users?.name}</h2>
                <div className="flex gap-2 items-center">
                  <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white font-bold rounded shadow hover:bg-green-700 flex items-center gap-2"><Printer size={16}/> Cetak</button>
                  <button onClick={() => unduhAnalisisIndividuWord(selectedResult)} className="px-4 py-2 bg-blue-800 text-white font-bold rounded shadow hover:bg-blue-900 flex items-center gap-2"><FileText size={16}/> Ekspor Word</button>
                  <button onClick={() => setSelectedResult(null)} className="ml-2 text-red-500 hover:bg-red-50 p-2 rounded-full font-bold"><X size={24}/></button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-6">
                 <h2 className="text-2xl font-bold">LEMBAR HASIL UJIAN & EVALUASI SISWA</h2>
                 <p className="text-lg">Mata Pelajaran: {exams.find(e => String(e.id) === String(activeExamId))?.title || '-'}</p>
                 <hr className="border-black my-4"/>
                 <table className="w-full text-left font-bold text-lg mb-6">
                   <tbody>
                     <tr><td width="20%">Nama Siswa</td><td>: {selectedResult.users?.name}</td><td rowSpan="2" className="text-right text-3xl">Nilai: {selectedResult.score}</td></tr>
                     <tr><td>Kelas</td><td>: {selectedResult.users?.kelas || '-'}</td></tr>
                   </tbody>
                 </table>
              </div>

              <div className="space-y-6 print:space-y-4">
                {questions.map((q, idx) => {
                  const studentAns = selectedResult.answers[q.id];
                  const maxScore = parseInt(q.bobot) || 1;
                  let obtainedScore = 0;
                  let displayStudentAns = studentAns;

                  const isAnsEmptyArray = Array.isArray(studentAns) && studentAns.length === 0;
                  const isAnsEmptyObj = typeof studentAns === 'object' && studentAns !== null && Object.keys(studentAns).length === 0;
                  
                  if (studentAns && !isAnsEmptyArray && !isAnsEmptyObj) {
                    if (q.type === 'PG') { if (studentAns === q.correct_answer) obtainedScore = maxScore; }
                    else if (q.type === 'PGK') {
                      const aA = Array.isArray(studentAns)?studentAns:[]; const cA = Array.isArray(q.correct_answer)?q.correct_answer:[];
                      let c = 0, w = 0; aA.forEach(v => { if (cA.includes(v)) c++; else w++; });
                      let ratio = (c - w) / cA.length; if (ratio < 0) ratio = 0;
                      obtainedScore = ratio * maxScore;
                      displayStudentAns = aA.join(', ');
                    }
                    else if (q.type === 'BS') {
                      const aO = studentAns || {}; let c = 0;
                      q.correct_answer.forEach((k, i) => { if (aO[i] === k) c++; });
                      obtainedScore = (c / q.correct_answer.length) * maxScore;
                      displayStudentAns = q.options.map((opt, i) => `${opt} (${aO[i] || '-'})`).join(', ');
                    }
                    else if (q.type === 'IS') { 
                      if (String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) obtainedScore = maxScore; 
                    }
                    else if (q.type === 'M') {
                      const aM = studentAns || {}; let c = 0;
                      q.correct_answer.forEach((k, i) => { if (aM[i] === k) c++; });
                      obtainedScore = (c / q.correct_answer.length) * maxScore;
                      displayStudentAns = q.options.map((opt, i) => `${opt} ➜ ${aM[i] || '-'}`).join(' | ');
                    }
                  }

                  const scoreText = Number(obtainedScore.toFixed(2));
                  let boxBorder = 'border-red-300 bg-red-50';
                  let statusIcon = <XCircle size={18} className="text-red-600 shrink-0 print:hidden"/>;
                  let badge = <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-300 print:text-black print:border-black">Skor: 0 / {maxScore}</span>;

                  if (q.type === 'U') {
                     boxBorder = 'border-blue-300 bg-blue-50';
                     statusIcon = <CheckCircle size={18} className="text-blue-600 shrink-0 print:hidden"/>;
                     badge = <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-300 print:text-black print:border-black">Menunggu Koreksi</span>;
                  } else if (!studentAns || isAnsEmptyArray || isAnsEmptyObj) {
                     badge = <span className="text-xs font-bold bg-gray-200 text-gray-800 px-2 py-0.5 rounded border border-gray-400 print:text-black print:border-black">Kosong (Skor: 0 / {maxScore})</span>;
                  } else if (obtainedScore >= maxScore * 0.99) {
                     boxBorder = 'border-green-300 bg-green-50';
                     statusIcon = <CheckCircle size={18} className="text-green-600 shrink-0 print:hidden"/>;
                     badge = <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-300 print:text-black print:border-black">Skor: {maxScore} / {maxScore} (Sempurna)</span>;
                  } else if (obtainedScore > 0) {
                     boxBorder = 'border-yellow-300 bg-yellow-50';
                     statusIcon = <AlertTriangle size={18} className="text-yellow-600 shrink-0 print:hidden"/>;
                     badge = <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-400 print:text-black print:border-black">Skor: {scoreText} / {maxScore} (Parsial)</span>;
                  }

                  let keyStr = "";
                  if (q.type === 'BS') keyStr = q.options.map((opt, i) => `${opt} (${q.correct_answer[i]})`).join(', ');
                  else if (q.type === 'M') keyStr = q.options.map((opt, i) => `${opt} ➜ ${q.correct_answer[i]}`).join('  |  ');
                  else if (Array.isArray(q.correct_answer)) keyStr = q.correct_answer.join(', ');
                  else keyStr = q.correct_answer;

                  return (
                    <div key={q.id} className={`p-4 md:p-5 border rounded-lg ${boxBorder} print:bg-transparent print:border-black print:break-inside-avoid`}>
                      <div className="flex gap-2 font-semibold text-gray-800 border-b pb-3 mb-3 print:border-black">
                        <span>{idx + 1}.</span>
                        <div className="w-full">
                          <div className="flex justify-between items-center w-full mb-2">
                            <span className="text-xs font-bold text-gray-500 print:text-black">Tipe: {q.type === 'U' ? 'URAIAN (Cek Manual)' : q.type}</span>
                            {badge}
                          </div>
                          <div className="prose max-w-none text-sm md:text-base print:text-black" dangerouslySetInnerHTML={{ __html: q.content }} />
                        </div>
                      </div>
                      <div className="text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-600 mb-1 font-bold print:text-black">Jawaban Siswa:</p>
                          <p className="font-medium flex items-start gap-2 print:text-black">
                            {statusIcon}
                            <span className="break-words font-bold">{displayStudentAns || 'Tidak dijawab'}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 mb-1 font-bold print:text-black">{q.type === 'U' ? 'Rubrik / Referensi Guru:' : 'Kunci Benar:'}</p>
                          <p className="font-medium text-blue-700 break-words print:text-black">
                            {keyStr}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* === TAB BANK SOAL === */}
        {activeTab === 'soal' && (
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 print:hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-5 md:p-6 rounded-lg shadow-sm border border-blue-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="w-full flex-1">
                  <label className="text-sm font-bold text-blue-800 block mb-2">Pilih Token & Kelola Soal:</label>
                  <select value={activeExamId ? String(activeExamId) : ''} onChange={(e) => { const s = exams.find(x => String(x.id) === e.target.value); if (s) changeActiveExam(s.id, s.token); }} className="w-full p-3 bg-white border-2 border-blue-300 rounded-lg text-blue-900 font-black text-lg cursor-pointer outline-none focus:border-blue-600 shadow-sm transition-colors">
                    {exams.length === 0 && <option value="">Minta Admin membuatkan Token Ujian</option>}
                    {exams.map(ex => (<option key={ex.id} value={String(ex.id)}>{ex.title} - Token: {ex.token}</option>))}
                  </select>
                  <p className="text-sm text-blue-800 mt-2">Total Soal Tersimpan: <strong>{questions.length}</strong> butir</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                  <label className="text-sm font-bold text-gray-700 whitespace-nowrap">Durasi Ujian:</label>
                  <div className="flex items-center border rounded overflow-hidden flex-1 md:flex-none">
                    <input type="number" min="10" className="w-16 md:w-20 p-2 text-center focus:outline-none font-bold text-blue-900" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} />
                    <span className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 border-l">Menit</span>
                  </div>
                  <button onClick={updateDurasiUjian} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 shadow">Update</button>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-lg shadow border-t-4 border-green-500">
              <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center gap-2"><Upload className="text-green-600"/> Upload Soal Teks via Excel (CSV)</h2>
              <div className="flex flex-col md:flex-row gap-3 mt-4">
                <button onClick={unduhTemplateSoalCSV} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-800 font-bold rounded hover:bg-green-200 transition-colors text-sm border border-green-300">
                  <Download size={16}/> Unduh Template CSV
                </button>
                <div className="flex-1 flex items-center bg-gray-50 border border-gray-300 rounded p-1">
                  <label className="w-full flex items-center justify-center gap-2 cursor-pointer bg-white px-4 py-2 rounded border border-dashed border-gray-400 hover:bg-gray-100">
                    <Upload size={16} className="text-gray-500"/>
                    <span className="text-sm font-bold text-gray-600">{isUploadingSoalCSV ? 'Memproses...' : 'Upload File CSV'}</span>
                    <input type="file" accept=".csv" onChange={handleUploadSoalCSV} disabled={isUploadingSoalCSV} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className={`bg-white p-5 md:p-6 rounded-lg shadow border-t-4 ${isEditing ? 'border-yellow-500' : 'border-blue-600'}`}>
              <div className="flex justify-between items-center mb-6 border-b pb-3">
                <h2 className="text-lg md:text-xl font-bold text-gray-800">{isEditing ? 'Edit Soal Terpilih' : 'Ketik Soal Manual (Teks & Gambar)'}</h2>
                {isEditing && <button type="button" onClick={resetForm} className="text-sm font-bold text-gray-500 hover:text-red-500 underline">Batal Edit</button>}
              </div>

              <form onSubmit={handleSimpanSoal} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold mb-2 text-sm md:text-base text-gray-700">Tipe Pertanyaan</label>
                    <select className="w-full p-2 md:p-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base bg-gray-50" value={tipeSoal} onChange={(e) => setTipeSoal(e.target.value)}>
                      <option value="PG">Pilihan Ganda (1 Jawaban)</option>
                      <option value="PGK">Pilihan Ganda Kompleks (Banyak Jawaban)</option>
                      <option value="BS">Benar / Salah (3 Pernyataan)</option>
                      <option value="IS">Isian Singkat / Teks Bebas</option>
                      <option value="M">Menjodohkan (Pasangan)</option>
                      <option value="U">Uraian / Essay (Manual Koreksi)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-sm md:text-base text-blue-800">Bobot Poin Soal Ini</label>
                    <input type="number" min="1" required className="w-full p-2 md:p-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base bg-blue-50 font-bold" value={bobotSoal} onChange={(e) => setBobotSoal(e.target.value)} placeholder="Contoh: 1, 2, atau 5"/>
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-2 text-sm md:text-base text-gray-700">Stimulus / Pertanyaan (Klik icon gambar untuk menyisipkan gambar)</label>
                  <div className="border-2 rounded-lg overflow-hidden"><JoditEditor ref={editor} value={soalText} config={editorConfig} onBlur={newContent => setSoalText(newContent)} /></div>
                </div>
                
                {tipeSoal === 'PG' && (
                  <div className="space-y-3 bg-gray-50 p-3 md:p-5 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                    <label className="block font-bold mb-3 text-blue-900 border-b pb-2">Ketik Opsi & Pilih 1 Kunci Jawaban</label>
                    {opsiPG.map((opsi, idx) => (
                      <div key={idx} className="flex gap-2 md:gap-3 items-center">
                        <input type="radio" name="kunciPG" checked={kunciPG === idx} onChange={() => setKunciPG(idx)} className="w-4 h-4 md:w-5 md:h-5 accent-blue-600 shrink-0 cursor-pointer"/>
                        <span className="font-black w-5 md:w-6 text-gray-700">{String.fromCharCode(65 + idx)}.</span>
                        <input required type="text" className="flex-1 p-3 border rounded-lg focus:border-blue-500 focus:outline-none" value={opsi} onPaste={(e) => handleSmartPaste(e, idx, setOpsiPG, opsiPG)} onChange={(e) => { const newOpsi = [...opsiPG]; newOpsi[idx] = e.target.value; setOpsiPG(newOpsi); }} placeholder="Ketik pilihan jawaban... (Bisa paste menurun)"/>
                      </div>
                    ))}
                  </div>
                )}
                
                {tipeSoal === 'PGK' && (
                  <div className="space-y-3 bg-gray-50 p-3 md:p-5 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                    <label className="block font-bold mb-3 text-blue-900 border-b pb-2">Ketik Opsi & Centang Semua Kunci (Maksimal 3)</label>
                    {opsiPGK.map((opsi, idx) => (
                      <div key={idx} className="flex gap-2 md:gap-3 items-center">
                        <input type="checkbox" checked={kunciPGK.includes(idx)} onChange={(e) => {
                          if (e.target.checked) { if (kunciPGK.length >= 3) return alert('Maks 3 Jawaban!'); setKunciPGK([...kunciPGK, idx]); } else setKunciPGK(kunciPGK.filter(i => i !== idx));
                        }} className="w-4 h-4 md:w-5 md:h-5 accent-blue-600 shrink-0 cursor-pointer"/>
                        <span className="font-black w-5 md:w-6 text-gray-700">{String.fromCharCode(65 + idx)}.</span>
                        <input required type="text" className="flex-1 p-3 border rounded-lg focus:border-blue-500 focus:outline-none" value={opsi} onPaste={(e) => handleSmartPaste(e, idx, setOpsiPGK, opsiPGK)} onChange={(e) => { const newOpsi = [...opsiPGK]; newOpsi[idx] = e.target.value; setOpsiPGK(newOpsi); }} placeholder="Ketik pilihan jawaban... (Bisa paste menurun)"/>
                      </div>
                    ))}
                  </div>
                )}
                
                {tipeSoal === 'BS' && (
                  <div className="space-y-4 bg-gray-50 p-3 md:p-5 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                    <label className="block font-bold mb-3 text-blue-900 border-b pb-2">Ketik 3 Pernyataan & Tentukan Kunci B/S-nya</label>
                    {opsiBS.map((opsi, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-2 md:gap-3 items-start md:items-center bg-white p-4 border rounded-lg shadow-sm">
                        <span className="font-black text-gray-700">{idx + 1}.</span>
                        <input required type="text" className="flex-1 p-3 border rounded-lg w-full focus:border-blue-500 focus:outline-none" value={opsi} onPaste={(e) => handleSmartPaste(e, idx, setOpsiBS, opsiBS)} onChange={(e) => { const newOpsi = [...opsiBS]; newOpsi[idx] = e.target.value; setOpsiBS(newOpsi); }} placeholder="Ketik pernyataan di sini..."/>
                        <div className="flex gap-4 justify-end w-full md:w-auto mt-2 md:mt-0">
                          <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="radio" checked={kunciBS[idx] === 'B'} onChange={() => { const newKunci = [...kunciBS]; newKunci[idx] = 'B'; setKunciBS(newKunci); }} className="w-4 h-4 md:w-5 md:h-5 accent-green-600"/> Benar</label>
                          <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="radio" checked={kunciBS[idx] === 'S'} onChange={() => { const newKunci = [...kunciBS]; newKunci[idx] = 'S'; setKunciBS(newKunci); }} className="w-4 h-4 md:w-5 md:h-5 accent-red-600"/> Salah</label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tipeSoal === 'IS' && (
                  <div className="space-y-3 bg-gray-50 p-3 md:p-5 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                    <label className="block font-bold mb-3 text-blue-900 border-b pb-2">Kunci Jawaban Singkat (Pastikan Ejaan Benar)</label>
                    <input required type="text" className="w-full p-3 border rounded-lg focus:border-blue-500 focus:outline-none" value={kunciIS} onChange={(e) => setKunciIS(e.target.value)} placeholder="Contoh: Jakarta"/>
                  </div>
                )}

                {tipeSoal === 'U' && (
                  <div className="space-y-3 bg-gray-50 p-3 md:p-5 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                    <label className="block font-bold mb-3 text-blue-900 border-b pb-2">Rubrik / Referensi Jawaban (Hanya untuk panduan Guru saat menilai)</label>
                    <textarea required rows={4} className="w-full p-3 border rounded-lg focus:border-blue-500 focus:outline-none" value={kunciU} onChange={(e) => setKunciU(e.target.value)} placeholder="Ketik panduan jawaban uraian di sini..."/>
                  </div>
                )}

                {tipeSoal === 'M' && (
                  <div className="space-y-4 bg-gray-50 p-3 md:p-5 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                    <label className="block font-bold mb-3 text-blue-900 border-b pb-2">Ketik Pasangan Menjodohkan (Premis Kiri ➜ Jawaban Kanan)</label>
                    {pasanganM.map((pair, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-2 md:gap-3 items-start md:items-center">
                        <span className="font-black text-gray-700">{idx + 1}.</span>
                        <input required type="text" className="flex-1 p-3 border rounded-lg w-full focus:border-blue-500" value={pair.kiri} onChange={(e) => { const newP = [...pasanganM]; newP[idx].kiri = e.target.value; setPasanganM(newP); }} placeholder="Ketik pernyataan/premis..."/>
                        <span className="font-bold text-gray-500">➜</span>
                        <input required type="text" className="flex-1 p-3 border rounded-lg w-full focus:border-blue-500" value={pair.kanan} onChange={(e) => { const newP = [...pasanganM]; newP[idx].kanan = e.target.value; setPasanganM(newP); }} placeholder="Ketik pasangan jawabannya..."/>
                        {pasanganM.length > 2 && (
                          <button type="button" onClick={() => setPasanganM(pasanganM.filter((_, i) => i !== idx))} className="p-2 text-red-600 hover:bg-red-100 rounded" title="Hapus Pasangan"><Trash2 size={18}/></button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setPasanganM([...pasanganM, {kiri:'', kanan:''}])} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 font-bold rounded hover:bg-blue-200 text-sm"><PlusCircle size={16}/> Tambah Pasangan</button>
                  </div>
                )}

                <button type="submit" className={`w-full text-white font-bold py-4 rounded-lg shadow-lg ${isEditing ? 'bg-yellow-500 text-yellow-900 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} text-lg`}>
                  {isEditing ? 'SIMPAN PERUBAHAN SOAL' : 'SIMPAN SOAL KE DATABASE'}
                </button>
              </form>
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-lg shadow">
              <h2 className="text-lg md:text-xl font-bold mb-4 border-b pb-2">Daftar Soal Tersimpan ({questions.length})</h2>
              {questions.length === 0 ? <p className="text-center py-8 text-gray-500 font-medium">Belum ada soal untuk mata pelajaran ini.</p> : (
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="p-4 border-2 border-gray-100 rounded-lg bg-gray-50 hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-start mb-3 border-b border-gray-200 pb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-lg text-gray-800">No. {idx + 1}</span>
                          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">{q.type}</span>
                          <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded">Bobot: {q.bobot || 1}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditClick(q)} className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Edit Soal"><Edit size={18}/></button>
                          <button onClick={() => handleHapusSoal(q.id)} className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors" title="Hapus Soal"><Trash2 size={18}/></button>
                        </div>
                      </div>
                      <div className="prose max-w-none text-sm text-gray-700 bg-white p-4 border rounded shadow-sm overflow-x-auto" dangerouslySetInnerHTML={{ __html: q.content }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === TAB UJIAN (HANYA ADMIN) === */}
        {loggedInUser.role === 'admin' && activeTab === 'ujian' && (
          <div className="space-y-6 print:hidden">
            <div className={`bg-white p-5 md:p-6 rounded-lg shadow max-w-2xl border-t-4 ${isEditingExam ? 'border-yellow-500' : 'border-blue-600'}`}>
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h2 className="text-xl font-bold">{isEditingExam ? 'Edit Data Ujian' : 'Generasi Token Ujian Baru'}</h2>
                {isEditingExam && <button type="button" onClick={batalkanEditUjian} className="text-sm font-bold text-gray-500 hover:text-red-500 underline">Batal Edit</button>}
              </div>
              <form onSubmit={simpanUjian} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mata Pelajaran (Judul Ujian)</label>
                  <input required type="text" className="w-full p-3 border rounded-lg focus:border-blue-500 focus:outline-none bg-gray-50 focus:bg-white transition-colors" placeholder="Contoh: Sumatif Akhir Semester - Bahasa Indonesia" value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Guru Pengampu <span className="text-red-500">*</span></label>
                    <select required className="w-full p-3 border rounded-lg focus:border-blue-500 focus:outline-none bg-gray-50 focus:bg-white cursor-pointer" value={newExamGuruId} onChange={(e) => setNewExamGuruId(e.target.value)}>
                      <option value="">-- Pilih Guru --</option>
                      <option value={loggedInUser.id}>Admin / Saya Sendiri</option>
                      {teachers.filter(t => t.role === 'guru').map(t => <option key={t.id} value={String(t.id)}>{t.name} ({t.kelas})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Durasi Ujian</label>
                    <div className="flex items-center w-full border rounded-lg overflow-hidden bg-gray-50 focus-within:bg-white focus-within:border-blue-500">
                      <input required type="number" min="10" className="flex-1 p-3 focus:outline-none bg-transparent" value={newExamDuration} onChange={(e) => setNewExamDuration(e.target.value)} />
                      <span className="bg-gray-100 px-4 py-3 font-bold text-gray-600 border-l">Menit</span>
                    </div>
                  </div>
                </div>
                <button type="submit" className={`w-full py-4 font-black text-white rounded-lg shadow-lg transition-colors text-lg mt-4 ${isEditingExam ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isEditingExam ? 'SIMPAN PERUBAHAN UJIAN' : 'GENERATE TOKEN UJIAN BARU'}
                </button>
              </form>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-lg shadow overflow-x-auto">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Daftar Seluruh Ujian/Token Sekolah ({exams.length})</h2>
              <table className="w-full text-left border-collapse text-sm md:text-base">
                <thead><tr className="bg-gray-100 border-b"><th className="p-2 md:p-3">Mata Pelajaran</th><th className="p-2 md:p-3">Token</th><th className="p-2 md:p-3">Ubah Guru Pengampu (Pemilik)</th><th className="p-2 md:p-3 text-right">Aksi</th></tr></thead>
                <tbody>
                  {exams.map(ex => (
                    <tr key={ex.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 md:p-3 font-semibold text-gray-800">{ex.title}</td>
                      <td className="p-2 md:p-3 font-mono font-black text-blue-700 text-lg tracking-wider">{ex.token}</td>
                      <td className="p-2 md:p-3">
                        <select value={ex.guru_id ? String(ex.guru_id) : ''} onChange={(e) => ubahPemilikUjian(ex.id, e.target.value)} className="p-2 border border-blue-300 rounded-lg text-sm bg-white font-semibold cursor-pointer w-full max-w-[200px] focus:outline-none focus:border-blue-600">
                          <option value={String(loggedInUser.id)}>Admin / Saya Sendiri</option>
                          {teachers.filter(t => t.role === 'guru').map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2 md:p-3 text-right whitespace-nowrap">
                        <button onClick={() => handleEditExamClick(ex)} className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-100 rounded mr-1 transition-colors" title="Edit Ujian"><Edit size={16}/></button>
                        <button onClick={() => hapusUjian(ex.id, ex.token)} className="p-1.5 md:p-2 text-red-600 hover:bg-red-100 rounded transition-colors" title="Hapus Permanen"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {exams.length === 0 && (<tr><td colSpan="4" className="p-4 text-center text-gray-500">Belum ada ujian yang dibuat oleh admin.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === TAB SISWA (HANYA ADMIN) === */}
        {loggedInUser.role === 'admin' && activeTab === 'siswa' && (
          <div className="space-y-6 print:hidden">
            <div className="bg-white p-5 md:p-6 rounded-lg shadow border-t-4 border-green-500">
              <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center gap-2"><UserPlus className="text-green-600"/> Upload Akun Siswa Massal (CSV)</h2>
              <div className="flex flex-col md:flex-row gap-3 mt-4">
                <button onClick={unduhTemplateCSV} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded hover:bg-blue-200 transition-colors text-sm border border-blue-300">
                  <Download size={16}/> Unduh Template
                </button>
                <div className="flex-1 flex items-center bg-gray-50 border border-gray-300 rounded p-1">
                  <label className="w-full flex items-center justify-center gap-2 cursor-pointer bg-white px-4 py-2 rounded border border-dashed border-gray-400 hover:bg-gray-100">
                    <Upload size={16} className="text-gray-500"/>
                    <span className="text-sm font-bold text-gray-600">{isUploadingCSV ? 'Mengunggah...' : 'Pilih File CSV'}</span>
                    <input type="file" accept=".csv" onChange={handleUploadCSV} disabled={isUploadingCSV} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className={`bg-white p-5 md:p-6 rounded-lg shadow border-t-4 ${isEditingSiswa ? 'border-yellow-500' : 'border-blue-600'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold">{isEditingSiswa ? 'Edit Akun Siswa' : 'Buat Akun Siswa Manual'}</h2>
                {isEditingSiswa && <button type="button" onClick={resetFormSiswa} className="text-sm font-bold text-gray-500 hover:text-red-500 underline">Batal Edit</button>}
              </div>
              <form onSubmit={simpanSiswa} className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-sm md:text-base">
                <input required type="text" placeholder="Nama Lengkap Siswa" className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" value={namaSiswa} onChange={(e) => setNamaSiswa(e.target.value)} />
                <input required type="text" placeholder="Kelas (Cth: XII IPA 1)" className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" value={kelasSiswa} onChange={(e) => setKelasSiswa(e.target.value)} />
                <input required type="text" placeholder="Username Siswa" className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" value={usernameSiswa} onChange={(e) => setUsernameSiswa(e.target.value)} />
                <input required type="text" placeholder="Password Siswa" className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" value={passwordSiswa} onChange={(e) => setPasswordSiswa(e.target.value)} />
                <button type="submit" className={`md:col-span-2 text-white font-bold py-3 rounded-lg shadow-md transition-colors ${isEditingSiswa ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isEditingSiswa ? 'SIMPAN PERUBAHAN' : 'BUAT AKUN SISWA'}
                </button>
              </form>
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-lg shadow overflow-x-auto">
              {/* FILTER KELAS UI */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-4 gap-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                  <h2 className="text-lg md:text-xl font-bold">Daftar Akun Siswa ({filteredStudents.length})</h2>
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded border border-gray-300">
                    <Filter size={16} className="text-gray-500"/>
                    <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
                      <option value="">Semua Kelas</option>
                      {uniqueKelas.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => setIsPrintingCards(true)} className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded font-bold flex items-center justify-center gap-2 text-sm shadow hover:bg-blue-700 transition-colors">
                    <Printer size={16}/> Cetak / PDF
                  </button>
                  <button onClick={unduhKartuWord} className="flex-1 md:flex-none px-4 py-2 bg-blue-800 text-white rounded font-bold flex items-center justify-center gap-2 text-sm shadow hover:bg-blue-900 transition-colors">
                    <FileText size={16}/> Unduh Word
                  </button>
                </div>
              </div>
              
              <table className="w-full text-left border-collapse text-sm md:text-base">
                <thead><tr className="bg-gray-100 border-b">
                  <th className="p-2 md:p-3">Nama Lengkap</th><th className="p-2 md:p-3 hidden md:table-cell">Kelas</th><th className="p-2 md:p-3">Username</th><th className="p-2 md:p-3 text-right">Aksi</th>
                </tr></thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 md:p-3 font-semibold text-gray-800">{s.name} <div className="text-xs text-gray-500 md:hidden">{s.kelas}</div></td>
                      <td className="p-2 md:p-3 hidden md:table-cell text-gray-600">{s.kelas || '-'}</td>
                      <td className="p-2 md:p-3 font-mono text-blue-700">{s.username}</td>
                      <td className="p-2 md:p-3 text-right whitespace-nowrap">
                        <button onClick={() => handleEditSiswaClick(s)} className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-100 rounded mr-1 transition-colors"><Edit size={16}/></button>
                        <button onClick={() => hapusUser(s.id, 'Siswa')} className="p-1.5 md:p-2 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (<tr><td colSpan="4" className="p-6 text-center text-gray-500">Data siswa tidak ditemukan.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === TAB GURU (HANYA ADMIN) === */}
        {loggedInUser.role === 'admin' && activeTab === 'guru' && (
          <div className="space-y-6 print:hidden">
            <div className={`bg-white p-5 md:p-6 rounded-lg shadow border-t-4 ${isEditingGuru ? 'border-yellow-500' : 'border-purple-600'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold">{isEditingGuru ? 'Edit Akun Guru' : 'Registrasi Akun Guru Baru'}</h2>
                {isEditingGuru && <button type="button" onClick={resetFormGuru} className="text-sm font-bold text-gray-500 hover:text-red-500 underline">Batal Edit</button>}
              </div>
              <form onSubmit={simpanGuru} className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-sm md:text-base">
                <input required type="text" placeholder="Nama Lengkap Guru (Beserta Gelar)" className="p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white" value={namaGuru} onChange={(e) => setNamaGuru(e.target.value)} />
                <input required type="text" placeholder="Mata Pelajaran yang Diampu" className="p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white" value={mapelGuru} onChange={(e) => setMapelGuru(e.target.value)} />
                <input required type="text" placeholder="Username (Untuk Login Guru)" className="p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white" value={usernameGuru} onChange={(e) => setUsernameGuru(e.target.value)} />
                <input required type="text" placeholder="Password Guru" className="p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white" value={passwordGuru} onChange={(e) => setPasswordGuru(e.target.value)} />
                <button type="submit" className={`md:col-span-2 text-white font-bold py-3 rounded-lg shadow-md transition-colors ${isEditingGuru ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900' : 'bg-purple-600 hover:bg-purple-700'}`}>
                  {isEditingGuru ? 'SIMPAN PERUBAHAN' : 'BUAT AKUN GURU'}
                </button>
              </form>
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-lg shadow overflow-x-auto">
              <h2 className="text-lg md:text-xl font-bold mb-4 border-b pb-2">Daftar Akun Guru / Pengawas ({teachers.length})</h2>
              <table className="w-full text-left border-collapse text-sm md:text-base">
                <thead><tr className="bg-gray-100 border-b">
                  <th className="p-2 md:p-3">Nama Lengkap</th><th className="p-2 md:p-3">Mata Pelajaran</th><th className="p-2 md:p-3">Username</th><th className="p-2 md:p-3 text-right">Aksi</th>
                </tr></thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 md:p-3 font-semibold text-gray-800">{t.name} {t.role === 'admin' && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Super Admin</span>}</td>
                      <td className="p-2 md:p-3 text-gray-700">{t.kelas || '-'}</td>
                      <td className="p-2 md:p-3 font-mono text-purple-700">{t.username}</td>
                      <td className="p-2 md:p-3 text-right whitespace-nowrap">
                        {t.role !== 'admin' && (
                          <>
                            <button onClick={() => handleEditGuruClick(t)} className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-100 rounded mr-1 transition-colors"><Edit size={16}/></button>
                            <button onClick={() => hapusUser(t.id, 'Guru')} className="p-1.5 md:p-2 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 size={16}/></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {teachers.length === 0 && (<tr><td colSpan="4" className="p-6 text-center text-gray-500">Belum ada akun guru.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
