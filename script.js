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
const skipPayment = document.getElementById('skipPayment');
const buttonText = document.getElementById('buttonText');
const buttonSpinner = document.getElementById('buttonSpinner');
const paymentMessage = document.getElementById('payment-message');

// Calculator state
let currentExpression = '';
let pendingResult = null; // Store the result until payment is complete
let stripe = null;
let elements = null;
let paymentElement = null;

// Initialize
function init() {
  // Initialize Stripe
  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

  // Number and operator buttons
  document.querySelectorAll('.btn[data-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      appendToExpression(btn.dataset.value);
    });
  });

  // Equals button
  equalsBtn.addEventListener('click', calculate);

  // Clear button
  clearBtn.addEventListener('click', clearAll);

  // Input field sync
  expressionInput.addEventListener('input', (e) => {
    currentExpression = e.target.value;
    updateDisplay();
  });

  // Enter key to calculate
  expressionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      calculate();
    }
  });

  // Payment button
  paymentButton.addEventListener('click', handlePayment);

  // Skip payment button
  skipPayment.addEventListener('click', () => {
    hidePaymentModal();
    showResult('結果を見るには課金が必要です 💸', true);
  });
}

// Append value to expression
function appendToExpression(value) {
  currentExpression += value;
  expressionInput.value = currentExpression;
  updateDisplay();
}

// Update display
function updateDisplay() {
  display.textContent = currentExpression || '0';
}

// Clear everything
function clearAll() {
  currentExpression = '';
  expressionInput.value = '';
  display.textContent = '0';
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

  // Show thinking state
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
      // Store the result and show payment modal instead!
      pendingResult = data.result;
      showPaymentModal();
    }
  } catch (error) {
    thinking.classList.remove('active');
    showResult('エラーが発生しました。もう一度お試しください。', true);
    console.error('Calculation error:', error);
  }
}

// Show payment modal
async function showPaymentModal() {
  paymentOverlay.classList.add('active');
  paymentMessage.textContent = '';

  try {
    // Create PaymentIntent on the server
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

    // Create Stripe Elements
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

    // Create and mount the Payment Element
    paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
  } catch (error) {
    console.error('Payment setup error:', error);
    paymentMessage.textContent = '決済の準備に失敗しました';
  }
}

// Hide payment modal
function hidePaymentModal() {
  paymentOverlay.classList.remove('active');
  if (paymentElement) {
    paymentElement.destroy();
    paymentElement = null;
  }
}

// Handle payment submission
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
      // Payment successful! Show the result
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

// Set loading state
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

// Show result
function showResult(message, isError) {
  result.textContent = message;
  result.className = 'result active' + (isError ? ' error' : '');
}

// Start the app
init();
