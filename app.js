// ===== Configuration =====
const YOUTUBE_API_KEY = 'AIzaSyBU3zZKEQwknd9isx4Vl53pNmsTG9dhfsM';
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDmsAnsBdBo0-w3W81WZHSlaz6zFlFgsWI",
    authDomain: "login-1b4fe.firebaseapp.com",
    projectId: "login-1b4fe",
    storageBucket: "login-1b4fe.firebasestorage.app",
    messagingSenderId: "872709725687",
    appId: "1:872709725687:web:579eb423bb5f6a14e322f2",
    measurementId: "G-WEYB38Z2DJ"
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const analytics = firebase.analytics();

// ===== State Management =====
let currentUser = null;
let watchHistory = JSON.parse(localStorage.getItem('yflix_history')) || [];
let likedVideos = JSON.parse(localStorage.getItem('yflix_liked')) || [];
let watchLater = JSON.parse(localStorage.getItem('yflix_watchlater')) || [];
let currentVideoId = null;
let liveViewersInterval = null;

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check auth state
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateAuthUI();
    });

    // Load trending videos
    loadTrendingVideos();

    // Start live views counter
    startLiveViewsCounter();

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Search on Enter
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchVideos();
        }
    });

    // Close modal on outside click
    document.getElementById('loginModal').addEventListener('click', (e) => {
        if (e.target.id === 'loginModal') {
            closeLoginModal();
        }
    });

    // Menu toggle
    document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
}

// ===== Live Views Counter =====
function startLiveViewsCounter() {
    updateLiveViews();
    liveViewersInterval = setInterval(updateLiveViews, 5000);
}

function updateLiveViews() {
    const baseViewers = 1250000;
    const variance = Math.floor(Math.random() * 50000) - 25000;
    const currentViewers = baseViewers + variance;
    document.getElementById('liveViews').textContent = formatNumber(currentViewers);
}

// ===== YouTube API Functions =====
async function loadTrendingVideos() {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&maxResults=12&regionCode=US&key=${YOUTUBE_API_KEY}`
        );
        const data = await response.json();
        displayVideos(data.items, 'trendingVideos');
    } catch (error) {
        console.error('Error loading trending videos:', error);
        showError('Failed to load trending videos');
    }
}

async function searchVideos() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    showPage('searchPage');
    document.getElementById('searchLoader').style.display = 'flex';
    document.getElementById('searchResults').innerHTML = '';

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20&key=${YOUTUBE_API_KEY}`
        );
        const data = await response.json();
        
        document.getElementById('searchTitle').textContent = `Search results for "${query}"`;
        document.getElementById('resultsCount').textContent = `${data.pageInfo.totalResults} results`;
        
        displayVideos(data.items, 'searchResults', true);
    } catch (error) {
        console.error('Error searching videos:', error);
        showError('Failed to search videos');
    } finally {
        document.getElementById('searchLoader').style.display = 'none';
    }
}

async function searchByCategory(category) {
    document.getElementById('searchInput').value = category;
    showPage('searchPage');
    document.getElementById('searchLoader').style.display = 'flex';
    document.getElementById('searchResults').innerHTML = '';

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(category)}&type=video&maxResults=20&key=${YOUTUBE_API_KEY}`
        );
        const data = await response.json();
        
        document.getElementById('searchTitle').textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Videos`;
        document.getElementById('resultsCount').textContent = `${data.pageInfo.totalResults} results`;
        
        displayVideos(data.items, 'searchResults', true);
    } catch (error) {
        console.error('Error loading category:', error);
        showError('Failed to load category videos');
    } finally {
        document.getElementById('searchLoader').style.display = 'none';
    }
}

