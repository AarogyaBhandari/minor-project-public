const API_URL = 'http://localhost:5000/api/auctions';
let sellerAuctions = [];
let countdownIntervals = {};

async function loadSellerAuctions() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      showNoAuctions('Please log in to view your auctions');
      return;
    }

    const response = await fetch(API_URL + '/seller/my-auctions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        showNoAuctions('Please log in to view your auctions');
      } else {
        throw new Error('Failed to fetch auctions');
      }
      return;
    }

    sellerAuctions = await response.json();
    displayAuctions(sellerAuctions);
  } catch (err) {
    console.error('Error loading auctions:', err);
    showNoAuctions('Failed to load your auctions. Please try again.');
  }
}

function displayAuctions(auctions) {
  const section = document.getElementById('auctions-section');
  
  if (auctions.length === 0) {
    showNoAuctions('You haven\'t created any auctions yet. Click "Create Auction" to get started!');
    return;
  }

  section.innerHTML = auctions.map(auction => `
    <div class="auction-card">
      ${auction.imageUrl ? `<img src="${auction.imageUrl}" alt="${auction.title}" class="auction-image" />` : '<div class="auction-image" style="display: flex; align-items: center; justify-content: center; color: #999;"><i class="fas fa-image"></i></div>'}
      <div class="auction-info">
        <div class="auction-status ${auction.status === 'ended' ? 'ended' : ''}">
          ${auction.status.toUpperCase()}
        </div>
        <div class="auction-title">${auction.title}</div>
        <div class="auction-price">Rs${auction.currentPrice.toFixed(2)}</div>
        ${auction.status === 'active' ? `
          <div class="auction-countdown" id="countdown-${auction._id}">
            <i class="fas fa-clock"></i> <span id="time-${auction._id}">--:--:--</span>
          </div>
        ` : ''}
        <div class="auction-bids">${auction.bids.length} bids</div>
        <div class="action-buttons">
          <button class="view-button" onclick="viewAuction('${auction._id}')">View</button>
          ${auction.status === 'active' && auction.bids.length === 0 ? `<button class="edit-button" onclick="editAuction('${auction._id}')">Edit</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Start countdown timers
  auctions.forEach(auction => {
    if (auction.status === 'active') {
      updateCountdown(auction._id, auction.endTime);
      if (countdownIntervals[auction._id]) clearInterval(countdownIntervals[auction._id]);
      countdownIntervals[auction._id] = setInterval(() => {
        updateCountdown(auction._id, auction.endTime);
      }, 1000);
    }
  });
}

function updateCountdown(auctionId, endTime) {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const distance = end - now;

  const timeSpan = document.getElementById(`time-${auctionId}`);
  if (!timeSpan) return;

  if (distance < 0) {
    timeSpan.textContent = 'Ended';
    if (countdownIntervals[auctionId]) clearInterval(countdownIntervals[auctionId]);
    return;
  }

  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  timeSpan.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function viewAuction(auctionId) {
  window.location.href = `seller-auction-details.html?id=${auctionId}`;
}

function editAuction(auctionId) {
  // Store the auction ID in sessionStorage so seller-dashboard can access it
  sessionStorage.setItem('editingAuctionId', auctionId);
  // Redirect to seller-dashboard with edit mode
  window.location.href = 'seller-dashboard.html?edit=' + auctionId;
}

function showNoAuctions(message) {
  const section = document.getElementById('auctions-section');
  section.innerHTML = `<div id="no-auctions"><h3>${message}</h3></div>`;
}

document.getElementById('create-auction-btn').addEventListener('click', () => {
  window.location.href = 'seller-dashboard.html';
});

document.addEventListener('DOMContentLoaded', loadSellerAuctions);
