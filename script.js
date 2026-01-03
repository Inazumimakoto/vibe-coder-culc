// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SlPkKAdKBClfnbwwwgclWDkim8nBHeiHPbmNtkCbCxodj4Hyz51NXJhwAqJQJIgRf1HBbGYo5Ywzl7yWexhI1Sb00WnuzadRd';

// DOM Elements
const display = document.getElementById('display');
const equalsBtn = document.getElementById('equalsBtn');
const clearBtn = document.getElementById('clearBtn');
const thinking = document.getElementById('thinking');
const thinkingText = document.getElementById('thinkingText');
const modelSelector = document.getElementById('modelSelector');
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
const MAX_HOVER_COUNT = 10;

// Initialize
function init() {
  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

  document.querySelectorAll('.btn[data-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleButtonClick(btn.dataset.value);
    });
  });

  equalsBtn.addEventListener('click', calculate);
  clearBtn.addEventListener('click', clearAll);

  evilCloseBtn.addEventListener('mouseenter', handleEvilButtonHover);
  evilCloseBtn.addEventListener('touchstart', (e) => {
    if (closeButtonHoverCount < MAX_HOVER_COUNT) {
      handleEvilButtonHover(e);
    }
  });
  evilCloseBtn.addEventListener('click', handleEvilButtonClick);
}

function handleButtonClick(value) {
  if (value === '±') {
    if (currentExpression.startsWith('-')) {
      currentExpression = currentExpression.slice(1);
    } else if (currentExpression && currentExpression !== '0') {
      currentExpression = '-' + currentExpression;
    }
  } else if (value === '%') {
    if (currentExpression) {
      const num = parseFloat(currentExpression);
      currentExpression = String(num / 100);
    }
  } else {
    if (currentExpression === '0' && value !== '.') {
      currentExpression = value;
    } else {
      currentExpression += value;
    }
  }
  updateDisplay();
}

function updateDisplay() {
  let displayText = currentExpression || '0';

  if (displayText.length > 12) {
    display.style.fontSize = '3rem';
  } else if (displayText.length > 9) {
    display.style.fontSize = '4rem';
  } else {
    display.style.fontSize = '';
  }

  display.textContent = displayText;
}

function clearAll() {
  currentExpression = '';
  display.textContent = '0';
  display.style.fontSize = '';
  thinking.classList.remove('active');
  pendingResult = null;
}

async function calculate() {
  const expression = currentExpression.trim();

  if (!expression) {
    return;
  }

  // Show thinking with model name
  const selectedModel = modelSelector.value;
  const modelDisplayName = modelSelector.options[modelSelector.selectedIndex].text;
  thinkingText.textContent = `${modelDisplayName} が計算中...`;
  thinking.classList.add('active');

  try {
    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expression, model: selectedModel }),
    });

    const data = await response.json();
    thinking.classList.remove('active');

    if (data.error) {
      display.textContent = 'Error';
    } else {
      pendingResult = data.result.trim();
      showPaymentModal();
    }
  } catch (error) {
    thinking.classList.remove('active');
    display.textContent = 'Error';
    console.error('Calculation error:', error);
  }
}

function handleEvilButtonHover(e) {
  if (e.type === 'touchstart') {
    e.preventDefault();
  }

  if (closeButtonHoverCount >= MAX_HOVER_COUNT) {
    return;
  }

  closeButtonHoverCount++;

  const modal = document.querySelector('.payment-modal');
  const modalRect = modal.getBoundingClientRect();
  const btnRect = evilCloseBtn.getBoundingClientRect();

  const maxX = modalRect.width - btnRect.width - 20;
  const maxY = modalRect.height - btnRect.height - 20;

  const randomX = Math.floor(Math.random() * maxX) + 10;
  const randomY = Math.floor(Math.random() * maxY) + 10;

  evilCloseBtn.style.position = 'absolute';
  evilCloseBtn.style.left = randomX + 'px';
  evilCloseBtn.style.top = randomY + 'px';

  if (closeButtonHoverCount % 2 === 0 && closeButtonSize > 14) {
    closeButtonSize -= 2;
    evilCloseBtn.style.width = closeButtonSize + 'px';
    evilCloseBtn.style.height = closeButtonSize + 'px';
    evilCloseBtn.style.fontSize = (closeButtonSize * 0.5) + 'px';
  }
}

function handleEvilButtonClick() {
  hidePaymentModal();

  if (pendingResult) {
    currentExpression = pendingResult;
    updateDisplay();
    pendingResult = null;
  }

  resetEvilButton();
}

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

      if (pendingResult) {
        currentExpression = pendingResult;
        updateDisplay();
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

init();
