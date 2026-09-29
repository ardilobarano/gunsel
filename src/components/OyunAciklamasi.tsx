/**
 * Oyun sayfalarının altındaki kısa tanıtım metni.
 *
 * Neden var: oyunlar tamamen tarayıcıda çiziliyor (dynamic ssr:false), yani
 * sunucunun döndürdüğü HTML'de oyun arayüzünden HİÇ iz yok. Ölçüldü — /kelimesel
 * 67, /haritasal 46 karakter metin içeriyordu. Arama motoru boş bir sayfayı
 * sıralayamaz. Bu blok sayfaya gerçek, okunabilir içerik veriyor.
 *
 * Oyunun ALTINDA duruyor: sayfa h-dvh olduğu için oyun ekranı doldurmaya devam
 * ediyor, metin ancak kaydırınca görünüyor. Yani oynama deneyimi değişmiyor.
 */
export default function OyunAciklamasi({
  baslik,
  paragraflar,
}: {
  baslik: string;
  paragraflar: string[];
}) {
  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-8 pb-10">
      <h2 className="mb-2 text-sm font-bold text-text-main">{baslik}</h2>
      {paragraflar.map((p) => (
        <p key={p} className="mb-2 text-sm leading-relaxed text-text-muted">
          {p}
        </p>
      ))}
    </section>
  );
}
