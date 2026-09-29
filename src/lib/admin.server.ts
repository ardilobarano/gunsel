import "server-only";
import { auth } from "../../auth";

/**
 * Önizleme sayfası GÜNÜN CEVAPLARINI (yarınınkiler dahil) açık açık gösteriyor —
 * bu yüzden erişim izin listesindeki e-postalarla sınırlı.
 *
 * ADMIN_EMAILS tanımlı DEĞİLSE hiç kimse giremez (fail-closed). Yanlışlıkla env
 * eksik kalırsa sayfanın herkese açılmaması için kasıtlı olarak böyle.
 */
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const admins = getAdminEmails();
  if (admins.length === 0) return false;

  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && admins.includes(email);
}
