// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SlPkKAdKBClfnbwwwgclWDkim8nBHeiHPbmNtkCbCxodj4Hyz51NXJhwAqJQJIgRf1HBbGYo5Ywzl7yWexhI1Sb00WnuzadRd';

// DOM Elements
const display = document.getElementById('display');
const equalsBtn = document.getElementById('equalsBtn');
const clearBtn = document.getElementById('clearBtn');
const thinking = document.getElementById('thinking');
const result = document.getElementById('result');
const paymentOverlay = document.getElementById('paymentOverlay');
const paymentButton = document.getElementById('paymentButton');
const evilCloseBtn = document.getElementById('evilCloseBtn');
const buttonText = document.getElementById('buttonText');
const buttonSpinner = document.getElementById('buttonSpinner');
const paymentMessage = document.getElementById('payment-message');

// Calculator state
let currentExpression = '';
let pendingResult = null; // Object: { value, comment }
let stripe = null;
let elements = null;
let paymentElement = null;

// Evil close button state
let closeButtonHoverCount = 0;
let closeButtonSize = 24;
const MAX_HOVER_COUNT = 10;

// Initialize
function init() {
  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

  // Number and operator buttons
  document.querySelectorAll('.btn[data-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleButtonClick(btn.dataset.value);
    });
  });

  equalsBtn.addEventListener('click', calculate);
  clearBtn.addEventListener('click', clearAll);

  // Evil close button - moves and shrinks (max 10 times)
  evilCloseBtn.addEventListener('mouseenter', handleEvilButtonHover);

  // Mobile support: Only prevent default if we seek to move the button
  evilCloseBtn.addEventListener('touchstart', (e) => {
    if (closeButtonHoverCount < MAX_HOVER_COUNT) {
      handleEvilButtonHover(e);
    }
    // If count >= MAX, we let the default click happen
  });

  evilCloseBtn.addEventListener('click', handleEvilButtonClick);
}

// Handle button click
function handleButtonClick(value) {
  if (value === '±') {
    // Toggle positive/negative
    if (currentExpression.startsWith('-')) {
      currentExpression = currentExpression.slice(1);
    } else if (currentExpression && currentExpression !== '0') {
      currentExpression = '-' + currentExpression;
    }
  } else if (value === '%') {
    // Percentage
    if (currentExpression) {
      const num = parseFloat(currentExpression);
      currentExpression = String(num / 100);
    }
  } else {
    // Regular input
    if (currentExpression === '0' && value !== '.') {
      currentExpression = value;
    } else {
      currentExpression += value;
    }
  }
  updateDisplay();
}

// Update display
function updateDisplay() {
  // Format for display
  let displayText = currentExpression || '0';

  // Limit display length
  if (displayText.length > 12) {
    display.style.fontSize = '3rem';
  } else if (displayText.length > 9) {
    display.style.fontSize = '4rem';
  } else {
    display.style.fontSize = '';
  }

  display.textContent = displayText;
}

// Clear everything
function clearAll() {
  currentExpression = '';
  display.textContent = '0';
  display.style.fontSize = '';
  result.className = 'result';
  result.textContent = '';
  thinking.classList.remove('active');
  pendingResult = null;
}

