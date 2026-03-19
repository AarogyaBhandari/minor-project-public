const API_URL = 'http://localhost:5000/api/auctions';
let allAuctions = [];
let countdownIntervals = {};

async function loadAuctions() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch auctions');
    
    allAuctions = await response.json();
    displayAuctions(allAuctions);
  } catch (err) {
    console.error('Error loading auctions:', err);
    showNoAuctions('Failed to load auctions. Please try again.');
  }
}

function displayAuctions(auctions) {
  const section = document.getElementById('auctions-section');
  
  if (auctions.length === 0) {
    showNoAuctions('No active auctions at the moment. Check back soon!');
    return;
  }

  section.innerHTML = auctions.map(auction => `
    <div class="auction-card" onclick="viewAuction('${auction._id}')">
      ${auction.imageUrl ? `<img src="${auction.imageUrl}" alt="${auction.title}" class="auction-image" />` : '<div class="auction-image" style="display: flex; align-items: center; justify-content: center; color: #999;"><i class="fas fa-image"></i></div>'}
      <div class="auction-info">
        <div class="auction-title">${auction.title}</div>
        <div class="auction-price">Rs${auction.currentPrice.toFixed(2)}</div>
        <div class="auction-countdown" id="countdown-${auction._id}">
          <i class="fas fa-clock"></i> <span id="time-${auction._id}">--:--:--</span>
        </div>
        <div class="auction-bids">${auction.bids.length} bids</div>
        <button class="view-button">View & Bid</button>
      </div>
    </div>
  `).join('');

  // Start countdown timers
  auctions.forEach(auction => {
    updateCountdown(auction._id, auction.endTime);
    if (countdownIntervals[auction._id]) clearInterval(countdownIntervals[auction._id]);
    countdownIntervals[auction._id] = setInterval(() => {
      updateCountdown(auction._id, auction.endTime);
    }, 1000);
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
  window.location.href = `auction-details.html?id=${auctionId}`;
}

function showNoAuctions(message) {
  const section = document.getElementById('auctions-section');
  section.innerHTML = `<div id="no-auctions"><h3>${message}</h3></div>`;
}

document.addEventListener('DOMContentLoaded', loadAuctions);
