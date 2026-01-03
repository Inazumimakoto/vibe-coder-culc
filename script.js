// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SlPkKAdKBClfnbwwwgclWDkim8nBHeiHPbmNtkCbCxodj4Hyz51NXJhwAqJQJIgRf1HBbGYo5Ywzl7yWexhI1Sb00WnuzadRd';

// DOM Elements
const display = document.getElementById('display');
const expressionInput = document.getElementById('expression');
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
let pendingResult = null;
let stripe = null;
let elements = null;
let paymentElement = null;

// Evil close button state
let closeButtonHoverCount = 0;
let closeButtonSize = 24;

// Initialize
function init() {
  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

  document.querySelectorAll('.btn[data-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      appendToExpression(btn.dataset.value);
    });
  });

  equalsBtn.addEventListener('click', calculate);
  clearBtn.addEventListener('click', clearAll);

  expressionInput.addEventListener('input', (e) => {
    currentExpression = e.target.value;
    updateDisplay();
  });

  expressionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      calculate();
    }
  });

  paymentButton.addEventListener('click', handlePayment);

  // Evil close button - moves and shrinks!
  evilCloseBtn.addEventListener('mouseenter', handleEvilButtonHover);
  evilCloseBtn.addEventListener('click', handleEvilButtonClick);
}

// Evil close button hover - make it run away!
function handleEvilButtonHover() {
  closeButtonHoverCount++;

  // Get modal dimensions
  const modal = document.querySelector('.payment-modal');
  const modalRect = modal.getBoundingClientRect();
  const btnRect = evilCloseBtn.getBoundingClientRect();

  // Random position within the modal
  const maxX = modalRect.width - btnRect.width - 20;
  const maxY = modalRect.height - btnRect.height - 20;

  const randomX = Math.floor(Math.random() * maxX) + 10;
  const randomY = Math.floor(Math.random() * maxY) + 10;

  // Move the button
  evilCloseBtn.style.position = 'absolute';
  evilCloseBtn.style.left = randomX + 'px';
  evilCloseBtn.style.top = randomY + 'px';

  // Shrink the button after every 2 hovers
  if (closeButtonHoverCount % 2 === 0 && closeButtonSize > 12) {
    closeButtonSize -= 2;
    evilCloseBtn.style.width = closeButtonSize + 'px';
    evilCloseBtn.style.height = closeButtonSize + 'px';
    evilCloseBtn.style.fontSize = (closeButtonSize * 0.6) + 'px';
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
    'もうちょっと！'
  ];

  if (closeButtonHoverCount <= 8) {
    paymentMessage.textContent = taunts[closeButtonHoverCount - 1] || taunts[0];
    paymentMessage.style.color = '#ff9500';
  }
}

// Evil close button click - finally let them close it
function handleEvilButtonClick() {
  hidePaymentModal();

  // Show the result! They earned it.
  if (pendingResult) {
    showResult('😅 お疲れ様！ようやく見れたね！\n\n' + pendingResult, false);
    pendingResult = null;
  }

  // Reset evil button state for next time
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

function appendToExpression(value) {
  currentExpression += value;
  expressionInput.value = currentExpression;
  updateDisplay();
}

function updateDisplay() {
  display.textContent = currentExpression || '0';
}

function clearAll() {
  currentExpression = '';
  expressionInput.value = '';
  display.textContent = '0';
  result.className = 'result';
  result.textContent = '';
  thinking.classList.remove('active');
  pendingResult = null;
}

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
      pendingResult = data.result;
      showPaymentModal();
    }
  } catch (error) {
    thinking.classList.remove('active');
    showResult('エラーが発生しました。もう一度お試しください。', true);
    console.error('Calculation error:', error);
  }
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
      showResult('💎 Pro会員様、ようこそ！\n\n' + pendingResult, false);
      pendingResult = null;
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