async function loadRelatedVideos(videoId) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`
        );
        const data = await response.json();
        displayRelatedVideos(data.items);
    } catch (error) {
        console.error('Error loading related videos:', error);
    }
}

async function playVideo(videoId) {
    currentVideoId = videoId;
    showPage('videoPage');

    try {
        // Get video details
        const videoResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
        );
        const videoData = await videoResponse.json();
        const video = videoData.items[0];

        if (!video) {
            showError('Video not found');
            return;
        }

        // Update player
        document.getElementById('videoPlayer').innerHTML = `
            <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
        `;

        // Update video info
        document.getElementById('videoTitle').textContent = video.snippet.title;
        document.getElementById('videoViews').textContent = formatNumber(video.statistics.viewCount) + ' views';
        document.getElementById('videoDate').textContent = formatDate(video.snippet.publishedAt);
        document.getElementById('likeCount').textContent = formatNumber(video.statistics.likeCount);
        document.getElementById('videoDescription').textContent = video.snippet.description || 'No description available.';

        // Update channel info
        document.getElementById('channelName').textContent = video.snippet.channelTitle;
        document.getElementById('channelSubs').textContent = 'Subscribe for more';
        document.getElementById('channelAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(video.snippet.channelTitle)}&background=1e90ff&color=fff&size=100`;

        // Check if liked
        const likeBtn = document.querySelector('.action-btn[onclick="likeVideo()"]');
        if (likedVideos.includes(videoId)) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }

        // Add to history
        addToHistory(video);

        // Load related videos
        loadRelatedVideos(videoId);

    } catch (error) {
        console.error('Error loading video:', error);
        showError('Failed to load video');
    }
}

// ===== Display Functions =====
function displayVideos(videos, containerId, isSearch = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    videos.forEach(item => {
        const videoId = isSearch ? item.id.videoId : item.id;
        if (!videoId) return;

        const thumbnail = item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url;
        const duration = item.contentDetails?.duration ? formatDuration(item.contentDetails.duration) : '';
        const viewCount = item.statistics?.viewCount ? formatNumber(item.statistics.viewCount) : '';
        const publishedAt = formatDate(item.snippet.publishedAt);

        const card = document.createElement('div');
        card.className = 'video-card';
        card.onclick = () => playVideo(videoId);
        card.innerHTML = `
            <div class="video-thumbnail">
                <img src="${thumbnail}" alt="${item.snippet.title}" loading="lazy">
                ${duration ? `<span class="video-duration">${duration}</span>` : ''}
                ${viewCount ? `<span class="video-views"><i class="fas fa-eye"></i> ${viewCount}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-row">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(item.snippet.channelTitle)}&background=1e90ff&color=fff&size=72" 
                         alt="${item.snippet.channelTitle}" class="channel-avatar-small">
                    <div class="video-text">
                        <h3>${item.snippet.title}</h3>
                        <p class="channel-name">${item.snippet.channelTitle}</p>
                        <p class="video-meta-text">${viewCount ? viewCount + ' views • ' : ''}${publishedAt}</p>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function displayRelatedVideos(videos) {
    const container = document.getElementById('relatedVideos');
    container.innerHTML = '<h3>Related Videos</h3>';

    videos.forEach(item => {
        if (!item.id.videoId) return;

        const thumbnail = item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url;
        const card = document.createElement('div');
        card.className = 'related-video-item';
        card.onclick = () => playVideo(item.id.videoId);
        card.innerHTML = `
            <div class="thumb">
                <img src="${thumbnail}" alt="${item.snippet.title}" loading="lazy">
            </div>
            <div class="info">
                <h4>${item.snippet.title}</h4>
                <p>${item.snippet.channelTitle}</p>
                <span>${formatDate(item.snippet.publishedAt)}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// ===== History Functions =====
function addToHistory(video) {
    const historyItem = {
        id: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        channelTitle: video.snippet.channelTitle,
        viewCount: video.statistics?.viewCount,
        publishedAt: video.snippet.publishedAt,
        watchedAt: new Date().toISOString()
    };

    // Remove if already in history
    watchHistory = watchHistory.filter(item => item.id !== video.id);
    
    // Add to beginning
    watchHistory.unshift(historyItem);
    
    // Keep only last 50 items
    if (watchHistory.length > 50) {
        watchHistory = watchHistory.slice(0, 50);
    }

    localStorage.setItem('yflix_history', JSON.stringify(watchHistory));
}

function showHistory() {
    showPage('historyPage');
    const container = document.getElementById('historyVideos');
    const emptyState = document.getElementById('emptyHistory');

    if (watchHistory.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'grid';
    emptyState.style.display = 'none';

    container.innerHTML = '';
    watchHistory.forEach(item => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.onclick = () => playVideo(item.id);
        card.innerHTML = `
            <div class="video-thumbnail">
                <img src="${item.thumbnail}" alt="${item.title}" loading="lazy">
            </div>
            <div class="video-details">
                <div class="video-info-row">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(item.channelTitle)}&background=1e90ff&color=fff&size=72" 
                         alt="${item.channelTitle}" class="channel-avatar-small">
                    <div class="video-text">
                        <h3>${item.title}</h3>
                        <p class="channel-name">${item.channelTitle}</p>
                        <p class="video-meta-text">Watched ${formatDate(item.watchedAt)}</p>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all watch history?')) {
        watchHistory = [];
        localStorage.setItem('yflix_history', JSON.stringify(watchHistory));
        showHistory();
        showToast('Watch history cleared');
    }
}

// ===== Video Actions =====
function likeVideo() {
    if (!currentVideoId) return;

    const index = likedVideos.indexOf(currentVideoId);
    const likeBtn = document.querySelector('.action-btn[onclick="likeVideo()"]');

    if (index > -1) {
        likedVideos.splice(index, 1);
        likeBtn.classList.remove('liked');
        showToast('Removed from liked videos');
    } else {
        likedVideos.push(currentVideoId);
        likeBtn.classList.add('liked');
        showToast('Added to liked videos');
    }

    localStorage.setItem('yflix_liked', JSON.stringify(likedVideos));
}

function showLikedVideos() {
    if (likedVideos.length === 0) {
        showToast('No liked videos yet');
        return;
    }
    document.getElementById('searchInput').value = 'liked videos';
    searchVideos();
}

function saveToWatchLater() {
    if (!currentVideoId) return;

    if (watchLater.includes(currentVideoId)) {
        showToast('Already in Watch Later');
        return;
    }

    watchLater.push(currentVideoId);
    localStorage.setItem('yflix_watchlater', JSON.stringify(watchLater));
    showToast('Saved to Watch Later');
}

function showWatchLater() {
    if (watchLater.length === 0) {
        showToast('No videos in Watch Later');
        return;
    }
    document.getElementById('searchInput').value = 'watch later videos';
    searchVideos();
}

function shareVideo() {
    const url = `https://www.youtube.com/watch?v=${currentVideoId}`;
    if (navigator.share) {
        navigator.share({
            title: document.getElementById('videoTitle').textContent,
            url: url
        });
    } else {
        navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard');
    }
}

// ===== Authentication =====
function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeLoginModal();
        showToast('Welcome back!');
    } catch (error) {
        showError(error.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        closeLoginModal();
        showToast('Account created successfully!');
    } catch (error) {
        showError(error.message);
    }
}

async function googleSignIn() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        closeLoginModal();
        showToast('Signed in with Google!');
    } catch (error) {
        showError(error.message);
    }
}

