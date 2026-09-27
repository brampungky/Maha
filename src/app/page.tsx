"use client";
import { supabase } from '@/lib/supabase';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ShoppingCart, Search, Package, Trash2, Plus, Upload, 
  Download, LogOut, Home, BarChart3, Users, X,
  Printer, Send, Mail, Banknote, Smartphone, Settings
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const CATEGORIES = ['Apparel', 'Swimwear', 'Accessories', 'Bags', 'Consignment', 'Other'];

export default function POSMahaManagement() {
  const [activeTab, setActiveTab] = useState("pos");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [salesHistory, setSalesHistory] = useState([]);
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [itemDiscType, setItemDiscType] = useState('percent');
  const [itemDiscValue, setItemDiscValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cashless');
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '' });

  const subtotalGross = cart.reduce((acc, item) => {
    return acc + (Number(item.price || 0) * item.qty);
  }, 0);

  // 1. Hitung total nominal diskon dari SEMUA item di keranjang
  const totalItemDiscount = cart.reduce((acc, item) => {
    const hargaAsliTotal = Number(item.price || 0) * item.qty;
    const hargaDiskonTotal = Number(item.discountedPrice || item.price) * item.qty;
    return acc + (hargaAsliTotal - hargaDiskonTotal);
  }, 0);

  // 2. Hitung subtotal bersih (setelah diskon item)
  const subtotalNet = cart.reduce((acc, item) => acc + (Number(item.discountedPrice || item.price) * item.qty), 0);

  const globalDiscountAmount = discountType === 'percent' 
    ? (subtotalNet * discountValue / 100) 
    : discountValue;

  // 4. SEKARANG baru bisa hitung total diskon (Item + Global)
  const grandTotalDiscount = totalItemDiscount + globalDiscountAmount;

  // 5. TOTAL AKHIR
  const totalFinal = subtotalNet - globalDiscountAmount;

  const removeFromCart = (indexToRemove) => {
    setCart(prevCart => prevCart.filter((_, index) => index !== indexToRemove));
  };

  const removeFromCartByIndex = (index) => {
    setCart(prevCart => prevCart.filter((_, i) => i !== index));
  };

  // Di tampilan:
  {cart.map((item, index) => (
    <button onClick={() => removeFromCartByIndex(index)}>...</button>
  ))}
  
  // Fungsi Hapus Transaksi
  const deleteTransaction = async (saleId) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini dari database?")) return;

    try {
      // 1. Hapus Permanen dari Tabel 'sales' Supabase
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (error) {
        alert("Gagal menghapus transaksi dari Supabase: " + error.message);
        return;
      }

      // 2. Hapus dari State Tampilan Lokal (React)
      setSalesHistory((prev) => prev.filter((s) => s.id !== saleId));
      alert("Transaksi berhasil dihapus secara permanen!");
    } catch (err) {
      alert("Terjadi kesalahan: " + err.message);
    }
  };

  // Fungsi Edit Payment Method
  const editPaymentMethod = (id, currentMethod) => {
    const newMethod = currentMethod === 'Cash' ? 'Cashless' : 'Cash';
    if (window.confirm(`Ubah metode pembayaran ke ${newMethod}?`)) {
      setSalesHistory(prev => prev.map(sale => 
        sale.id === id ? { ...sale, method: newMethod } : sale
      ));
    }
  };

  // --- STATE SETTINGS & LOGO ---
  const [shopDetails, setShopDetails] = useState({
    logo: null,
    address: "Dream Beach Street, Nusa Lembongan",
    phone: "0823 4069 0067",
    ig: "@maha_thelabel"
  });
  const logoInputRef = useRef(null);
  const receiptRef = useRef(null);

  const handleAddStaff = async (newStaffData) => {
    console.log("1. Fungsi handleAddStaff dipanggil dengan data:", newStaffData);

    if (!newStaffData || !newStaffData.name || !newStaffData.pin) {
      alert("Nama dan PIN tidak boleh kosong!");
      return;
    }

    try {
      // Generate ID angka otomatis untuk mengisi kolom 'id int8' di Supabase
      const newId = Math.floor(Date.now() / 1000);

      console.log("2. Mengirim data ke Supabase...");

      const { data, error } = await supabase
        .from('staff')
        .insert([
          {
            id: newId,
            name: newStaffData.name,
            pin: String(newStaffData.pin).trim(), // Dikirim sebagai String/Text
            role: newStaffData.role || 'Staff'
          }
        ])
        .select();

      if (error) {
        console.error("3. Error Supabase:", error);
        alert("Gagal menyimpan ke Supabase: " + error.message);
        return;
      }

      console.log("4. Respon sukses dari Supabase:", data);

      if (data && data.length > 0) {
        // Perbarui state lokal
        setStaffList((prev) => [...prev, data[0]]);
        alert(`Staf ${newStaffData.name} berhasil ditambahkan!`);
      }
    } catch (err) {
      console.error("Catch Error:", err);
      alert("Terjadi kesalahan sistem: " + err.message);
    }
  };

  const [staffList, setStaffList] = useState([
    { id: 1, name: 'Nila R', pin: '1111', role: 'Staff' },
    { id: 2, name: 'Bram Pungky', pin: '2222', role: 'Staff' },
    { id: 3, name: 'Manager_Maha', pin: '1234', role: 'Manager' }
  ]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginPin, setLoginPin] = useState("");
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [sizeModal, setSizeModal] = useState({ show: false, product: null });
  const fileInputRef = useRef(null);

  const [dateRange, setDateRange] = useState('all'); // options: all, daily, monthly, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getFilteredSales = () => {
    // 1. Ambil tanggal hari ini dan paksa ke format lokal yang sama dengan data kamu (M/D/YYYY atau D/M/YYYY)
    const now = new Date();
    const todayFormatted = now.toLocaleDateString('en-US'); // Menghasilkan format "5/6/2026"
  
    // 2. Ambil bulan dan tahun saja untuk filter bulanan
    const currentMonth = (now.getMonth() + 1).toString();
    const currentYear = now.getFullYear().toString();

    return salesHistory.filter(sale => {
      // Pastikan sale.date adalah string
      const transactionDate = sale.date ? String(sale.date).trim() : "";

      // DEBUG untuk memastikan format sudah sama
      console.log("Membandingkan:", transactionDate, "vs", todayFormatted);

      if (dateRange === 'daily') {
        // Bandingkan string tanggal apa adanya
        return transactionDate === todayFormatted;
      }
    
      if (dateRange === 'monthly') {
        // Cek apakah di dalam string tanggal mengandung bulan/tahun yang sama
        // Contoh: "5/5/2026" mengandung "/5/2026"
        return transactionDate.includes(`/${currentYear}`) && 
              (transactionDate.startsWith(`${currentMonth}/`) || transactionDate.includes(`/${currentMonth}/`));
      }
    
      if (dateRange === 'custom') {
        if (!customStart || !customEnd) return true;
        // Untuk custom, kita ubah string "5/5/2026" menjadi objek Date agar bisa dibandingkan >= atau <=
        const d = new Date(transactionDate);
        const start = new Date(customStart);
        const end = new Date(customEnd);
        return d >= start && d <= end;
      }
    
      return true; 
    });
  };

  // 1. Deklarasikan fungsi pemuat data Supabase
  const fetchProductsFromSupabase = async () => {
    try {
      // Ambil data produk
      const { data: productsData, error: prodErr } = await supabase.from('products').select('*');
      if (!prodErr && productsData) {
        setProducts(productsData);
      }

      // Ambil data staf agar staf baru dari Supabase juga ikut termuat
      const { data: staffData, error: staffErr } = await supabase.from('staff').select('*');
      if (!staffErr && staffData) {
        setStaffList(staffData);
      }

      // 3. Ambil data Riwayat Penjualan (diurutkan dari yang terbaru)
      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (!salesErr && salesData) {
        setSalesHistory(salesData); // Sesuaikan 'setSalesHistory' dengan nama setter state riwayat kamu
      }

      // 3. Ambil data Toko Setting
      const fetchSettings = async () => {
        const { data, error } = await supabase
          .from('shop_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (data) {
          setShopDetails({
            logo: data.logo || null,
            address: data.address || '',
            phone: data.phone || '',
            ig: data.ig || ''
          });
        }
      };

      fetchSettings();

    } catch (err) {
      console.error("Error fetching data from Supabase:", err);
    }
  };

  // 2. Panggil fungsi di dalam useEffect (sekarang posisinya sudah benar di bawah deklarasi)
  useEffect(() => {
    fetchProductsFromSupabase();
  }, []);  

  // --- 1. PERBAIKAN PRINT ---
  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open('', '', 'height=700,width=500');
  
    win.document.write(`
      <html>
        <head>
          <title>Print Struk</title>
          <style>
            /* 1. Pengaturan Ukuran Kertas Thermal */
            @page {
              margin: 0;
              size: 57mm auto; /* Mengunci lebar kertas ke 57mm */
            }

            /* 2. Styling Body agar pas di lebar 58mm */
            body { 
              font-family: 'Courier New', Courier, monospace; /* Font struk klasik */
              width: 57mm;
              margin: 0;
              padding: 4px; /* Padding minimal agar teks tidak mepet pinggir */
              font-size: 10.5px; /* Ukuran font standar struk */
              line-height: 1.2;
              box-sizing: border-box;
            }

            /* 3. Helper Classes */
            .text-center { text-align: center; }
            .flex { display: flex; justify-content: space-between; }
            img { 
              display: block;
              margin: 0 auto 10px auto;
              max-width: 80%; /* Logo agar tidak terlalu lebar */
              height: auto; 
            }

            /* 4. Menghilangkan Header/Footer Browser (Tanggal/URL) */
            @media print {
              header, footer { display: none !important; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    win.document.close();
    win.focus();
  
    // Memberikan waktu agar CSS dan Gambar termuat sempurna
    setTimeout(() => { 
      win.print(); 
      win.close(); 
    }, 500);
  };

  const printReceipt = (transaction, isDuplicate = false) => {
    const content = `
      <div style="font-family:'Courier New', Courier, monospace; width:58mm; padding:5px; font-size:11px; line-height:1.2; box-sizing:border-box;">
        ${shopDetails.logo ? `<img src="${shopDetails.logo}" style="display:block;margin:0 auto 10px auto;max-width:80%;height:auto;" />` : `<div style="width:48px;height:48px;background:#000;color:#fff;border-radius:10px;margin:0 auto 10px auto;display:flex;align-items:center;justify-content:center;font-weight:900;">M</div>`}

        <div style="text-align:center;font-weight:900;font-size:14px;">MAHA THE LABEL</div>
        <div style="text-align:center;">
          <div style="font-size:8px;color:#64748b;">${shopDetails.address}</div>
          <div style="font-size:8px;color:#64748b;">${shopDetails.phone}</div>
          <div style="font-size:8px;color:#64748b;font-weight:700;">IG: ${shopDetails.ig}</div>
        </div>

        <div style="text-align:center;margin-top:6px;font-size:7px;color:#3b82f6;font-weight:900;letter-spacing:0.2em;border-top:1px solid #e2e8f0;padding-top:4px;">
          Store Receipt
        </div>

        ${isDuplicate ? `
          <div style="text-align:center;margin-top:6px;font-size:10px;font-weight:900;color:#dc2626;">
            DUPLICATE STRUK
          </div>
        ` : ""}

        <div style="margin-top:10px;border-top:1px dashed #e5e7eb;border-bottom:1px dashed #e5e7eb;padding:6px 0;">
          <div style="display:flex;justify-content:space-between;color:#6b7280;">
            <span>${transaction.id}</span>
            <span>${transaction.date} ${transaction.time}</span>
          </div>
        </div>

        <div style="margin-top:6px;">
          ${transaction.items.map((it) => {
            const itemName = it.Item || it.name || "Produk";
            const part = it.part || "";
            const color = it.color || "";
            const size = String(it.selectedSize || it.size || "").toUpperCase();
            const lineTotal = (Number(it.discountedPrice || it.price) * it.qty);
            return `
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <div style="flex:1;min-width:0;">
                  <strong style="font-weight:900;">${itemName}</strong>
                  <div style="font-size:10px;color:#374151;">
                    ${part} ${color} (${size})
                  </div>
                  <div style="font-size:9px;color:#6b7280;">x${it.qty}</div>
                </div>
                <div style="font-weight:900;">${Number(lineTotal).toLocaleString()}</div>
              </div>
            `;
          }).join("")}
        </div>

        <div style="margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:8px;">
          <div style="display:flex;justify-content:space-between;">
            <span>Subtotal</span>
            <span>${Number(transaction.subtotal).toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#e11d48;">
            <span>Discount</span>
            <span>-${Number(transaction.discount).toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:900;margin-top:6px;">
            <span>TOTAL</span>
            <span>${Number(transaction.total).toLocaleString()}</span>
          </div>
        </div>

        <div style="margin-top:10px;color:#6b7280;font-size:9px;">
          <div>Payment: <strong style="color:#111827;">${transaction.method}</strong></div>
          <div>Staff: <strong style="color:#111827;">${transaction.staff || "-"}</strong></div>
          <div>Customer: <strong style="color:#111827;">${(transaction.customer?.name || "GUEST").toUpperCase()}</strong></div>
        </div>

        <div style="text-align:center;margin-top:12px;font-size:9px;color:#9ca3af;font-style:italic;">
          Thank you for your purchase
        </div>
      </div>
    `;

    const win = window.open('', '', 'height=700,width=500');
    win.document.write(`
      <html>
        <head>
          <title>Print Struk</title>
          <style>
            @page { margin: 0; size: 58mm auto; }
            body { margin:0; padding:0; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  const addToCart = (product, selectedPart, selectedColor, selectedSize, discType, discValue) => {
    const originalPrice = Number(product.Price || product.price || 0);
    const stokTersedia = parseInt(product.Total || product.Display || 0);

    // Samakan string agar pembandingan presisi
    const cleanPart = (selectedPart || "").toString().trim();
    const cleanColor = (selectedColor || "").toString().trim();
    const cleanSize = (selectedSize || "").toString().trim().toUpperCase();

    setCart(prevCart => {
      // Cari apakah item dengan spek & diskon yang persis sama sudah ada
      const existingIndex = prevCart.findIndex(item => 
        item.Item === product.Item && 
        (item.part || "").toString().trim() === cleanPart && 
        (item.color || "").toString().trim() === cleanColor && 
        (item.selectedSize || "").toString().trim().toUpperCase() === cleanSize &&
        item.itemDiscType === discType && 
        item.itemDiscValue === discValue
      );

      if (existingIndex !== -1) {
        // Jika sudah ada, cek batas stok
        if (prevCart[existingIndex].qty >= stokTersedia) {
          alert("Stok tidak mencukupi!");
          return prevCart;
        }
        
        // Tambah Qty TEPAT +1
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          qty: newCart[existingIndex].qty + 1
        };
        return newCart;
      } else {
        // Jika barang baru, pastikan stok minimal ada 1
        if (stokTersedia <= 0) {
          alert("Stok habis!");
          return prevCart;
        }

        let discountAmount = discType === 'percent' ? (originalPrice * discValue) / 100 : discValue;
        const finalPricePerUnit = Math.max(0, originalPrice - discountAmount);

        return [
          ...prevCart,
          {
            ...product,
            price: originalPrice,
            discountedPrice: finalPricePerUnit,
            itemDiscType: discType,
            itemDiscValue: discValue,
            part: cleanPart,
            color: cleanColor,
            selectedSize: cleanSize,
            qty: 1, // Mulai dari 1
          }
        ];
      }
    });
  };

  // --- 2. KIRIM WA & EMAIL ---
  const sendWhatsApp = () => {
  if (!lastTransaction) return;

  // 1. Bersihkan nomor telepon
  let phone = lastTransaction.customer?.contact || "";
  phone = phone.replace(/\D/g, ''); 
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    // 2. Susun detail barang (Gunakan \n untuk baris baru)
    const itemDetails = lastTransaction.items
      .map((it) => {
        const itemName = it.Item || it.name || "Produk";
        const size = (it.selectedSize || it.size || "").toUpperCase();
        return `*${itemName}* (${it.part} - ${it.color} - ${size}) x${it.qty} = Rp ${(Number(it.price || 0) * it.qty).toLocaleString()}`;
      })
      .join("\n");

    // 3. Susun pesan dengan template string yang bersih
    // Jangan pakai spasi di awal baris di dalam backticks (``) agar tidak menjorok
    const message = `*MAHA THE LABEL - OFFICIAL INVOICE*
  ===============================
  *Client:* ${lastTransaction.customer?.name || "Valued Patron"}
  *Ref:* #${lastTransaction.id}
  *Date:* ${lastTransaction.date} | ${lastTransaction.time}
  -----------------------------------------------
  ${itemDetails}
  -----------------------------------------------
  *Subtotal:* Rp ${lastTransaction.subtotal.toLocaleString()}
  *Discount:* Rp ${lastTransaction.discount.toLocaleString()}
  *TOTAL AMOUNT: Rp ${lastTransaction.total.toLocaleString()}*
  -----------------------------------------------
  *Payment:* ${lastTransaction.method}
  ===============================
  _Thank you for your patronage. Kind regards._

  *IG:* https://www.instagram.com/maha_thelabel`;

    // 4. Kirim menggunakan URLSearchParams (Lebih stabil daripada encodeURIComponent manual)
    const params = new URLSearchParams({
      phone: phone,
      text: message
    });

    const waUrl = `https://api.whatsapp.com/send?${params.toString()}`;
    window.open(waUrl, '_blank');
  };

  const sendEmail = () => {
    if (!lastTransaction) return;

    // 1. Ambil email customer dari data transaksi
    const to = lastTransaction.customer?.email || ""; 
    const subject = `Receipt from MAHA THE LABEL - ${lastTransaction.id}`;

    // 2. Susun daftar item untuk isi email
    const itemDetails = lastTransaction.items
      .map((it) => {
        // Pastikan memanggil 'Item' (I besar) agar tidak undefined
        const itemName = it.Item || it.name || "Produk";
        const part = it.part || "";
        const color = it.color || "";
        const size = it.selectedSize || it.size || "";
      
        return `- ${itemName} (${part} - ${color} - ${size.toUpperCase()}): ${it.qty} x Rp ${Number(it.price).toLocaleString()}`;
      })
      .join("\n");

    // 3. Susun isi pesan lengkap
    const body = `
    Thank you for your purchase!

    Transaction ID: ${lastTransaction.id}
    Date: ${lastTransaction.date} | Time: ${lastTransaction.time}
    ---------------------------------------
    Items:
    ${itemDetails}
    ---------------------------------------
    Subtotal: Rp ${lastTransaction.subtotal.toLocaleString()}
    Discount: Rp ${lastTransaction.discount.toLocaleString()}
    
    Total: Rp ${lastTransaction.total.toLocaleString()}
    Payment: ${lastTransaction.method}

    Best regards,
    MAHA THE LABEL
    `.trim();

    // 4. Buka aplikasi email dengan subjek, tujuan, dan isi otomatis
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n');

        if (rows.length <= 1) {
          alert("File CSV kosong atau format tidak sesuai.");
          return;
        }

        // 1. Ambil Header dan bersihkan
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

        // 2. Parse setiap baris CSV
        const parsedData = rows.slice(1).map((row, index) => {
          if (!row.trim()) return null;
          const values = row.split(',');
          
          const obj = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] ? values[i].trim() : "";
          });

          const item = obj.item || obj.name || obj.nama || "";
          if (!item) return null;

          const part = obj.part || "";
          const color = obj.color || obj.warna || "";
          const size = obj.size || obj.ukuran || "";
          
          // Buat SKU otomatis jika di CSV tidak ada kolom SKU
          const generatedSku = obj.sku || `sku-${item}-${part}-${color}-${size}`.toLowerCase().replace(/[^a-z0-9]/g, '-');

          return {
            sku: generatedSku,
            Item: item,
            Part: part,
            Color: color,
            Size: size,
            Category: obj.category || obj.kategori || "General",
            Price: parseInt(obj.price || obj.harga || 0),
            Total: parseInt(obj.total || obj.stock || obj.stok || 0)
          };
        }).filter(Boolean);

        if (parsedData.length === 0) {
          alert("Tidak ada data produk yang valid terbaca dari CSV.");
          return;
        }

        // 3. Masukkan / Unggah langsung ke Supabase
        const { error } = await supabase
          .from('products')
          .upsert(parsedData, { onConflict: 'sku' });

        if (error) {
          console.error("Supabase Import Error:", error);
          alert("Gagal mengunggah ke Supabase: " + error.message);
          return;
        }

        // 4. Tarik ulang data terbaru dari Supabase untuk ditampilkan di layar
        const { data: latestData, error: fetchErr } = await supabase.from('products').select('*');
        if (!fetchErr && latestData) {
          setProducts(latestData);
        }

        alert(`Berhasil mengimpor ${parsedData.length} barang ke Supabase!`);

      } catch (err) {
        console.error("Import Error:", err);
        alert("Terjadi kesalahan saat memproses CSV: " + err.message);
      }
    };

    reader.readAsText(file);
  };

  const handlePayment = async () => {
    const newTransaction = {
      id: `${Date.now()}`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      staff: currentUser?.name || '-',
      shift: (new Date().getHours() * 60 + new Date().getMinutes()) <= 915 ? "Morning" : "Evening",
      customer: { ...customer },
      items: [...cart],
      subtotal: subtotalGross,
      discount: grandTotalDiscount,
      total: totalFinal,
      method: paymentMethod,
    };

    // 1. Simpan Transaksi ke Cloud
    const { error: saleErr } = await supabase.from('sales').insert([newTransaction]);
    if (saleErr) {
      alert("Gagal menyimpan transaksi: " + saleErr.message);
      return;
    }

    // 2. Potong Stok Produk di Cloud
    for (const item of cart) {
      const matchedProduct = products.find(p => 
        (p.Item || "").trim() === (item.Item || item.name || "").trim() &&
        (p.Part || "").trim() === (item.Part || item.part || "").trim() &&
        (p.Color || "").trim() === (item.Color || "").trim() &&
        (p.Size || "").trim().toUpperCase() === (item.selectedSize || item.Size || "").trim().toUpperCase()
      );

      if (matchedProduct) {
        const currentStock = parseInt(matchedProduct.Total || 0);
        const updatedStock = Math.max(0, currentStock - item.qty);

        await supabase
          .from('products')
          .update({ Total: updatedStock })
          .eq('id', matchedProduct.id);
      }
    }

    setLastTransaction(newTransaction);
    
    // TAMBAHKAN BARIS INI (Sesuaikan 'setSalesHistory' atau 'setSales' dengan nama state report kamu):
    setSalesHistory((prev) => [newTransaction, ...prev]);

    setShowReceipt(true);
    setCart([]);
    setDiscountValue(0);
    setCustomer({ name: '', contact: '', email: '' });
    setDiscountType('percent');
    setPaymentMethod('Cashless');
  };
  
  const handleAddManual = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const newItemName = (formData.get("name") || "").toString().trim();
    const newItemPart = (formData.get("part") || "").toString().trim();
    const newItemColor = (formData.get("color") || "").toString().trim();
    const newItemSize = (formData.get("size") || "").toString().trim().toUpperCase();
    const newItemCategory = (formData.get("category") || "").toString().trim();
    const newItemPrice = parseInt(formData.get("price")) || 0;
    const newItemStock = parseInt(formData.get("stock")) || 0;
    const newItemSku = (formData.get("sku") || "").toString().trim();

    // Cek apakah item sudah ada di cloud
    const existingProduct = products.find(p => 
      (p.Item || "").trim().toLowerCase() === newItemName.toLowerCase() &&
      (p.Part || "").trim().toLowerCase() === newItemPart.toLowerCase() &&
      (p.Color || "").trim().toLowerCase() === newItemColor.toLowerCase() &&
      (p.Size || "").trim().toLowerCase() === newItemSize.toLowerCase()
    );

    if (existingProduct) {
      const newStock = parseInt(existingProduct.Total || 0) + newItemStock;
      await supabase.from('products').update({ Total: newStock, Price: newItemPrice }).eq('id', existingProduct.id);
      alert(`Stok diperbarui menjadi ${newStock} pcs`);
    } else {
      await supabase.from('products').insert([{
        Item: newItemName,
        Part: newItemPart,
        Color: newItemColor,
        Size: newItemSize,
        Price: newItemPrice,
        Total: newItemStock,
        Category: newItemCategory,
        sku: newItemSku
      }]);
      alert("Produk varian baru berhasil ditambahkan!");
    }

    e.target.reset();
  };

  const resetSystem = () => {
    if(confirm("PERINGATAN: Ini akan menghapus SELURUH data stok, staff, dan penjualan. Lanjutkan?")) {
      localStorage.clear();
      window.location.reload();
    }
  };
  
  const exportToExcel = (type = 'sales', dataToPrint = []) => {
    if (dataToPrint.length === 0) {
      alert("Tidak ada data untuk di-export sesuai filter yang dipilih.");
      return;
    }

    let dataToExport = [];

    if (type === 'sales') {
      dataToExport = dataToPrint.flatMap((sale) => {
        // Hitung subtotal bersih dari seluruh item (setelah diskon item)
        const netSubtotal = sale.items.reduce((acc, it) => {
          const netP = Number(it.discountedPrice || it.price || 0);
          return acc + (netP * it.qty);
        }, 0);

        // Diskon global (nota) - jika user mengisi diskon nota di akhir
        const globalDisc = Number(sale.discount || 0) - sale.items.reduce((acc, it) => {
          const grossP = Number(it.price || 0) * it.qty;
          const netP = Number(it.discountedPrice || it.price || 0) * it.qty;
          return acc + (grossP - netP);
        }, 0);

        const actualGlobalDisc = globalDisc > 0 ? globalDisc : 0;

        return sale.items.map((item) => {
          const unitPrice = Number(item.price || 0);
          const itemNetPrice = Number(item.discountedPrice || item.price);
          const totalItemBeforeDisc = unitPrice * item.qty;
          
          // 1. Diskon Khusus Item (Hasil inputan diskon per item)
          const itemDiscNominal = totalItemBeforeDisc - (itemNetPrice * item.qty);

          // 2. Alokasi Diskon Global (Hanya jika ada diskon nota tambahan)
          const itemNetTotal = itemNetPrice * item.qty;
          const allocatedGlobalDisc = (netSubtotal > 0 && actualGlobalDisc > 0)
            ? (itemNetTotal / netSubtotal) * actualGlobalDisc 
            : 0;

          // Total Diskon Riil per Baris
          const totalDiscNominal = itemDiscNominal + allocatedGlobalDisc;
          const totalItemFinal = totalItemBeforeDisc - totalDiscNominal;

          // Tampilan Persentase
          let discPercentDisplay = '-';
          if (totalItemBeforeDisc > 0 && totalDiscNominal > 0) {
            discPercentDisplay = `${Math.round((totalDiscNominal / totalItemBeforeDisc) * 100)}%`;
          }

          return {
            "Tanggal": sale.date + ' ' + (sale.time || ''),
            "ID Transaksi": sale.id,
            "Qty": item.qty,
            "Item": `${item.Item || item.name} | ${item.part || '-'} | ${item.color || '-'} (${item.selectedSize || item.size || '-'})`,
            "Unit Price": unitPrice,
            "Total Item": totalItemBeforeDisc,
            "Disc %": discPercentDisplay,
            "Disc Nominal": Math.round(totalDiscNominal),
            "Final Price": Math.round(totalItemFinal),
            "Pay Method": sale.method,
            "Shift": sale.shift || '-',
            "PIC": sale.staff || '-'
          };
        });
      });
    } else {
      dataToExport = dataToPrint.map(p => ({
        'SKU': p.sku || p.SKU || '-',
        'Item': p.item || p.Item,
        'Part': p.part || p.Part || '-',
        'Color': p.color || p.Color || '-',
        'Size': p.size || p.Size || '-',
        'Category': p.category || p.Category || '-',
        'Stok': parseInt(p.Total || p.stock || 0), // Mengambil nilai stok terbaru
        'Harga': p.price || p.Price
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
    XLSX.writeFile(workbook, `Laporan_Maha_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = async (dataToPrint = null) => {
    // === BACA DATA LANGSUNG DARI SUPABASE JIKA TIDAK ADA DATA DI-PASSING ===
    let sourceData = dataToPrint;
    if (!sourceData || sourceData.length === 0) {
      const { data: supabaseSales, error } = await supabase
        .from('sales')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        alert("Gagal mengambil data dari Supabase: " + error.message);
        return;
      }
      sourceData = supabaseSales || [];
    }

    // Pemetaan data agar formatnya seragam
    const safeSales = sourceData.map(sale => {
      let rawItems = sale.items;
      if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems); } catch(e) { rawItems = []; }
      }
      return {
        ...sale,
        total: Number(sale.total_amount || sale.total || 0),
        discount: Number(sale.discount || 0),
        method: sale.payment_method || sale.method || 'Cash',
        items: Array.isArray(rawItems) ? rawItems : [],
        date: sale.date ? new Date(sale.date).toLocaleDateString('id-ID') : (sale.created_at ? new Date(sale.created_at).toLocaleDateString('id-ID') : '-'),
        time: sale.time || (sale.date ? new Date(sale.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')
      };
    });

    const grandTotal = safeSales.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const totalDiscountNominal = safeSales.reduce((acc, curr) => acc + (Number(curr.discount) || 0), 0);
    
    const cashTotal = safeSales
      .filter(sale => sale.method?.toLowerCase() === 'cash')
      .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    
    const cashlessTotal = safeSales
      .filter(sale => sale.method?.toLowerCase() !== 'cash')
      .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

    const allRows = safeSales.flatMap(sale => {
      // Subtotal setelah diskon item
      const netSubtotal = sale.items.reduce((acc, it) => {
        const netP = Number(it.discountedPrice || it.price || 0);
        return acc + (netP * (it.qty || 1));
      }, 0);

      // Hitung sisa diskon global (jika ada input diskon nota di akhir)
      const itemDiscountsTotal = sale.items.reduce((acc, it) => {
        const grossP = Number(it.price || 0) * (it.qty || 1);
        const netP = Number(it.discountedPrice || it.price || 0) * (it.qty || 1);
        return acc + (grossP - netP);
      }, 0);

      const actualGlobalDisc = Math.max(0, Number(sale.discount || 0) - itemDiscountsTotal);

      return sale.items.map(item => {
        const itemQty = Number(item.qty || 1);
        const unitPrice = Number(item.price || 0);
        const itemNetPrice = Number(item.discountedPrice || item.price || 0);
        const totalItemBeforeDisc = unitPrice * itemQty;
        
        // 1. Diskon dari inputan Per-Item
        const itemDiscNominal = totalItemBeforeDisc - (itemNetPrice * itemQty);

        // 2. Diskon dari Nota Global (jika ada)
        const itemNetTotal = itemNetPrice * itemQty;
        const allocatedGlobalDisc = (netSubtotal > 0 && actualGlobalDisc > 0)
          ? (itemNetTotal / netSubtotal) * actualGlobalDisc 
          : 0;

        const totalDiscNominal = itemDiscNominal + allocatedGlobalDisc;
        const totalItemFinal = totalItemBeforeDisc - totalDiscNominal;

        // Format Tampilan Persentase
        let discPercentDisplay = '-';
        if (item.itemDiscType === 'percent' && item.itemDiscValue > 0) {
          discPercentDisplay = `${item.itemDiscValue}%`;
        } else if (totalItemBeforeDisc > 0 && totalDiscNominal > 0) {
          discPercentDisplay = `${Math.round((totalDiscNominal / totalItemBeforeDisc) * 100)}%`;
        }

        return {
          date: sale.date,
          time: sale.time,
          qty: itemQty,
          fullItemName: `${item.Item || item.name || '-'} | ${item.part || '-'} | ${item.color || '-'} (${item.selectedSize || item.size || '-'})`,
          discPersen: discPercentDisplay,
          discNominal: Math.round(totalDiscNominal),
          finalPrice: Math.round(totalItemFinal),
          method: sale.method
        };
      });
    });

    const totalQty = allRows.reduce((acc, row) => acc + row.qty, 0);

    const tableRowsHtml = allRows.map(row => `
      <tr>
        <td>${row.date}<br/><small>${row.time}</small></td>
        <td style="text-align:center">${row.qty}</td>
        <td>${row.fullItemName}</td>
        <td style="text-align:center">${row.discPersen}</td>
        <td style="text-align:right">Rp ${row.discNominal.toLocaleString('id-ID')}</td>
        <td style="text-align:right">Rp ${row.finalPrice.toLocaleString('id-ID')}</td>
        <td style="text-align:center">${row.method}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Penjualan - Maha The Label - Lembongan</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #1e293b; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 10px; }
            th { background-color: #f8fafc; text-transform: uppercase; color: #64748b; }
            .footer-row { background-color: #f1f5f9; font-weight: bold; }
            .summary-box { margin-top: 30px; display: flex; gap: 20px; }
            .summary-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; flex: 1; }
            .summary-card h4 { margin: 0 0 10px 0; font-size: 12px; color: #64748b; }
            .summary-card p { margin: 0; font-size: 16px; font-weight: bold; color: #0f172a; }
            
            /* Konfigurasi Header & Footer Halaman Cetak (Print) */
            @media print { 
              .no-print { display: none; }
              @page {
                margin: 15mm 10mm 15mm 10mm;
                
                /* Footer Kiri Bawah Custom: menggantikan bawaan URL / about:blank */
                @bottom-left {
                  content: "Printed: " "${new Date().toLocaleString('id-ID')}";
                  font-size: 9px;
                  font-family: 'Segoe UI', sans-serif;
                  color: #64748b;
                }
                
                /* Footer Kanan Bawah Custom: Menampilkan Halaman */
                @bottom-right {
                  content: "Halaman " counter(page) " dari " counter(pages);
                  font-size: 9px;
                  font-family: 'Segoe UI', sans-serif;
                  color: #64748b;
                }
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
          <h1 style="margin:0; font-size: 18px;">MAHA The Label, Lembongan - SALES REPORT</h1>
          <p style="margin:5px 0; font-size:10px; font-weight: bold; color: #475569;">
            Periode: ${typeof startDate !== 'undefined' && startDate ? startDate : 'Semua'} s/d ${typeof endDate !== 'undefined' && endDate ? endDate : 'Sekarang'}
          </p>
        </div>

          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Qty</th>
                <th style="width:35%">Item | Part | Color (Size)</th>
                <th>Disc %</th>
                <th>Disc Nominal</th>
                <th>Final Price</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr class="footer-row">
                <td style="text-align:right">TOTAL</td>
                <td style="text-align:center">${totalQty}</td>
                <td colspan="2"></td>
                <td style="text-align:right">Rp ${totalDiscountNominal.toLocaleString('id-ID')}</td>
                <td style="text-align:right">Rp ${grandTotal.toLocaleString('id-ID')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="summary-box">
            <div class="summary-card">
              <h4>Total Cash</h4>
              <p>Rp ${cashTotal.toLocaleString('id-ID')}</p>
            </div>
            <div class="summary-card">
              <h4>Total Cashless (Card/QRIS)</h4>
              <p>Rp ${cashlessTotal.toLocaleString('id-ID')}</p>
            </div>
            <div class="summary-card" style="background-color: #eff6ff; border-color: #bfdbfe;">
              <h4>Grand Total Revenue</h4>
              <p style="color: #2563eb;">Rp ${grandTotal.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleLogin = async () => { // <-- TAMBAHKAN async DI SINI
    // 1. Cari dulu ke Supabase berdasarkan PIN
    const { data: userFromDb } = await supabase
      .from('staff')
      .select('*')
      .eq('pin', loginPin)
      .maybeSingle();

    let user = userFromDb;

    // 2. Fallback cadangan jika Supabase offline/belum merespon
    if (!user) {
      if (loginPin === "1234") {
        user = { id: 3, name: 'Manager_Maha', pin: '1234', role: 'Manager' };
      } else if (loginPin === "1111") {
        user = { id: 1, name: 'Nila R', pin: '1111', role: 'Admin' };
      } else if (loginPin === "2222") {
        user = { id: 2, name: 'Bram Pungky', pin: '2222', role: 'Staff' };
      }
    }

    // 3. Jika user ditemukan, proses login
    if (user) {
      // Sesuaikan nama variabel state kamu (setCurrentUser & setActiveTab)
      setCurrentUser(user);
      setLoginPin("");
      setActiveTab("pos");
    } else {
      alert("PIN Salah!");
      setLoginPin("");
    }
  };

  const handleLogout = () => { setCurrentUser(null); setLoginPin(""); };
  const recordActivity = () => setLastActivity(Date.now());

  const groupedProducts = useMemo(() => {
    const filtered = products.filter(p => {
      if (!p) return false;
      const name = String(p.Item || "").toLowerCase();
      const part = String(p.Part || "").toLowerCase();
      const color = String(p.Color || "").toLowerCase();
      const search = (searchTerm || "").toLowerCase();
      return name.includes(search) || part.includes(search) || color.includes(search);
    });

    const groups = {};
    filtered.forEach(p => {
      // KUNCI BARU: Gabungkan Item, Part, dan Color
      const key = `${p.Item}-${p.Part}-${p.Color}`; 
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [products, searchTerm]);

  if (!currentUser) {
    return (
      <div className="h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="bg-[#1e293b] p-10 rounded-[3rem] border border-slate-700 w-80 text-center shadow-2xl">
          <h1 className="text-white font-black mb-6 uppercase tracking-tighter">MAHA POS LOGIN</h1>
          <input type="password" placeholder="PIN" className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 text-center text-white text-2xl mb-4 outline-none focus:border-blue-500" value={loginPin} onChange={e => setLoginPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-xs">ENTER SYSTEM</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen bg-[#0f172a] text-slate-200 flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden" onMouseMove={recordActivity}>
      <nav className="w-full md:w-64 bg-[#1e293b] border-b md:border-b-0 md:border-r border-slate-800 flex flex-row md:flex-col items-center justify-between md:justify-start px-4 py-3 md:py-8 shrink-0">
         <div className="px-6 mb-10 hidden md:block">
           <h1 className="font-black text-white text-xl tracking-tighter">MAHA</h1>
           <p className="text-[10px] font-bold text-blue-500 uppercase">The Label</p>
         </div>
         <div className="flex-1 w-full px-4 space-y-2">
           <button onClick={() => setActiveTab("pos")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'pos' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800 text-slate-500'}`}><Home size={20}/><span className="hidden md:block font-bold text-sm">POS / Home</span></button>
           {currentUser?.role === 'Manager' && (
             <>
               <button onClick={() => setActiveTab("inventory")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}><Package size={20}/><span className="hidden md:block font-bold text-sm">Inventory</span></button>
               <button onClick={() => setActiveTab("reports")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}><BarChart3 size={20}/><span className="hidden md:block font-bold text-sm">Reports</span></button>
               <button onClick={() => setActiveTab("users")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}><Users size={20}/><span className="hidden md:block font-bold text-sm">Staff</span></button>
               <button onClick={() => setActiveTab("settings")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}><Settings size={20}/><span className="hidden md:block font-bold text-sm">Settings</span></button>
             </>
           )}
           {currentUser?.role === 'Staff' && (
             <>
               <button onClick={() => setActiveTab("inventory")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}><Package size={20}/><span className="hidden md:block font-bold text-sm">Inventory</span></button>
               <button onClick={() => setActiveTab("reports")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}><BarChart3 size={20}/><span className="hidden md:block font-bold text-sm">Reports</span></button>
             </>
           )}
         </div>
         <div className="px-4 w-full"><button onClick={handleLogout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all"><LogOut size={20}/><span className="hidden md:block font-bold text-sm">Logout</span></button></div>
      </nav>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-8">
           <h2 className="text-lg font-black text-white uppercase tracking-widest">{activeTab}</h2>
           <div className="flex items-center gap-4 bg-[#1e293b] px-4 py-2 rounded-2xl border border-slate-800">
             <div className="text-right">
               <p className="text-[9px] font-black text-slate-500 uppercase">
                 {currentUser?.role || "-"}
               </p>

               <p className="text-xs font-bold text-white">
                 {currentUser?.name || "User"}
               </p>
             </div>
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black">{currentUser?.name?.[0] || "U"}</div>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'pos' && (
            <div className="flex gap-8 h-full">
              <div className="flex-1 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18}/>
                  <input placeholder="Search products..." className="w-full pl-12 pr-4 py-4 bg-[#1e293b] border border-slate-800 rounded-2xl text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.values(groupedProducts).map((group, index) => {
                    const displayItem = group[0]; 

                    return (
                      <div 
                        key={index} 
                        className="p-5 bg-[#1e293b] rounded-[2rem] border border-slate-800 cursor-pointer hover:border-blue-500 transition-all shadow-xl"
                        onClick={() => setSizeModal({ show: true, product: group })}
                      >
                        <div className="space-y-1">
                          <h4 className="text-white font-black uppercase text-sm tracking-tighter">
                            {displayItem.Item}
                          </h4>
                          <div className="flex gap-2">
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full uppercase">
                              {displayItem.Part}
                            </span>
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full uppercase">
                              {displayItem.Color}
                            </span>
                          </div>
                          <p className="text-blue-500 font-black text-xs pt-2">
                            Rp {parseInt(displayItem.Price).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="w-96 bg-[#1e293b] rounded-[2.5rem] border border-slate-800 flex flex-col overflow-hidden">
                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                  <div className="p-6 border-b border-slate-800">
                    <h3 className="font-black text-white flex items-center gap-2 mb-4 uppercase text-sm"><ShoppingCart size={18}/> Current Order</h3>
                    <div className="space-y-2">
                      <input placeholder="Customer Name" className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})}/>
                      <input placeholder="WA (628xxx)" className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})}/>
                      <input placeholder="Email" className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})}/>
                    </div>
                  </div>
                  {cart.map((item, index) => (
                    <div key={`${item.Item}-${item.part}-${item.color}-${item.selectedSize}-${item.itemDiscValue}-${item.itemDiscType}-${index}`} className="flex flex-col mb-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                      <div className="flex justify-between items-start">
                        <div className="text-right">
                          {/* Tampilkan Diskon Item jika ada */}
                          {item.itemDiscValue > 0 && (
                            <p className="text-[10px] text-red-400 line-through">
                              Rp {Number(item.price).toLocaleString()}
                            </p>
                          )}
                          <p className="font-black text-blue-500">
                            Rp {Number(item.discountedPrice || item.price).toLocaleString()}
                          </p>
                          {/* TOMBOL SAMPAH MERAH */}
                          <button
                            onClick={() => removeFromCartByIndex(index)}
                            className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                          >
                            Remove Item #{index + 1}
                          </button>
                        </div>
                        <div className="flex gap-3">
                          {/* Indikator Jumlah (Qty) - Bulatan Biru/Putih */}
                          <div className="flex items-center justify-center bg-blue-600 text-white w-8 h-8 rounded-full font-bold text-xs shrink-0">
                            {item.qty}x
                          </div>
                          
                          <div>
                            <h4 className="font-bold text-white uppercase text-sm">
                              {item.Item || item.name}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              {item.part} - {item.color} - {item.selectedSize}
                            </p>
                          </div>
                        </div>
                      </div>
    
                      {/* Info tambahan diskon di bawah nama barang */}
                      {item.itemDiscValue > 0 && (
                        <div className="mt-1">
                          <span className="bg-red-500/10 text-red-400 text-[9px] px-2 py-0.5 rounded-full font-bold">
                            Item Disc: {item.itemDiscType === 'percent' ? `${item.itemDiscValue}%` : `Rp ${item.itemDiscValue.toLocaleString()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-[#161e2e] border-t border-slate-800 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Discount</p>
                    <div className="flex gap-2 p-1 bg-[#0f172a] rounded-xl border border-slate-800">
                      <button onClick={() => setDiscountType("nominal")} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${discountType === "nominal" ? "bg-blue-600 text-white" : "text-slate-500"}`}>RP</button>
                      <button onClick={() => setDiscountType("percent")} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${discountType === "percent" ? "bg-blue-600 text-white" : "text-slate-500"}`}>%</button>
                      <input type="number" className="w-20 bg-transparent text-right pr-4 text-white font-black outline-none" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Payment Method</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setPaymentMethod('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[10px] transition-all ${paymentMethod === 'Cash' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'border-slate-800 text-slate-500'}`}><Banknote size={16}/> CASH</button>
                      <button onClick={() => setPaymentMethod('Cashless')} className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[10px] transition-all ${paymentMethod === 'Cashless' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'border-slate-800 text-slate-500'}`}><Smartphone size={16}/> CASHLESS</button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center mb-4"><span className="text-lg font-black text-white">TOTAL</span><span className="text-xl font-black text-blue-500">Rp {totalFinal.toLocaleString()}</span></div>
                    <button onClick={handlePayment} disabled={cart.length === 0} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-sm text-white shadow-xl shadow-blue-600/20 active:scale-95 transition-all">PROCESS TRANSACTION</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* SEBELAH KIRI: TAMBAH STOK MANUAL (Tetap sama) */}
                <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-800">
                  <h3 className="text-white font-black mb-6 flex items-center gap-2"><Plus size={18}/> TAMBAH STOK MANUAL</h3>
                  <form onSubmit={handleAddManual} className="grid grid-cols-2 gap-4">
                    <input name="sku" placeholder="SKU" className="col-span-2 bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white" required/>
                    <input name="name" placeholder="Item Name" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white" required/>
                    <select name="category" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                      <input name="part" placeholder="Part" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white"/>
                    <input name="color" placeholder="Color" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white"/>
                    <input name="size" placeholder="Size" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white" required/>
                    <input name="price" type="number" placeholder="Price" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white" required/>
                    <input name="stock" type="number" placeholder="Stock" className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs text-white" required/>
                    <button type="submit" className="col-span-2 bg-blue-600 py-3 rounded-xl font-black text-xs uppercase text-white">Simpan Barang</button>
                  </form>
                </div>

                  {/* SEBELAH KANAN: IMPORT & EXPORT STOK (Disisipkan di sini) */}
                <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-800 flex flex-col items-center justify-center text-center text-white">
                  <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mb-4"><Upload size={32}/></div>
                  <h3 className="font-black mb-2 uppercase tracking-widest">Manajemen Data Stok</h3>
                    <p className="text-slate-500 text-xs mb-6 px-10">Gunakan CSV untuk update massal atau Export untuk laporan stok saat ini.</p>
        
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleImportCSV} accept=".csv"/>
        
                  {/* Tombol Berdampingan */}
                  <div className="flex gap-4 w-full px-6">
                    <button 
                      onClick={() => fileInputRef.current.click()} 
                      className="flex-1 bg-white text-black py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all"
                    >
                      Import CSV
                    </button>

                    <button 
                      onClick={() => exportToExcel('inventory', products)} // Pastikan variabelnya 'products' atau ganti sesuai state-mu
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                      Export Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* --- CARD FILTER (Bagian Atas) --- */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1e293b] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                <div className="space-y-2">
                  <h3 className="text-white font-black uppercase tracking-widest text-[10px] opacity-50">Filter Periode</h3>
                  <div className="flex gap-2">
                    {['all', 'daily', 'monthly', 'custom'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setDateRange(type)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                          dateRange === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {type === 'all' ? 'Semua' : type === 'daily' ? 'Hari Ini' : type === 'monthly' ? 'Bulan Ini' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Tanggal Custom */}
                {dateRange === 'custom' && (
                  <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-4">
                    <input 
                      type="date" 
                      value={customStart} 
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-500 text-xs font-bold font-mono">TO</span>
                    <input 
                      type="date" 
                      value={customEnd} 
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Tombol Export (Hanya 1 set tombol) */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => exportToExcel('sales', getFilteredSales())}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-green-600/20"
                  >
                    <Download size={14} /> EXCEL
                  </button>
                  <button 
                    onClick={() => exportToPDF(getFilteredSales())}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-rose-600/20"
                  >
                    <Printer size={14} /> PDF
                  </button>
                </div>
              </div>

              {/* --- TABEL TRANSAKSI (Gunakan data Filtered) --- */}
              <div className="bg-[#1e293b] rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs text-white">
                  <thead className="bg-[#0f172a] text-slate-500 font-black uppercase">
                    <tr>
                      <th className="p-4">Tanggal</th>
                      <th className="p-4 text-center">Qty</th>
                      <th className="p-4">Item (Spec)</th>
                      <th className="p-4">PIC / Shift</th>
                      <th className="p-4">Method</th>
                      <th className="p-4 text-right">Total</th>
                      {/* Kolom Khusus Manager */}
                      {(currentUser?.role === 'Manager') && (
                        <th className="p-4 text-center text-red-500">Action</th>
                      )}
                      {(currentUser?.role !== 'Manager') && (
                        <th className="p-4 text-center">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredSales().length > 0 ? (
                      getFilteredSales().flatMap((s, saleIndex) =>
                        s.items.map((item, itemIndex) => (
                          <tr
                            key={`${saleIndex}-${itemIndex}`}
                            className="border-t border-slate-800 hover:bg-slate-800/50 transition-colors"
                          >
                            {/* 1. TANGGAL (Muncul cuma di baris pertama transaksi) */}
                            <td className="p-4 text-slate-400 font-mono">
                              {itemIndex === 0 ? (
                                <>
                                  {s.date} <br />
                                  <span className="text-[10px] opacity-50">{s.time}</span>
                                </>
                              ) : (
                                <span className="text-[10px] opacity-20 block text-center">"</span>
                              )}
                            </td>

                            {/* 2. QTY */}
                            <td className="p-4 font-bold text-blue-500 text-center">
                              {item.qty}
                            </td>

                            {/* 3. ITEM (GABUNGAN) */}
                            <td className="p-4">
                              <p className="font-bold text-white uppercase text-[11px]">
                                {item.Item || item.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {item.part} | {item.color} | Size: {item.selectedSize || item.size}
                              </p>
                            </td>

                            {/* 4. PIC / SHIFT */}
                            <td className="p-4 text-slate-400">
                              {itemIndex === 0 ? (
                                <>
                                  {s.staff} <br />
                                  <span className="text-blue-500 text-[10px] font-bold uppercase">{s.shift}</span>
                                </>
                              ) : (
                                <span className="text-[10px] opacity-20 block text-center">"</span>
                              )}
                            </td>

                            {/* 5. METHOD & EDIT (Manager Only) */}
                            <td className="p-4">
                              {itemIndex === 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="bg-slate-800 px-2 py-1 rounded text-[10px] font-black border border-slate-700">
                                    {s.method}
                                  </span>
                                  {currentUser?.role === 'Manager' && (
                                    <button
                                      onClick={() => editPaymentMethod(s.id, s.method)}
                                      className="text-blue-500 hover:text-blue-400 text-[10px] underline font-bold"
                                    >
                                      EDIT
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] opacity-20 block text-center">"</span>
                              )}
                            </td>

                            {/* 6. TOTAL HARGA ITEM */}
                            <td className="p-4 text-right font-black text-white">
                              Rp {(Number(item.discountedPrice || item.price) * item.qty).toLocaleString()}
                            </td>

                            <td className="p-4 text-center">
                              {itemIndex === 0 && (
                                <div className="flex items-center gap-2 justify-center">
                                  <button
                                    onClick={() => printReceipt(s, true)}
                                    className="text-yellow-400 hover:text-blue-300 text-[10px] underline font-bold"
                                  >
                                    REPRINT
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* 7. DELETE ACTION (Manager Only) */}
                            {currentUser?.role === 'Manager' && (
                              <td className="p-4 text-center">
                                {itemIndex === 0 ? (
                                  <button
                                    onClick={() => deleteTransaction(s.id)}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : null}
                              </td>
                            )}

                          </tr>
                        ))
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan={currentUser?.role === 'Manager' ? 7 : 6}
                          className="p-20 text-center text-slate-500 italic opacity-30 uppercase tracking-widest font-bold"
                        >
                          Tidak ada transaksi pada periode ini
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {activeTab === 'users' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center text-white">
                <h3 className="font-black uppercase tracking-widest">Karyawan Aktif</h3>
                <button 
                  onClick={async () => {
                    const name = prompt("Nama Karyawan:");
                    if (!name) return;

                    const pin = prompt("PIN:");
                    if (!pin) return;

                    const roleChoice = prompt("Pilih Role:\n1. Admin\n2. Staff\n3. Manager", "2");
                    let role = "Staff";
                    if (roleChoice === "1") role = "Admin";
                    else if (roleChoice === "3") role = "Manager";

                    const generatedId = Math.floor(Date.now() / 1000);

                    // Simpan ke Supabase
                    const { data, error } = await supabase
                      .from('staff')
                      .insert([
                        { 
                          id: generatedId, 
                          name: name.trim(), 
                          pin: String(pin).trim(), 
                          role 
                        }
                      ])
                      .select();

                    if (error) {
                      alert("Gagal menyimpan staff ke Supabase: " + error.message);
                      return;
                    }

                    if (data && data.length > 0) {
                      setStaffList(prev => [...prev, data[0]]);
                      alert(`Karyawan ${name} (${role}) berhasil ditambahkan!`);
                    }
                  }} 
                  className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-[10px] flex items-center gap-2 hover:bg-blue-500 transition-colors"
                >
                  <Plus size={14}/> TAMBAH STAFF
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {staffList.filter(Boolean).map((s, idx) => (
                  <div key={s?.id || idx} className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center group text-white">
                    <div>
                      <p className="font-bold">{s.name}</p>
                      <p className="text-[10px] font-black text-blue-500 uppercase">{s.role}</p>
                      <p className="text-slate-500 font-mono text-xs mt-2 italic">PIN: {s.pin}</p>
                    </div>
                    <div className="flex gap-2">
                      {/* BUTTON EDIT (Termasuk Edit Role) */}
                      <button 
                        onClick={async () => {
                          const newName = prompt("Edit Nama:", s.name);
                          if (!newName) return;

                          const newPin = prompt("Edit PIN:", s.pin);
                          if (!newPin) return;

                          const currentRoleNum = s.role === 'Admin' ? '1' : s.role === 'Manager' ? '3' : '2';
                          const roleChoice = prompt("Pilih Role Baru:\n1. Admin\n2. Staff\n3. Manager", currentRoleNum);
                          let newRole = s.role;
                          if (roleChoice === "1") newRole = "Admin";
                          else if (roleChoice === "2") newRole = "Staff";
                          else if (roleChoice === "3") newRole = "Manager";

                          // Update ke Supabase Cloud
                          const { error } = await supabase
                            .from('staff')
                            .update({ 
                              name: newName.trim(), 
                              pin: String(newPin).trim(), 
                              role: newRole 
                            })
                            .eq('id', s.id);

                          if (error) {
                            alert("Gagal mengupdate staff: " + error.message);
                            return;
                          }

                          // Update state tampilan lokal
                          setStaffList(staffList.map(st => st?.id === s?.id ? { ...st, name: newName, pin: newPin, role: newRole } : st));
                          alert(`Data ${newName} berhasil diubah!`);
                        }} 
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <Settings size={14}/>
                      </button>

                      {/* BUTTON HAPUS */}
                      {s.name !== 'Manager_Maha' && (
                        <button 
                          onClick={async () => {
                            if (confirm(`Yakin ingin menghapus ${s.name}?`)) {
                              const { error } = await supabase
                                .from('staff')
                                .delete()
                                .eq('id', s.id);

                              if (error) {
                                alert("Gagal menghapus staff: " + error.message);
                                return;
                              }

                              setStaffList(staffList.filter(st => st?.id !== s?.id));
                            }
                          }} 
                          className="text-slate-600 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={18}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-800 text-white space-y-8">
              
              <div>
                <h3 className="font-black mb-6 uppercase tracking-widest">Store Settings</h3>
                <div className="space-y-6">
                  
                  {/* LOGO UPLOAD */}
                  <div className="flex flex-col items-center p-6 border-2 border-dashed border-slate-700 rounded-3xl">
                    {shopDetails.logo ? (
                      <img src={shopDetails.logo} alt="Logo Toko" className="h-20 object-contain mb-4 rounded-lg" />
                    ) : (
                      <div className="w-20 h-20 bg-slate-800 rounded-2xl mb-4 flex items-center justify-center text-slate-500 italic text-xs">No Logo</div>
                    )}
                    <input 
                      type="file" 
                      ref={logoInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            // Kompresi Gambar agar ukuran string base64 kecil & ringan di Supabase
                            const img = new Image();
                            img.src = reader.result;
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              const ctx = canvas.getContext("2d");
                              const maxWidth = 300; // Ukuran lebar optimal untuk logo struk
                              const scale = maxWidth / img.width;
                              canvas.width = maxWidth;
                              canvas.height = img.height * scale;

                              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                              const compressedBase64 = canvas.toDataURL("image/jpeg/png", 0.7); // Kualitas 70%
                              
                              setShopDetails({ ...shopDetails, logo: compressedBase64 });
                            };
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <button 
                      onClick={() => logoInputRef.current.click()} 
                      className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase text-white hover:bg-blue-500 transition-colors"
                    >
                      Upload Logo Struk
                    </button>
                  </div>

                  {/* INPUT FORM */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Alamat Toko</label>
                      <input 
                        className="w-full bg-[#0f172a] border border-slate-700 p-4 rounded-2xl text-xs mt-1 text-white" 
                        value={shopDetails.address || ''} 
                        onChange={(e) => setShopDetails({ ...shopDetails, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2">WhatsApp</label>
                        <input 
                          className="w-full bg-[#0f172a] border border-slate-700 p-4 rounded-2xl text-xs mt-1 text-white" 
                          value={shopDetails.phone || ''} 
                          onChange={(e) => setShopDetails({ ...shopDetails, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Instagram</label>
                        <input 
                          className="w-full bg-[#0f172a] border border-slate-700 p-4 rounded-2xl text-xs mt-1 text-white" 
                          value={shopDetails.ig || ''} 
                          onChange={(e) => setShopDetails({ ...shopDetails, ig: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* TOMBOL SIMPAN TO SUPABASE */}
                  <button
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('shop_settings')
                          .upsert([
                            {
                              id: 1, 
                              logo: shopDetails.logo || null,
                              address: shopDetails.address || '',
                              phone: shopDetails.phone || '',
                              ig: shopDetails.ig || ''
                            }
                          ]);

                        if (error) {
                          alert("Gagal menyimpan ke Supabase: " + error.message);
                          return;
                        }

                        alert("Pengaturan & Logo Toko berhasil disimpan permanen di Supabase!");
                      } catch (err) {
                        alert("Terjadi kesalahan: " + err.message);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
                  >
                    SIMPAN PENGATURAN TOKO
                  </button>

                </div>
              </div>

              {/* ZONA BAHAYA */}
              <div className="bg-rose-500/5 p-8 rounded-[2.5rem] border border-rose-500/20">
                <h3 className="text-rose-500 font-black mb-2 uppercase text-xs">Zona Bahaya</h3>
                <p className="text-slate-500 text-[10px] mb-6">Menghapus semua data stok, riwayat penjualan, dan pengaturan toko secara permanen.</p>
                <button 
                  onClick={resetSystem} 
                  className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-black text-[10px] transition-all shadow-lg shadow-rose-600/20 uppercase"
                >
                  RESET SELURUH SISTEM
                </button>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* MODAL STRUK DIGITAL (RECEIPT) */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-[350px] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
            <div ref={receiptRef}>
              <div className="bg-slate-50 p-8 text-center border-b border-dashed border-slate-200">
                {shopDetails.logo ? (
                  <img src={shopDetails.logo} alt="Logo" className="h-16 mx-auto mb-3 object-contain" />
                ) : (
                  <div className="w-12 h-12 bg-black rounded-xl mx-auto mb-3 flex items-center justify-center text-white font-black italic text-xl">M</div>
                )}
                <h2 className="font-black text-lg tracking-tighter uppercase">MAHA THE LABEL</h2>
                <div className="mt-2 space-y-0.5">
                  <p className="text-[8px] text-slate-600 font-medium leading-tight">{shopDetails.address}</p>
                  <p className="text-[8px] text-slate-600 font-medium">{shopDetails.phone}</p>
                  <p className="text-[8px] text-slate-600 font-bold">IG: {shopDetails.ig}</p>
                </div>
                <p className="text-[7px] text-blue-500 font-black uppercase tracking-[0.2em] mt-4 border-t pt-2 border-slate-200">Store Receipt</p>
              </div>

              <div className="p-8 space-y-4 font-mono text-[10px]">
                <div className="flex justify-between border-b pb-2 text-slate-400">
                  <span>{lastTransaction.id}</span>
                  <span>{lastTransaction.date} {lastTransaction.time}</span>
                </div>
                <div className="space-y-2 py-2">
                  {lastTransaction.items.map((it, idx) => {
                    const formatText = (txt) => {
                      if (!txt) return "";
                      return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
                    };

                    return (
                      <div key={idx} className="flex flex-col mb-2">
                        <div className="flex justify-between">
                          <span className="flex-1 leading-tight">
                            {/* Item Bold */}
                            <strong className="font-black">{it.Item || it.name}</strong> 
                            {/* Spasi dan detail lainnya */}
                            <span>
                              {" "}{formatText(it.part)} {formatText(it.color)} ({String(it.selectedSize || it.size || "").toUpperCase()})
                            </span>
                            <span className="ml-1 text-slate-500">x{it.qty}</span>
                          </span>
                          <span className="font-bold ml-2">
                            {(Number(it.price || 0) * it.qty).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-dashed pt-4 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>{lastTransaction.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-rose-600"><span>Discount</span><span>-{lastTransaction.discount.toLocaleString()}</span></div>
                  <div className="flex justify-between font-black text-sm pt-2 border-t mt-2">
                    <span>TOTAL</span>
                    <span>Rp {lastTransaction.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="pt-4 text-[9px] text-slate-500">
                  <p>Payment: <span className="font-bold">{lastTransaction.method}</span></p>
                  <p>Staff: <span className="font-bold">{lastTransaction.staff}</span></p>
                  <p>Customer: <span className="font-bold uppercase">{lastTransaction.customer.name || "GUEST"}</span></p>
                </div>
                <div className="text-center pt-6 italic text-slate-400">Thank you for your purchase</div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-2">
              <button onClick={handlePrint} className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-2xl hover:bg-blue-50 border border-slate-100"><Printer size={16} className="text-blue-600"/><span className="text-[8px] font-black">PRINT</span></button>
              <button onClick={sendWhatsApp} className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-2xl hover:bg-blue-50 border border-slate-100"><Send size={16} className="text-emerald-600"/><span className="text-[8px] font-black">WA</span></button>
              <button onClick={sendEmail} className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-2xl hover:bg-blue-50 border border-slate-100"><Mail size={16} className="text-indigo-600"/><span className="text-[8px] font-black">EMAIL</span></button>
              <button 
                onClick={() => {
                  setShowReceipt(false);       // Tutup struk
                  setDiscountType('percent');   // KEMBALIKAN tipe ke persen
                  setDiscountValue(0);         // RESET nilai diskon ke 0
                  // setCart([]);              // (Opsional) Tambahkan ini jika keranjang belum kosong
                }} 
                className="flex-1 flex flex-col items-center gap-1 p-3 bg-slate-900 rounded-2xl hover:bg-black transition-colors text-white"
              >
                <X size={16}/>
                <span className="text-[8px] font-black uppercase">CLOSE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PILIH SIZE */}
      {sizeModal.show && sizeModal.product && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 w-full max-w-md">
      
            {/* Header Modal */}
            <div className="flex justify-between items-center mb-6 text-white">
              <h2 className="font-black uppercase">{sizeModal.product[0]?.Item || "Pilih Ukuran"}</h2>
              <button
                onClick={() => setSizeModal({show: false, product: null})}
                className="text-slate-500 hover:text-white"
              >
                <X />
              </button>
            </div>

            {/* 1. SISIPKAN INPUT DISKON DI SINI (Sebelum List Size) */}
            <div className="mb-6 p-4 bg-slate-900/50 rounded-[2rem] border border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Discount</span>
                <div className="flex bg-slate-800 rounded-xl p-1 shadow-inner">
                  <button 
                    type="button"
                    onClick={() => setItemDiscType('percent')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${itemDiscType === 'percent' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                  > % </button>
                  <button 
                    type="button"
                    onClick={() => setItemDiscType('nominal')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${itemDiscType === 'nominal' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                  > Rp </button>
                </div>
              </div>
              <input 
                type="number"
                value={itemDiscValue}
                onChange={(e) => setItemDiscValue(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full bg-transparent text-white text-right text-xl font-black focus:outline-none"
                placeholder="0"
              />
            </div>

            {/* Grid Size */}
            <div className="grid grid-cols-2 gap-3">
              {Array.isArray(sizeModal.product) && sizeModal.product.map((variant, i) => {
                const stokTersedia = parseInt(variant.Total || variant.Display || 0);

                return (
                  <button
                    key={i}
                    disabled={stokTersedia <= 0}
                    onClick={() => {
                      // 1. Cek jumlah item yang SUDAH ADA di keranjang saat ini
                      const currentItemInCart = cart.find(c => 
                        c.Item === variant.Item && 
                        (c.selectedSize || "").toString().trim().toUpperCase() === (variant.Size || "").toString().trim().toUpperCase() && 
                        (c.color || "").toString().trim() === (variant.Color || "").toString().trim() &&
                        (c.part || "").toString().trim() === (variant.Part || "").toString().trim()
                      );
                      
                      const currentQty = currentItemInCart ? currentItemInCart.qty : 0;

                      // 2. Validasi Batas Stok
                      if (currentQty >= stokTersedia) {
                        alert(`GAGAL: Stok ${variant.Item} (${variant.Size}) terbatas!\n\nMaksimal: ${stokTersedia} pcs\nDi keranjang: ${currentQty} pcs`);
                        return;
                      }

                      // 3. Tambahkan ke keranjang (+1)
                      addToCart(
                        variant, 
                        variant.Part || "", 
                        variant.Color || "", 
                        variant.Size || "", 
                        itemDiscType, 
                        itemDiscValue 
                      );

                      // 4. Reset & Tutup Modal
                      setItemDiscValue(0);
                      setItemDiscType('percent');
                      setSizeModal({show: false, product: null});
                    }}
                    className={`p-4 rounded-2xl border text-sm font-black flex justify-between items-center transition-all ${
                      stokTersedia > 0
                        ? "border-slate-700 hover:border-blue-500 text-white hover:bg-blue-500/10"
                        : "opacity-20 cursor-not-allowed bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span>{variant.Size}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{variant.Color}</span>
                    </div>
                    <span className="text-[10px] text-blue-500">{stokTersedia} pcs</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}