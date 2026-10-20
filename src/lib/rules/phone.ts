/** Malaysian phone helpers. Numbers are stored as E.164 (+60...). */

export function normaliseMyPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "60" + digits.slice(1);
  else if (digits.startsWith("1")) digits = "60" + digits; // mobile typed without the leading 0

  // Malaysia: 60 + 8-10 digits (mobile 9-10, landline 8-9).
  return /^60[1-9]\d{7,9}$/.test(digits) ? `+${digits}` : null;
}

/** wa.me link with a pre-filled message. */
export function whatsappLink(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function formatMyPhone(e164: string): string {
  const m = /^\+60(\d{2,3})(\d{3,4})(\d{4})$/.exec(e164);
  return m ? `0${m[1]}-${m[2]} ${m[3]}` : e164;
}