async function signOut() {
    try {
        await auth.signOut();
        showToast('Signed out successfully');
    } catch (error) {
        showError(error.message);
    }
}

function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const userMenu = document.getElementById('userMenu');

    if (currentUser) {
        authSection.style.display = 'none';
        userMenu.style.display = 'flex';
        document.getElementById('userName').textContent = currentUser.displayName || 'User';
        document.getElementById('userAvatar').src = currentUser.photoURL || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'User')}&background=1e90ff&color=fff`;
    } else {
        authSection.style.display = 'block';
        userMenu.style.display = 'none';
    }
}

// ===== Navigation =====
function goHome() {
    showPage('homePage');
    document.getElementById('searchInput').value = '';
}

function showTrending() {
    showPage('searchPage');
    document.getElementById('searchLoader').style.display = 'flex';
    loadTrendingVideos();
    document.getElementById('searchTitle').textContent = 'Trending Now';
}

function showSubscriptions() {
    if (!currentUser) {
        showLoginModal();
        showToast('Please sign in to view subscriptions');
        return;
    }
    searchByCategory('music');
}

function showPage(pageId) {
    const pages = ['homePage', 'searchPage', 'videoPage', 'historyPage'];
    pages.forEach(page => {
        document.getElementById(page).style.display = page === pageId ? 'block' : 'none';
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    sidebar.classList.toggle('active');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

// ===== Utility Functions =====
function formatNumber(num) {
    num = parseInt(num);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');

    if (hours) {
        return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }
    return `${minutes || '0'}:${seconds.padStart(2, '0')}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);

    if (years > 0) return years + ' year' + (years > 1 ? 's' : '') + ' ago';
    if (months > 0) return months + ' month' + (months > 1 ? 's' : '') + ' ago';
    if (days > 0) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    if (hours > 0) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
    if (minutes > 0) return minutes + ' minute' + (minutes > 1 ? 's' : '') + ' ago';
    return 'Just now';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    toast.classList.remove('error');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showError(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show', 'error');
    setTimeout(() => toast.classList.remove('show', 'error'), 3000);
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
    // Focus search on /
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    
    // Close modal on Escape
    if (e.key === 'Escape') {
        closeLoginModal();
    }
});