// Calculate using Gemini API
async function calculate() {
  const expression = currentExpression.trim();

  if (!expression) {
    showResult('数式を入力してください！', true);
    return;
  }

  thinking.classList.add('active');
  result.className = 'result';
  result.textContent = '';

  try {
    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expression }),
    });

    const data = await response.json();
    thinking.classList.remove('active');

    if (data.error) {
      showResult(data.error, true);
    } else {
      // Parse JSON result from Gemini (it might be a string containing JSON)
      let parsedResult;
      try {
        // Handle case where Gemini returns Markdown code block
        const cleanJson = data.result.replace(/```json\n|\n```/g, '').replace(/```/g, '');
        parsedResult = JSON.parse(cleanJson);
      } catch (e) {
        // Fallback for plain text response
        console.warn('Failed to parse JSON, using raw text', e);
        parsedResult = { value: data.result, comment: '' };
      }

      pendingResult = parsedResult;
      showPaymentModal();
    }
  } catch (error) {
    thinking.classList.remove('active');
    showResult('エラーが発生しました。もう一度お試しください。', true);
    console.error('Calculation error:', error);
  }
}

// Evil close button hover - make it run away (max 10 times)
function handleEvilButtonHover(e) {
  // Prevent default only if we are moving the button to avoid accidental clicks
  // But on touchstart we often want to prevent default to stop scrolling/clicking
  if (e.type === 'touchstart') {
    e.preventDefault();
  }

  // Stop running away after 10 times
  if (closeButtonHoverCount >= MAX_HOVER_COUNT) {
    return;
  }

  closeButtonHoverCount++;

  const modal = document.querySelector('.payment-modal');
  const modalRect = modal.getBoundingClientRect();
  const btnRect = evilCloseBtn.getBoundingClientRect();

  // Random position within the modal
  const maxX = modalRect.width - btnRect.width - 20;
  const maxY = modalRect.height - btnRect.height - 20;

  const randomX = Math.floor(Math.random() * maxX) + 10;
  const randomY = Math.floor(Math.random() * maxY) + 10;

  evilCloseBtn.style.position = 'absolute';
  evilCloseBtn.style.left = randomX + 'px';
  evilCloseBtn.style.top = randomY + 'px';

  // Shrink the button after every 2 hovers
  if (closeButtonHoverCount % 2 === 0 && closeButtonSize > 14) {
    closeButtonSize -= 2;
    evilCloseBtn.style.width = closeButtonSize + 'px';
    evilCloseBtn.style.height = closeButtonSize + 'px';
    evilCloseBtn.style.fontSize = (closeButtonSize * 0.5) + 'px';
  }

  // Taunt messages
  const taunts = [
    'あれ？どこ行った？',
    '逃げちゃった😜',
    'もう少し頑張って！',
    '課金した方が早いよ？',
    'そっちじゃないよ〜',
    '小さくなっちゃった...',
    'Pro会員になろう！',
    'もうちょっと！',
    'あと少し！',
    'OK、諦めた...😔'
  ];

  paymentMessage.textContent = taunts[Math.min(closeButtonHoverCount - 1, taunts.length - 1)];
  paymentMessage.style.color = '#ff9500';
}

// Evil close button click
function handleEvilButtonClick() {
  hidePaymentModal();

  if (pendingResult) {
    // Show standard result in display
    currentExpression = String(pendingResult.value);
    updateDisplay();

    // Show comment in the result area if exists
    if (pendingResult.comment) {
      showResult(pendingResult.comment, false);
    }

    pendingResult = null;
  }

  resetEvilButton();
}

// Reset evil button
function resetEvilButton() {
  closeButtonHoverCount = 0;
  closeButtonSize = 24;
  evilCloseBtn.style.position = '';
  evilCloseBtn.style.left = '';
  evilCloseBtn.style.top = '';
  evilCloseBtn.style.width = '';
  evilCloseBtn.style.height = '';
  evilCloseBtn.style.fontSize = '';
}

async function showPaymentModal() {
  paymentOverlay.classList.add('active');
  paymentMessage.textContent = '';
  paymentMessage.style.color = '';
  resetEvilButton();

  try {
    const response = await fetch('/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { clientSecret, error } = await response.json();

    if (error) {
      paymentMessage.textContent = error;
      return;
    }

    elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#ff9500',
          borderRadius: '8px',
        },
      },
    });

    paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
  } catch (error) {
    console.error('Payment setup error:', error);
    paymentMessage.textContent = '決済の準備に失敗しました';
  }
}

function hidePaymentModal() {
  paymentOverlay.classList.remove('active');
  if (paymentElement) {
    paymentElement.destroy();
    paymentElement = null;
  }
}

async function handlePayment() {
  if (!stripe || !elements) {
    paymentMessage.textContent = '決済システムの読み込み中です...';
    return;
  }

  setLoading(true);
  paymentMessage.textContent = '';

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      paymentMessage.textContent = error.message;
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      hidePaymentModal();

      // Show result after payment
      if (pendingResult) {
        currentExpression = String(pendingResult.value);
        updateDisplay();
        showResult('💎 Pro会員様、ようこそ！\n\n' + pendingResult.comment, false);
        pendingResult = null;
      }
    }
  } catch (error) {
    console.error('Payment error:', error);
    paymentMessage.textContent = '決済処理中にエラーが発生しました';
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    paymentButton.disabled = true;
    buttonText.classList.add('hidden');
    buttonSpinner.classList.remove('hidden');
  } else {
    paymentButton.disabled = false;
    buttonText.classList.remove('hidden');
    buttonSpinner.classList.add('hidden');
  }
}

function showResult(message, isError) {
  result.textContent = message;
  result.className = 'result active' + (isError ? ' error' : '');
}

init();
