import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Save, X } from 'lucide-react';

// Konfigurasi Toolbar Lengkap untuk Teks Stimulus/Soal Utama
const modulesLengkap = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub'}, { 'script': 'super' }], // Sangat penting untuk soal Fisika/Kimia
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link', 'image', 'video'],
    ['clean']
  ],
};

// Konfigurasi Toolbar Simpel untuk Opsi Jawaban
const modulesSimpel = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    ['image'],
    ['clean']
  ],
};

export default function FormSoal({ onSave, onCancel, dataAwal = null }) {
  // State untuk menyimpan data soal
  const [tipeSoal, setTipeSoal] = useState(dataAwal?.type || 'PG');
  const [kontenSoal, setKontenSoal] = useState(dataAwal?.content || '');
  const [opsiJawaban, setOpsiJawaban] = useState(
    dataAwal?.options || ['', '', '', '', ''] // Default 5 opsi (A, B, C, D, E)
  );
  const [kunciJawaban, setKunciJawaban] = useState(dataAwal?.correct_answer || '');
  const [bobot, setBobot] = useState(dataAwal?.bobot || 1);

  const handleOpsiChange = (index, value) => {
    const opsiBaru = [...opsiJawaban];
    opsiBaru[index] = value;
    setOpsiJawaban(opsiBaru);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validasi sederhana sebelum simpan
    if (!kontenSoal.trim() || kontenSoal === '<p><br></p>') {
      alert('Isi soal tidak boleh kosong!');
      return;
    }

    const dataSoal = {
      type: tipeSoal,
      content: kontenSoal,
      options: tipeSoal === 'PG' ? opsiJawaban : null,
      correct_answer: kunciJawaban,
      bobot: parseInt(bobot)
    };

    // Kirim data kembali ke parent component (Admin.jsx) untuk di-insert/update ke Supabase
    onSave(dataSoal);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-black text-[#1e40af]">
          {dataAwal ? 'Edit Soal' : 'Tambah Soal Baru'}
        </h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-red-600 transition-colors">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* TIPE SOAL & BOBOT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tipe Soal</label>
            <select 
              value={tipeSoal} 
              onChange={(e) => setTipeSoal(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="PG">Pilihan Ganda (PG)</option>
              <option value="PGK">Pilihan Ganda Kompleks (PGK)</option>
              <option value="BS">Benar / Salah (BS)</option>
              <option value="IS">Isian Singkat (IS)</option>
              <option value="U">Uraian (U)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Bobot Nilai</label>
            <input 
              type="number" min="1" 
              value={bobot} onChange={(e) => setBobot(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            />
          </div>
        </div>

        {/* EDITOR SOAL UTAMA / STIMULUS */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Isi Pertanyaan / Stimulus (Bisa copy-paste dari Word/Gambar)
          </label>
          <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
            <ReactQuill 
              theme="snow"
              value={kontenSoal}
              onChange={setKontenSoal}
              modules={modulesLengkap}
              className="h-64 mb-12" // Margin bottom agar area toolbar bawah tidak tertutup
            />
          </div>
        </div>

        {/* EDITOR OPSI JAWABAN (Khusus Tipe Pilihan Ganda) */}
        {tipeSoal === 'PG' && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <label className="block text-sm font-black text-[#1e40af] mb-4">
              Opsi Jawaban & Kunci
            </label>
            
            <div className="space-y-4">
              {opsiJawaban.map((opsi, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-2 ${kunciJawaban === opsi && opsi !== '' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-4">
                    
                    {/* Radio Button untuk set Kunci Jawaban */}
                    <div className="pt-2">
                      <input 
                        type="radio" 
                        name="kunci_pg"
                        title="Jadikan Kunci Jawaban"
                        className="w-5 h-5 accent-green-600 cursor-pointer"
                        checked={kunciJawaban === opsi && opsi !== ''}
                        onChange={() => setKunciJawaban(opsi)}
                      />
                    </div>
                    
                    {/* Label A, B, C, D, E */}
                    <div className="pt-2 font-black text-lg text-gray-700 w-6">
                      {String.fromCharCode(65 + idx)}.
                    </div>
                    
                    {/* Editor Opsi */}
                    <div className="flex-1 bg-white rounded overflow-hidden">
                      <ReactQuill 
                        theme="snow"
                        value={opsi}
                        onChange={(val) => handleOpsiChange(idx, val)}
                        modules={modulesSimpel}
                        className="h-24 mb-10" 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INPUT KUNCI JAWABAN UNTUK ISIAN SINGKAT */}
        {tipeSoal === 'IS' && (
          <div className="mt-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">Kunci Jawaban Singkat</label>
            <input 
              type="text" 
              value={kunciJawaban} onChange={(e) => setKunciJawaban(e.target.value)}
              placeholder="Ketik kunci jawaban eksak..."
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none font-bold"
            />
          </div>
        )}

        {/* TOMBOL AKSI */}
        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
          <button 
            type="button" onClick={onCancel}
            className="px-6 py-3 font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button 
            type="submit"
            className="flex items-center gap-2 px-8 py-3 font-bold text-white bg-[#1e40af] rounded-lg hover:bg-blue-800 transition-colors shadow-md"
          >
            <Save size={20} /> Simpan Soal
          </button>
        </div>

      </form>
    </div>
  );
}
