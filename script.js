// تنظیمات سیستم
const CHANNEL_ID = '3116788';
const API_KEY = 'FOB57VQ57OC6VAP8';
const UPDATE_TIME = 10000; // 10 ثانیه
const OFFLINE_THRESHOLD = 30000; // 30 ثانیه بدون داده = آفلاین

// اطلاعات سطل‌های دانشگاه مهارت ملی
const trashCans = [
    {
        id: 1,
        name: 'سطل اصلی دانشگاه',
        location: [38.043972, 46.268583],
        status: 'unknown',
        fill: 0,
        distance: 0,
        lastUpdate: null,
        isReal: true
    },
    {
        id: 2,
        name: 'سطل محوطه مرکزی',
        location: [38.044300, 46.268900],
        status: 'empty',
        fill: 0,
        distance: 12,
        lastUpdate: null,
        isReal: false
    },
    {
        id: 3,
        name: 'سطل ورودی شرقی',
        location: [38.043600, 46.268200],
        status: 'empty', 
        fill: 0,
        distance: 10,
        lastUpdate: null,
        isReal: false
    }
];

let map;
let markers = [];
let isOnline = false;
let lastDataReceived = null;
let autoRefreshInterval = null;

// ایجاد نقشه
function initMap() {
    map = L.map('map').setView([38.043972, 46.268583], 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    createMarkers();
}

// ایجاد مارکرهای سطل‌ها
function createMarkers() {
    trashCans.forEach(trash => {
        const marker = L.marker(trash.location, {
            icon: getTrashIcon(trash.status, trash.isReal)
        }).addTo(map);
        
        markers.push({
            id: trash.id,
            marker: marker,
            trash: trash
        });
        
        updateMarkerPopup(marker, trash);
        
        if (trash.isReal) {
            marker.on('click', function() {
                updateCurrentTrashDisplay(trash.id);
            });
        }
    });
}

// ایجاد آیکون سفارشی برای سطل‌ها
function getTrashIcon(status, isReal) {
    let color;
    switch(status) {
        case 'empty': color = '#27ae60'; break;
        case 'half': color = '#f39c12'; break;
        case 'full': color = '#e74c3c'; break;
        default: color = '#95a5a6';
    }
    
    const className = isReal ? 'custom-trash-icon' : 'custom-trash-icon demo';
    
    return L.divIcon({
        className: className,
        html: `
            <div style="
                background: ${color};
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
                cursor: pointer;
            ">🗑️</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// آپدیت پاپ‌آپ مارکر
function updateMarkerPopup(marker, trash) {
    let statusText, timeText, systemStatus;
    
    if (trash.isReal) {
        statusText = getStatusText(trash.status);
        timeText = trash.lastUpdate ? 
            trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
        systemStatus = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
    } else {
        statusText = getStatusText(trash.status);
        timeText = 'دمو';
        systemStatus = '⚪ دمو';
    }
    
    const popupContent = `
        <div style="padding: 12px; min-width: 220px; font-family: Vazir, sans-serif;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🗑️ ${trash.name}</h4>
            <div style="display: grid; gap: 6px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت:</span>
                    <strong style="color: ${getStatusColor(trash.status)}">${statusText}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">میزان پر:</span>
                    <strong>${trash.fill}%</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">فاصله:</span>
                    <strong>${trash.distance}cm</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">موقعیت:</span>
                    <strong>${trash.location[0].toFixed(6)}, ${trash.location[1].toFixed(6)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">بروزرسانی:</span>
                    <strong>${timeText}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت سیستم:</span>
                    <strong>${systemStatus}</strong>
                </div>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
}

// دریافت داده از Thingspeak
async function fetchData() {
    try {
        const response = await fetch(
            `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 داده دریافتی:', data);
        
        // اگر داده معتبر دریافت شد
        if (data && data.created_at) {
            isOnline = true;
            lastDataReceived = Date.now();
            
            // همیشه داده رو پردازش کن، حتی اگر 0% باشه
            if (data.field1 !== null && data.field2 !== null) {
                processThingSpeakData(data);
            }
        } else {
            throw new Error('داده معتبر دریافت نشد');
        }
        
    } catch (error) {
        console.error('❌ خطا در دریافت داده:', error);
        // در صورت خطا وضعیت آنلاین رو چک کن
        checkOnlineStatus();
    }
}

// پردازش داده Thingspeak
function processThingSpeakData(data) {
    const fillPercentage = Math.round(parseFloat(data.field1));
    const distance = parseFloat(data.field2);
    
    console.log(`🔄 پردازش داده: ${fillPercentage}% | فاصله: ${distance}cm`);
    
    let status;
    if (fillPercentage >= 80) {
        status = 'full';
    } else if (fillPercentage >= 50) {
        status = 'half';
    } else {
        status = 'empty';
    }
    
    updateRealTrashCan(status, fillPercentage, distance);
    updateAllDisplays(1);
}

// آپدیت فقط سطل واقعی
function updateRealTrashCan(status, fillPercentage, distance) {
    const realTrash = trashCans.find(trash => trash.isReal);
    if (realTrash) {
        realTrash.status = status;
        realTrash.fill = fillPercentage;
        realTrash.distance = distance;
        realTrash.lastUpdate = new Date();
    }
}

// بررسی وضعیت آنلاین
function checkOnlineStatus() {
    const now = Date.now();
    
    if (!lastDataReceived) {
        // اگر هیچ داده‌ای دریافت نشده
        setSystemOffline();
        return;
    }
    
    // اگر بیش از 30 ثانیه از آخرین داده گذشته
    const timeSinceLastData = now - lastDataReceived;
    if (timeSinceLastData > OFFLINE_THRESHOLD) {
        setSystemOffline();
    } else {
        setSystemOnline();
    }
}

// تنظیم وضعیت آنلاین سیستم
function setSystemOnline() {
    if (!isOnline) {
        isOnline = true;
        console.log('✅ سیستم آنلاین شد');
        updateAllDisplays(1);
    }
}

// تنظیم وضعیت آفلاین سیستم
function setSystemOffline() {
    if (isOnline) {
        isOnline = false;
        console.log('🔴 سیستم آفلاین شد');
        
        const realTrash = trashCans.find(trash => trash.isReal);
        if (realTrash) {
            realTrash.status = 'unknown';
        }
        
        updateAllDisplays(1);
    }
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(activeTrashId = 1) {
    updateMarkers();
    updateTrashList();
    updateOverviewCards();
    updateCurrentTrashDisplay(activeTrashId);
    updateConnectionStatus();
}

// آپدیت مارکرها روی نقشه
function updateMarkers() {
    markers.forEach(markerData => {
        const trash = markerData.trash;
        
        if (trash.isReal) {
            const newIcon = getTrashIcon(trash.status, trash.isReal);
            markerData.marker.setIcon(newIcon);
            updateMarkerPopup(markerData.marker, trash);
        }
    });
}

// آپدیت لیست سطل‌ها
function updateTrashList() {
    const trashList = document.getElementById('trashList');
    trashList.innerHTML = '';
    
    trashCans.forEach(trash => {
        let statusText, timeText, displayFill, displayDistance, onlineStatus;
        
        if (trash.isReal) {
            statusText = getStatusText(trash.status);
            timeText = trash.lastUpdate ? 
                trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
            displayFill = trash.fill;
            displayDistance = trash.distance;
            onlineStatus = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
        } else {
            statusText = getStatusText(trash.status);
            timeText = 'دمو';
            displayFill = trash.fill;
            displayDistance = trash.distance;
            onlineStatus = '⚪ دمو';
        }
        
        const statusClass = `state-${trash.status}`;
        const demoClass = trash.isReal ? '' : 'demo';
        
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${trash.status} ${demoClass}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-title">${trash.name}</div>
                <div class="trash-state ${statusClass}">${statusText}</div>
            </div>
            <div class="trash-details">
                <div class="trash-detail">
                    <span>میزان پر:</span>
                    <span>${displayFill}%</span>
                </div>
                <div class="trash-detail">
                    <span>فاصله:</span>
                    <span>${displayDistance}cm</span>
                </div>
                <div class="trash-detail">
                    <span>کد سطل:</span>
                    <span>${trash.id}</span>
                </div>
                <div class="trash-detail">
                    <span>وضعیت:</span>
                    <span>${onlineStatus}</span>
                </div>
                <div class="trash-detail">
                    <span>آخرین بروزرسانی:</span>
                    <span>${timeText}</span>
                </div>
            </div>
        `;
        
        if (trash.isReal) {
            trashItem.addEventListener('click', () => {
                updateCurrentTrashDisplay(trash.id);
            });
        } else {
            trashItem.style.cursor = 'not-allowed';
        }
        
        trashList.appendChild(trashItem);
    });
}

// آپدیت کارت‌های آمار کلی
function updateOverviewCards() {
    const realTrash = trashCans.find(trash => trash.isReal);
    let emptyCount = 0;
    let fullCount = 0;

    if (realTrash) {
        if (realTrash.status === 'empty') emptyCount = 1;
        if (realTrash.status === 'full') fullCount = 1;
    }
    
    document.getElementById('emptyCans').textContent = emptyCount;
    document.getElementById('fullCans').textContent = fullCount;
    document.getElementById('totalCans').textContent = trashCans.length;
}

// آپدیت نمایش سطل فعلی
function updateCurrentTrashDisplay(trashId) {
    const trash = trashCans.find(t => t.id === trashId) || trashCans[0];
    
    if (!trash.isReal) return;
    
    document.getElementById('trashName').textContent = trash.name;
    document.getElementById('gaugeText').textContent = trash.fill + '%';
    
    const gaugeFill = document.getElementById('gaugeFill');
    gaugeFill.style.height = trash.fill + '%';
    gaugeFill.style.backgroundColor = getStatusColor(trash.status);
    
    document.getElementById('trashDistance').textContent = trash.distance + ' cm';
    document.getElementById('trashStatus').textContent = getStatusText(trash.status);
    document.getElementById('lastUpdate').textContent = 
        trash.lastUpdate ? trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
    
    if (map) {
        map.setView(trash.location, 16);
    }
}

// آپدیت وضعیت ارتباط
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    
    if (isOnline) {
        statusElement.textContent = 'آنلاین';
        statusElement.style.color = '#27ae60';
    } else {
        statusElement.textContent = 'آفلاین';
        statusElement.style.color = '#e74c3c';
    }
}

// توابع کمکی
function getStatusText(status) {
    switch(status) {
        case 'empty': return 'خالی';
        case 'half': return 'نیمه پر';
        case 'full': return 'پر';
        case 'unknown': return 'آفلاین';
        default: return 'نامشخص';
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'empty': return '#27ae60';
        case 'half': return '#f39c12';
        case 'full': return '#e74c3c';
        case 'unknown': return '#95a5a6';
        default: return '#3498db';
    }
}

// تابع بروزرسانی دستی
function refreshData() {
    console.log('🔄 بروزرسانی دستی داده‌ها...');
    fetchData();
}

// تابع بروزرسانی خودکار
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefreshInterval) {
        // غیرفعال کردن
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        btn.textContent = '⏰ بروزرسانی خودکار: غیرفعال';
        btn.style.background = '#e74c3c';
        console.log('⏸️ بروزرسانی خودکار غیرفعال شد');
    } else {
        // فعال کردن
        autoRefreshInterval = setInterval(fetchData, UPDATE_TIME);
        btn.textContent = '⏰ بروزرسانی خودکار: فعال';
        btn.style.background = '#27ae60';
        console.log('▶️ بروزرسانی خودکار فعال شد');
    }
}

function startAutoRefresh() {
    // توقف interval قبلی
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // شروع interval جدید
    autoRefreshInterval = setInterval(fetchData, UPDATE_TIME);
}

// راه‌اندازی سیستم
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 شروع سیستم مدیریت سطل زباله هوشمند...');
    
    // مقداردهی اولیه
    initMap();
    updateAllDisplays();
    
    // شروع بروزرسانی خودکار
    startAutoRefresh();
    
    // شروع چک کردن وضعیت آنلاین هر 5 ثانیه
    setInterval(checkOnlineStatus, 5000);
    
    // اولین دریافت داده
    setTimeout(fetchData, 2000);
    
    console.log('✅ سیستم وب آماده به کار است');
});

// مدیریت رویدادهای صفحه
window.addEventListener('beforeunload', function() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
});
