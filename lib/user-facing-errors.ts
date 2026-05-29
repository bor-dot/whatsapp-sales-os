export function userFacingError(message: string | null | undefined) {
  const text = (message ?? "").toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }

  if (text.includes("email not confirmed")) {
    return "E-posta adresi henüz doğrulanmadı.";
  }

  if (text.includes("user already registered") || text.includes("already registered")) {
    return "Bu e-posta ile daha önce kayıt oluşturulmuş.";
  }

  if (text.includes("password")) {
    return "Şifre kabul edilmedi. Daha güçlü bir şifre dene.";
  }

  if (text.includes("row-level security") || text.includes("permission")) {
    return "Bu işlem için yetkin yok.";
  }

  if (text.includes("duplicate key")) {
    return "Bu kayıt zaten mevcut.";
  }

  if (text.includes("organization_id")) {
    return "Merkez bilgisi eksik. Aktif merkezi seçip tekrar dene.";
  }

  if (text.includes("invalid path specified")) {
    return "İstek yolu geçersiz. Supabase bağlantı ayarlarını kontrol et.";
  }

  return "İşlem tamamlanamadı. Bilgileri kontrol edip tekrar dene.";
}
