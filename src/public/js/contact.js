// Contact Form JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contact-form');
  const formMessage = document.getElementById('form-message');
  
  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    
    // Clear previous messages
    formMessage.className = 'form-message';
    formMessage.textContent = '';
    
    try {
      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData.entries());
      
      // Get reCAPTCHA response if available
      if (typeof grecaptcha !== 'undefined') {
        data['g-recaptcha-response'] = grecaptcha.getResponse();
      }
      
      const response = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        formMessage.className = 'form-message success';
        formMessage.textContent = result.message;
        contactForm.reset();
        
        // Reset reCAPTCHA if available
        if (typeof grecaptcha !== 'undefined') {
          grecaptcha.reset();
        }
      } else {
        throw new Error(result.message || 'Failed to send message');
      }
    } catch (err) {
      formMessage.className = 'form-message error';
      
      if (err.message.includes('Validation failed')) {
        formMessage.textContent = 'Please check your input and try again.';
      } else {
        formMessage.textContent = err.message || 'An error occurred. Please try again.';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
  
  // Form validation feedback
  const inputs = contactForm?.querySelectorAll('.input');
  inputs?.forEach(input => {
    input.addEventListener('blur', () => {
      if (input.required && !input.value.trim()) {
        input.classList.add('error');
      } else {
        input.classList.remove('error');
      }
    });
    
    input.addEventListener('input', () => {
      input.classList.remove('error');
    });
  });
});
