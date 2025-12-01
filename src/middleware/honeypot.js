/**
 * Honeypot middleware
 * Adds a hidden field that bots will fill out, humans won't
 */
const honeypot = (req, res, next) => {
  // Check if the honeypot field was filled (bots fill all fields)
  if (req.body && req.body._hp_field && req.body._hp_field.trim() !== '') {
    console.log(`[HONEYPOT] Bot detected from IP: ${req.clientIp || req.ip}`);
    // Pretend success to not alert bots
    return res.render('form-success', {
      title: 'Thank You',
      message: 'Your submission has been received.',
      formType: 'submission'
    });
  }
  next();
};

/**
 * Helper function to add honeypot field to forms
 */
const getHoneypotField = () => {
  return `<div style="position: absolute; left: -9999px; opacity: 0; height: 0; overflow: hidden;" aria-hidden="true">
    <label for="_hp_field">Leave this field empty</label>
    <input type="text" name="_hp_field" id="_hp_field" tabindex="-1" autocomplete="off">
  </div>`;
};

module.exports = { honeypot, getHoneypotField };
