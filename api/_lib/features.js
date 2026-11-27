// Switches for anything that reaches people outside the app. Both are OFF unless turned on in the environment,
// so nothing is emailed and no comments are taken until the owner decides to open them up.
//   EMAIL_ON=true      send email through Resend (needs RESEND_API_KEY); off: mail is only written to the outbox table
//   COMMENTS_ON=true   customers and the Studio can read and leave comments; off: the comments API answers 404
const on = name => /^(1|true|yes|on)$/i.test(String(process.env[name] || '').trim());
export const emailOn = () => on('EMAIL_ON');
export const commentsOn = () => on('COMMENTS_ON');
