const resultDisplay = document.querySelector('#result');
const expressionDisplay = document.querySelector('#expression');

let current = '0';
let stored = null;
let operator = null;
let replaceCurrent = false;
let expression = '';

function render() {
  resultDisplay.textContent = current;
  expressionDisplay.textContent = expression || '\u00a0';
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Number(value.toPrecision(10));
  return String(rounded);
}

function inputDigit(digit) {
  if (current === 'Error' || replaceCurrent) {
    current = digit;
    replaceCurrent = false;
  } else if (current === '0') {
    current = digit;
  } else if (current.replace('-', '').replace('.', '').length < 12) {
    current += digit;
  }
  render();
}

function chooseOperator(nextOperator) {
  if (current === 'Error') return;
  if (operator && !replaceCurrent) calculate();
  stored = Number(current);
  operator = nextOperator;
  expression = `${current} ${operator}`;
  replaceCurrent = true;
  render();
}

function calculate() {
  if (operator === null || stored === null || current === 'Error') return;
  const left = stored;
  const right = Number(current);
  let value;
  switch (operator) {
    case '+': value = left + right; break;
    case '−': value = left - right; break;
    case '×': value = left * right; break;
    case '÷': value = right === 0 ? NaN : left / right; break;
    default: return;
  }
  expression = `${formatNumber(left)} ${operator} ${formatNumber(right)} =`;
  current = formatNumber(value);
  stored = null;
  operator = null;
  replaceCurrent = true;
  render();
}

function clear() {
  current = '0'; stored = null; operator = null; replaceCurrent = false; expression = '';
  render();
}

function handleAction(action) {
  if (action === 'clear') clear();
  if (action === 'equals') calculate();
  if (action === 'decimal' && current !== 'Error') {
    if (replaceCurrent) { current = '0'; replaceCurrent = false; }
    if (!current.includes('.')) current += '.';
    render();
  }
  if (action === 'sign' && current !== 'Error') {
    current = formatNumber(-Number(current));
    render();
  }
  if (action === 'percent' && current !== 'Error') {
    current = formatNumber(Number(current) / 100);
    render();
  }
}

document.querySelector('.keypad').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.digit !== undefined) inputDigit(button.dataset.digit);
  else if (button.dataset.operator) chooseOperator(button.dataset.operator);
  else handleAction(button.dataset.action);
});

document.addEventListener('keydown', (event) => {
  if (/^[0-9]$/.test(event.key)) inputDigit(event.key);
  else if (event.key === '.') handleAction('decimal');
  else if (event.key === '+') chooseOperator('+');
  else if (event.key === '-') chooseOperator('−');
  else if (event.key === '*') chooseOperator('×');
  else if (event.key === '/') { event.preventDefault(); chooseOperator('÷'); }
  else if (event.key === 'Enter' || event.key === '=') calculate();
  else if (event.key === 'Escape') clear();
  else if (event.key === 'Backspace') {
    if (!replaceCurrent && current !== 'Error') current = current.length > 1 ? current.slice(0, -1) : '0';
    render();
  }
});

render();
