const SUPABASE_URL = 'https://wwawmmnckibtamquillt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YXdtbW5ja2lidGFtcXVpbGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTk1NjEsImV4cCI6MjA5NDM5NTU2MX0.kfc9UXmvm1jfYIhW3vHaKbpEBupu1xurQxlYCKoupPY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const statusForm = document.getElementById('orderStatusForm');
const statusInput = document.getElementById('orderStatusInput');
const statusButton = document.getElementById('orderStatusBtn');
const statusMessage = document.getElementById('orderStatusMessage');
const statusResult = document.getElementById('orderStatusResult');

const statusLabels = {
  Received: 'Received',
  'In Progress': 'In Progress',
  Completed: 'Complete'
};

function esc(value){
  return String(value ?? '').replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

function cleanInvoiceNumber(value){
  return String(value || '').trim().replace(/\s+/g, '');
}

function formatDisplayDate(value){
  if (!value) return 'To be announced';
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}

function dateOnly(value){
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysBetween(start, end){
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

function setMessage(message = '', state = ''){
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (state) statusMessage.classList.add(state);
  statusMessage.hidden = !message;
}

function statusClass(status){
  const normalized = String(status || 'Received').toLowerCase().replace(/\s+/g, '-');
  return `status-pill ${normalized}`;
}

function progressForOrder(row){
  const status = row.status || 'Received';
  if (status === 'Completed') {
    return {
      percent: 100,
      message: 'Your order is complete.'
    };
  }

  const orderDate = dateOnly(row.order_date);
  const pickupDate = dateOnly(row.pickup_date);

  if (!orderDate || !pickupDate) {
    return {
      percent: status === 'In Progress' ? 45 : 15,
      message: 'Pickup date coming soon.'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.max(1, daysBetween(orderDate, pickupDate));
  const elapsedDays = Math.max(0, daysBetween(orderDate, today));
  const timeProgress = Math.min(1, elapsedDays / totalDays);

  if (status === 'In Progress') {
    return {
      percent: Math.round(35 + (timeProgress * 50)),
      message: 'Updates as your pickup date approaches.'
    };
  }

  return {
    percent: Math.round(10 + (timeProgress * 20)),
    message: 'Your order has been received.'
  };
}

function renderOrder(row){
  const rawStatus = row.status || 'Received';
  const label = statusLabels[rawStatus] || rawStatus;
  const progress = progressForOrder(row);

  statusResult.innerHTML = `
    <div class="status-result-top">
      <span class="${esc(statusClass(rawStatus))}">${esc(label)}</span>
      <strong>Invoice ${esc(row.invoice_number || '')}</strong>
    </div>
    <div class="order-progress">
      <div class="order-progress-head">
        <span>Order Progress</span>
        <strong>${esc(progress.percent)}%</strong>
      </div>
      <div class="order-progress-track" aria-label="Order progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${esc(progress.percent)}" role="progressbar">
        <span style="width:${esc(progress.percent)}%"></span>
      </div>
      <p>${esc(progress.message)}</p>
    </div>
    <dl class="status-details">
      <div>
        <dt>Pickup Date</dt>
        <dd>${esc(formatDisplayDate(row.pickup_date))}</dd>
      </div>
      <div>
        <dt>Order Date</dt>
        <dd>${esc(formatDisplayDate(row.order_date))}</dd>
      </div>
      <div>
        <dt>School</dt>
        <dd>${esc(row.school || 'Not listed')}</dd>
      </div>
    </dl>
  `;
  statusResult.hidden = false;
}

async function lookupOrder(event){
  event.preventDefault();
  const invoiceNumber = cleanInvoiceNumber(statusInput.value);

  statusResult.hidden = true;
  statusResult.innerHTML = '';

  if (!invoiceNumber) {
    setMessage('Enter an invoice number to check your order.', 'error');
    statusInput.focus();
    return;
  }

  statusButton.disabled = true;
  setMessage('Checking order status...', 'loading');

  const { data, error } = await supabaseClient
    .rpc('lookup_order_status', { lookup_invoice_number: invoiceNumber });

  statusButton.disabled = false;

  if (error) {
    console.error(error);
    const setupMissing = error.code === 'PGRST202' || String(error.message || '').includes('lookup_order_status');
    setMessage(
      setupMissing
        ? 'Order lookup needs to be enabled before this page can search invoices.'
        : 'Order lookup is unavailable right now. Please call the store for help.',
      'error'
    );
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    setMessage('No order found for that invoice number. Please check the number and try again.', 'error');
    return;
  }

  setMessage('');
  renderOrder(row);
}

statusForm.addEventListener('submit', lookupOrder);
