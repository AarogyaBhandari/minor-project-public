const API_URL = 'http://localhost:5000/api/auctions';
let currentAuction = null;
let countdownInterval = null;

async function loadAuctionDetails() {
  const params = new URLSearchParams(window.location.search);
  const auctionId = params.get('id');

  if (!auctionId) {
    showError('No auction ID provided');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${auctionId}`);
    if (!response.ok) throw new Error('Failed to load auction');

    currentAuction = await response.json();
    displayAuctionDetails(currentAuction);
    startCountdownTimer();
    
    // Refresh auction details every 10 seconds
    setInterval(refreshAuctionDetails, 10000);
  } catch (err) {
    console.error('Error loading auction:', err);
    showError('Failed to load auction details');
  }
}

function displayAuctionDetails(auction) {
  document.getElementById('auction-loading').style.display = 'none';
  document.getElementById('auction-detail-container').style.display = 'block';

  // Image
  const imgElement = document.getElementById('auction-detail-image');
  const noImageIcon = document.getElementById('no-image-icon');
  if (auction.imageUrl) {
    imgElement.src = auction.imageUrl;
    imgElement.style.display = 'block';
    noImageIcon.style.display = 'none';
  } else {
    noImageIcon.style.display = 'block';
    imgElement.style.display = 'none';
  }

  document.getElementById('auction-title').textContent = auction.title;
  document.getElementById('auction-price').textContent = `Rs${auction.currentPrice.toFixed(2)}`;
  document.getElementById('auction-seller').textContent = auction.seller || 'Unknown';
  document.getElementById('auction-category').textContent = auction.category || 'N/A';
  document.getElementById('auction-subcategory').textContent = auction.subcategory || 'N/A';
  document.getElementById('auction-era').textContent = auction.eraPeriod || 'N/A';
  document.getElementById('auction-description').textContent = auction.description || 'No description provided';
  document.getElementById('auction-bids-count').textContent = auction.bids.length;

  // Update bid section based on auction status
  const bidSection = document.getElementById('bid-section');
  if (auction.status === 'ended') {
    bidSection.innerHTML = '<p style="color: #999; font-size: 16px;"><i class="fas fa-check-circle"></i> This auction has ended.</p>';
  } else {
    updateBidsHistory(auction.bids);
  }
}

function startCountdownTimer() {
  updateCountdownDisplay();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function updateCountdownDisplay() {
  if (!currentAuction) return;

  const now = new Date().getTime();
  const end = new Date(currentAuction.endTime).getTime();
  const distance = end - now;

  const timerSpan = document.getElementById('countdown-timer');

  if (distance < 0) {
    timerSpan.textContent = 'Ended';
    if (countdownInterval) clearInterval(countdownInterval);
    document.getElementById('bid-section').innerHTML = '<p style="color: #999; font-size: 16px;"><i class="fas fa-check-circle"></i> This auction has ended.</p>';
    return;
  }

  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  timerSpan.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function refreshAuctionDetails() {
  if (!currentAuction) return;

  try {
    const response = await fetch(`${API_URL}/${currentAuction._id}/refresh`);
    if (!response.ok) return;

    const updated = await response.json();
    currentAuction.currentPrice = updated.currentPrice;
    currentAuction.highestBidder = updated.highestBidder;
    currentAuction.status = updated.status;

    document.getElementById('auction-price').textContent = `Rs${updated.currentPrice.toFixed(2)}`;
    document.getElementById('auction-bids-count').textContent = updated.bidsCount;
  } catch (err) {
    console.error('Error refreshing auction:', err);
  }
}

function updateBidsHistory(bids) {
  const container = document.getElementById('bids-history');

  if (bids.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999;">No bids yet. Be the first to bid!</p>';
    return;
  }

  container.innerHTML = bids
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .map(bid => `
      <div class="bid-item">
        <div>
          <strong style="color: #666;">Bid ${bids.indexOf(bid) + 1}</strong><br>
          <span class="bid-item-time">${new Date(bid.time).toLocaleString()}</span>
        </div>
        <div class="bid-item-amount">Rs${bid.amount.toFixed(2)}</div>
      </div>
    `)
    .join('');
}

async function placeBid() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    showAlert('Please log in to place a bid', 'error');
    return;
  }

  const bidAmount = parseFloat(document.getElementById('bid-amount').value);

  if (isNaN(bidAmount) || bidAmount <= 0) {
    showAlert('Please enter a valid bid amount', 'error');
    return;
  }

  if (bidAmount <= currentAuction.currentPrice) {
    showAlert(`Bid must be higher than Rs${currentAuction.currentPrice.toFixed(2)}`, 'error');
    return;
  }

  try {
    const button = document.getElementById('bid-button');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing bid...';

    const response = await fetch(`${API_URL}/${currentAuction._id}/bid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ bidAmount })
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.message || 'Failed to place bid', 'error');
      button.disabled = false;
      button.innerHTML = 'Place Bid';
      return;
    }

    currentAuction = data.auction;
    displayAuctionDetails(currentAuction);
    document.getElementById('bid-amount').value = '';
    showAlert('Bid placed successfully!', 'success');

    button.disabled = false;
    button.innerHTML = 'Place Bid';
  } catch (err) {
    console.error('Error placing bid:', err);
    showAlert('Failed to place bid. Please try again.', 'error');
    const button = document.getElementById('bid-button');
    button.disabled = false;
    button.innerHTML = 'Place Bid';
  }
}

function showAlert(message, type) {
  const alertDiv = document.getElementById('auction-alert');
  alertDiv.className = `alert ${type}`;
  alertDiv.textContent = message;
  alertDiv.style.display = 'block';

  setTimeout(() => {
    alertDiv.style.display = 'none';
  }, 5000);
}

function showError(message) {
  document.getElementById('auction-loading').innerHTML = `<div style="color: #d32f2f; font-size: 18px;"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
}

document.addEventListener('DOMContentLoaded', loadAuctionDetails);
