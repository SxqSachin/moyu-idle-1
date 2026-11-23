export default defineEventHandler(async (event) => {
  const { token } = await readBody(event);

  const formdata = new FormData();
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: "reCAPTCHA is not configured" });
  }
  formdata.append("secret", secret);
  formdata.append("response", token);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: formdata,
    redirect: "follow",
  });

  let json = await res.json();

  return json;
});
