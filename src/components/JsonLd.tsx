/**
 * Yapısal veriyi <script type="application/ld+json"> olarak basar.
 *
 * `<` karakteri `<`'ye çevriliyor: veri bir gün kullanıcı girdisi taşırsa
 * içindeki bir `</script>` dizisi script'i erkenden kapatıp XSS'e yol açardı.
 * Next.js'in kendi JSON-LD rehberinin önerdiği korunma bu. Şu an beslediğimiz
 * veri tamamen statik, ama kaçış bileşenin İÇİNDE duruyor ki her çağrı yerinde
 * yeniden düşünmek gerekmesin.
 *
 * `next/script` değil düz `<script>`: JSON-LD çalıştırılabilir kod değil, veri.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
